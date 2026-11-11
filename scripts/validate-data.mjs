import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const catalogPath = path.join(rootDir, 'frontend', 'src', 'data', 'anatomyCatalog.json');
const kgPath = path.join(rootDir, 'frontend', 'src', 'data', 'pathologyKnowledgeGraph.json');
const atlasPath = path.join(rootDir, 'frontend', 'public', 'models', 'atlas.json');
const mockPath = path.join(rootDir, 'frontend', 'src', 'data', 'mockPathology.ts');

const errors = [];

if (fs.existsSync(mockPath)) {
  errors.push('Forbidden mockPathology.ts still exists inside frontend/src/data/ production tree.');
}

const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf-8'));
const kg = JSON.parse(fs.readFileSync(kgPath, 'utf-8'));

if (!catalog.schemaVersion || !Array.isArray(catalog.records) || catalog.records.length === 0) {
  errors.push('anatomyCatalog.json missing schemaVersion or non-empty records array.');
}

const VALID_SYSTEMS = new Set([
  'skeletal', 'muscular', 'nervous', 'cardiovascular',
  'respiratory', 'digestive', 'urinary', 'lymphatic',
  'integumentary', 'endocrine', 'reproductive',
]);
const VALID_STATUS = new Set(['reference', 'educational_visualization', 'draft']);
const seenRecordIds = new Set();
const seenMeshNames = new Map();
const catalogFmas = new Set();

for (const rec of catalog.records) {
  if (!rec.id || !rec.id.startsWith('anatomy:')) {
    errors.push(`Invalid AnatomyRecord.id format: ${rec.id}`);
  }
  if (seenRecordIds.has(rec.id)) {
    errors.push(`Duplicate AnatomyRecord.id: ${rec.id}`);
  }
  seenRecordIds.add(rec.id);

  if (rec.fmaId) catalogFmas.add(rec.fmaId);

  if (!VALID_SYSTEMS.has(rec.system)) {
    errors.push(`Invalid system "${rec.system}" in ${rec.id}`);
  }
  if (!VALID_STATUS.has(rec.contentStatus)) {
    errors.push(`Invalid contentStatus "${rec.contentStatus}" in ${rec.id}`);
  }
  if (!rec.source || !rec.reviewedBy || !rec.reviewedAt || !rec.nameEn || !rec.nameFa) {
    errors.push(`Missing provenance or bilingual name fields in ${rec.id}`);
  }
  if (!Array.isArray(rec.meshNames)) {
    errors.push(`meshNames must be an array in ${rec.id}`);
    continue;
  }
  for (const mesh of rec.meshNames) {
    if (seenMeshNames.has(mesh)) {
      errors.push(`Duplicate meshName "${mesh}" claimed by both ${seenMeshNames.get(mesh)} and ${rec.id}`);
    }
    seenMeshNames.set(mesh, rec.id);
  }
}

if (!kg.schemaVersion || !kg.organs || typeof kg.organs !== 'object') {
  errors.push('pathologyKnowledgeGraph.json missing schemaVersion or organs object.');
} else {
  for (const [fmaKey, organ] of Object.entries(kg.organs)) {
    if (!catalogFmas.has(fmaKey)) {
      errors.push(`Pathology organ key "${fmaKey}" does not exist in anatomyCatalog.json`);
    }
    if (!organ.recordId || !seenRecordIds.has(organ.recordId)) {
      errors.push(`Pathology organ ${fmaKey} references invalid recordId: ${organ.recordId}`);
    }
    if (!organ.source || !organ.sourceVersion || !organ.reviewedBy || !organ.reviewedAt || !VALID_STATUS.has(organ.contentStatus)) {
      errors.push(`Pathology organ ${fmaKey} missing provenance/status metadata.`);
    }
    for (const dis of organ.disorders || []) {
      if (!dis.snomedDisorderId || !dis.fsnEn || !dis.preferredTermFa) {
        errors.push(`Disorder in ${fmaKey} missing SNOMED ID or bilingual term.`);
      }
      if (!dis.descriptionEn || !dis.descriptionFa) {
        errors.push(`Disorder ${dis.snomedDisorderId} in ${fmaKey} must have separate En & Fa descriptions.`);
      }
      if (!dis.source || !dis.sourceVersion || !dis.reviewedBy || !dis.reviewedAt || !VALID_STATUS.has(dis.contentStatus)) {
        errors.push(`Disorder ${dis.snomedDisorderId} in ${fmaKey} missing provenance/status fields.`);
      }
    }
  }
}

const brainVentRecord = catalog.records.find((r) => r.fmaId === 'FMA242784');
if (!brainVentRecord || brainVentRecord.system !== 'nervous') {
  errors.push('FMA242784 (Cerebral ventricles) must exist and belong to nervous system.');
}

if (fs.existsSync(atlasPath)) {
  const atlas = JSON.parse(fs.readFileSync(atlasPath, 'utf-8'));
  const atlasIds = new Set(atlas.parts.map((p) => p.id));
  for (const mesh of seenMeshNames.keys()) {
    if (!atlasIds.has(mesh)) {
      errors.push(`Catalog meshName "${mesh}" not found in atlas.json`);
    }
  }
}

if (errors.length > 0) {
  console.error('[DATA VALIDATION FAILED]');
  for (const err of errors) console.error(' -', err);
  process.exit(1);
}

console.log(
  `[DATA VALIDATION PASSED] ${catalog.records.length} AnatomyRecords, ` +
    `${seenMeshNames.size} unique mapped meshes, ${Object.keys(kg.organs).length} KG organs verified.`
);
