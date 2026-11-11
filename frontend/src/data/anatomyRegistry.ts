import catalogBundleJson from './anatomyCatalog.json' with { type: 'json' };
import kgBundleJson from './pathologyKnowledgeGraph.json' with { type: 'json' };
import type {
  AnatomicalStructure,
  AnatomyCatalogBundle,
  AnatomyRecord,
  AnatomySystem,
  KnowledgeGraphBundle,
  KnowledgeGraphOrgan,
} from '../types/anatomy';

const catalogBundle = catalogBundleJson as unknown as AnatomyCatalogBundle;
const kgBundle = kgBundleJson as unknown as KnowledgeGraphBundle;

// Filter out draft records so unreleased content never appears in public runtime UI
const publishedRecords: AnatomyRecord[] = (catalogBundle.records ?? []).filter(
  (r) => r.contentStatus !== 'draft'
);

const byId = new Map<string, AnatomyRecord>();
const byFmaId = new Map<string, AnatomyRecord>();
const byMeshName = new Map<string, AnatomyRecord>();

for (const record of publishedRecords) {
  byId.set(record.id.toLowerCase(), record);
  if (record.fmaId) {
    byFmaId.set(record.fmaId.toLowerCase(), record);
  }
  for (const mesh of record.meshNames) {
    byMeshName.set(mesh.toLowerCase(), record);
  }
}

const SYSTEM_CATEGORY_LABELS: Record<
  AnatomySystem,
  AnatomicalStructure['systemCategory']
> = {
  skeletal: 'Skeletal',
  muscular: 'Muscular',
  cardiovascular: 'Circulatory',
  respiratory: 'Respiratory',
  digestive: 'Digestive',
  nervous: 'Nervous',
  urinary: 'Urinary',
  integumentary: 'Integumentary',
  endocrine: 'Endocrine',
  lymphatic: 'Lymphatic',
  reproductive: 'Urinary',
};

export function mapSystemToStructureCategory(
  rawSystem: string
): AnatomicalStructure['systemCategory'] {
  const s = rawSystem.toLowerCase();
  if (s === 'cardiac' || s === 'arterial' || s === 'venous' || s === 'cardiovascular' || s === 'circulatory') {
    return 'Circulatory';
  }
  if (s === 'brain' || s === 'sensory' || s === 'nervous') {
    return 'Nervous';
  }
  if (s === 'skeletal' || s === 'connective') return 'Skeletal';
  if (s === 'muscular') return 'Muscular';
  if (s === 'respiratory') return 'Respiratory';
  if (s === 'digestive') return 'Digestive';
  if (s === 'urinary') return 'Urinary';
  if (s === 'integumentary') return 'Integumentary';
  if (s === 'endocrine') return 'Endocrine';
  if (s === 'lymphatic') return 'Lymphatic';
  return 'Skeletal';
}

export const CATALOG_METADATA = {
  schemaVersion: catalogBundle.schemaVersion,
  generatedAt: catalogBundle.generatedAt,
  terminologyNotice: catalogBundle.terminologyNotice,
  reviewedBy: catalogBundle.reviewedBy,
  reviewedAt: catalogBundle.reviewedAt,
};

export const KNOWLEDGE_GRAPH_METADATA = {
  schemaVersion: kgBundle.schemaVersion,
  generatedAt: kgBundle.generatedAt,
  terminologyNotice: kgBundle.terminologyNotice,
};

export function getAllPublishedRecords(): readonly AnatomyRecord[] {
  return publishedRecords;
}

export function getRecordById(recordId: string): AnatomyRecord | null {
  return byId.get(recordId.toLowerCase().trim()) ?? null;
}

export function getRecordByFmaId(fmaId: string): AnatomyRecord | null {
  return byFmaId.get(fmaId.toLowerCase().trim()) ?? null;
}

export function getRecordByMeshName(meshName: string): AnatomyRecord | null {
  return byMeshName.get(meshName.toLowerCase().trim()) ?? null;
}

/**
 * Deterministic resolver for GLB node names (Z-Anatomy fallback) via zAnatomyNames tokens.
 * Explicitly shields CSF brain ventricles from resolving to Cardiac Heart records.
 */
export function getRecordByZAnatomyName(rawName: string): AnatomyRecord | null {
  const lower = rawName.toLowerCase();
  if (
    lower.includes('lateral_ventricle') ||
    lower.includes('lateral ventricle') ||
    lower.includes('third_ventricle') ||
    lower.includes('fourth_ventricle')
  ) {
    return getRecordByFmaId('FMA242784');
  }

  for (const record of publishedRecords) {
    if (!record.zAnatomyNames) continue;
    for (const pattern of record.zAnatomyNames) {
      if (lower.includes(pattern.toLowerCase())) {
        return record;
      }
    }
  }
  return null;
}

/**
 * Resolves any stable record ID, FMA ID, mesh ID, or common query to a canonical AnatomyRecord.
 */
export function resolveCatalogRecord(idOrFmaOrQuery: string): AnatomyRecord | null {
  const q = idOrFmaOrQuery.trim().toLowerCase();
  if (!q) return null;

  const exactId = byId.get(q);
  if (exactId) return exactId;

  const exactFma = byFmaId.get(q);
  if (exactFma) return exactFma;

  const exactMesh = byMeshName.get(q);
  if (exactMesh) return exactMesh;

  // Common multilingual shortcuts -> deterministic FMA records
  const shortcutFma: Record<string, string> = {
    heart: 'FMA7088',
    cardiac: 'FMA7088',
    'قلب': 'FMA7088',
    brain: 'FMA5018',
    cerebrum: 'FMA5018',
    'مغز': 'FMA5018',
    lung: 'FMA7195',
    lungs: 'FMA7195',
    'ریه': 'FMA7195',
    liver: 'FMA7199',
    'کبد': 'FMA7199',
    stomach: 'FMA7148',
    'معده': 'FMA7148',
    'kidney.l': 'FMA7201_L',
    'left kidney': 'FMA7201_L',
    'کلیه چپ': 'FMA7201_L',
    kidney: 'FMA7201_L',
    'کلیه': 'FMA7201_L',
    'right kidney': 'FMA7201_R',
    'کلیه راست': 'FMA7201_R',
    femur: 'FMA9915',
    'استخوان ران': 'FMA9915',
    biceps: 'FMA37670',
    'دوسر بازو': 'FMA37670',
    spleen: 'FMA7194',
    'طحال': 'FMA7194',
    skin: 'FMA7163',
    'پوست': 'FMA7163',
    'brain ventricle': 'FMA242784',
    'بطن مغز': 'FMA242784',
  };

  if (q in shortcutFma) {
    const rec = byFmaId.get(shortcutFma[q].toLowerCase());
    if (rec) return rec;
  }

  // Fallback substring match inside canonical records (never raw uncurated meshes)
  return (
    publishedRecords.find(
      (r) =>
        r.nameEn.toLowerCase().includes(q) ||
        r.nameFa.toLowerCase().includes(q) ||
        (r.fmaId && r.fmaId.toLowerCase() === q)
    ) ?? null
  );
}

export function searchPublishedCatalog(query: string): AnatomyRecord[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return publishedRecords.filter(
    (r) =>
      r.nameEn.toLowerCase().includes(q) ||
      r.nameFa.toLowerCase().includes(q) ||
      r.id.toLowerCase().includes(q) ||
      (r.fmaId && r.fmaId.toLowerCase().includes(q)) ||
      (r.snomedBodyStructureId && r.snomedBodyStructureId.toLowerCase().includes(q))
  );
}

/**
 * Returns educational pathology data ONLY for canonical mapped FMA IDs and filters out draft entries.
 */
export function getPublishedOrganKnowledge(
  fmaId: string | null | undefined
): KnowledgeGraphOrgan | null {
  if (!fmaId) return null;
  const organ = kgBundle.organs?.[fmaId];
  if (!organ || organ.contentStatus === 'draft') return null;

  const publishedDisorders = (organ.disorders ?? []).filter(
    (d) => d.contentStatus !== 'draft'
  );
  return {
    ...organ,
    disorders: publishedDisorders,
  };
}

export function buildStructureFromRecord(
  record: AnatomyRecord,
  hitMeshName?: string
): AnatomicalStructure {
  return {
    recordId: record.id,
    fmaId: record.fmaId ?? record.id,
    snomedBodyStructureId: record.snomedBodyStructureId ?? 'N/A',
    nameEn: record.nameEn,
    nameFa: record.nameFa,
    systemCategory: SYSTEM_CATEGORY_LABELS[record.system] ?? 'Skeletal',
    genderModel: 'both',
    meshNodeName: hitMeshName ?? record.meshNames[0] ?? record.id,
    descriptionEn: record.descriptionEn,
    descriptionFa: record.descriptionFa,
    isMappedToCatalog: true,
    contentStatus: record.contentStatus,
    source: record.source,
    sourceVersion: record.sourceVersion,
    reviewedBy: record.reviewedBy,
    reviewedAt: record.reviewedAt,
  };
}

export function buildUnmappedStructure(
  meshId: string,
  nameEn: string,
  rawSystem: string
): AnatomicalStructure {
  return {
    recordId: `unmapped:${meshId}`,
    fmaId: 'UNMAPPED',
    snomedBodyStructureId: 'UNMAPPED',
    nameEn,
    nameFa: `${nameEn} (ساختار فرعی بدون پرونده آموزشی)`,
    systemCategory: mapSystemToStructureCategory(rawSystem),
    genderModel: 'both',
    meshNodeName: meshId,
    descriptionEn: `${nameEn} (${meshId}) is an unmapped structural sub-part; clinical educational overlays are withheld until verified.`,
    descriptionFa: `ساختار «${nameEn}» (${meshId}) هنوز به پرونده بیماری‌ها متصل نشده است؛ بنابراین اطلاعات بالینی یا آموزشی برای این جزء نمایش داده نمی‌شود.`,
    isMappedToCatalog: false,
    contentStatus: 'educational_visualization',
    source: 'BodyParts3D v4.0 Geometry Index (Unmapped)',
    sourceVersion: '4.0',
  };
}
