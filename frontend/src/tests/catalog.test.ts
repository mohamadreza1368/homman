import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getAllPublishedRecords,
  getRecordByFmaId,
  getRecordById,
  getRecordByMeshName,
  getRecordByZAnatomyName,
  resolveCatalogRecord,
  searchPublishedCatalog,
  buildStructureFromRecord,
  buildUnmappedStructure,
} from '../data/anatomyRegistry.ts';

test('All published AnatomyRecords have unique IDs and zero duplicate meshNames', () => {
  const records = getAllPublishedRecords();
  assert.ok(records.length >= 50, 'Expected at least 50 curated anatomical records');

  const idSet = new Set<string>();
  const meshSet = new Set<string>();

  for (const rec of records) {
    assert.ok(rec.id.startsWith('anatomy:'));
    assert.equal(idSet.has(rec.id), false, `Duplicate record id: ${rec.id}`);
    idSet.add(rec.id);

    assert.notEqual(rec.contentStatus, 'draft');
    assert.ok(rec.source.length > 0);

    for (const mesh of rec.meshNames) {
      assert.equal(meshSet.has(mesh), false, `Duplicate meshName ${mesh}`);
      meshSet.add(mesh);
    }
  }
});

test('Clicking Heart myocardium/chamber resolves deterministically to anatomy:heart_7088 / FMA7088', () => {
  const fromWall = getRecordByMeshName('FJ2428');
  const fromLeftVentricle = getRecordByMeshName('FJ2422');
  const fromQuery = resolveCatalogRecord('قلب');
  const fromFma = getRecordByFmaId('FMA7088');

  assert.ok(fromWall && fromLeftVentricle && fromQuery && fromFma);
  assert.equal(fromWall.id, fromFma.id);
  assert.equal(fromLeftVentricle.id, fromFma.id);
  assert.equal(fromQuery.fmaId, 'FMA7088');
  assert.equal(fromFma.system, 'cardiovascular');
});

test('Brain lateral ventricles NEVER resolve to cardiac Heart (Stage 1 anatomical safety)', () => {
  const fromBodyParts = getRecordByMeshName('FJ1767');
  const fromZAnatomy = getRecordByZAnatomyName('Lateral_ventricle.l');

  assert.ok(fromBodyParts);
  assert.ok(fromZAnatomy);
  assert.equal(fromBodyParts.fmaId, 'FMA242784');
  assert.equal(fromBodyParts.system, 'nervous');
  assert.equal(fromZAnatomy.fmaId, 'FMA242784');
  assert.equal(fromZAnatomy.system, 'nervous');
});

test('Bilingual catalog search finds structures by Persian, English, and FMA ID', () => {
  const byFa = searchPublishedCatalog('کلیه چپ');
  const byEn = searchPublishedCatalog('Left kidney');
  const byFma = searchPublishedCatalog('FMA7201_L');

  assert.ok(byFa.some((r) => r.fmaId === 'FMA7201_L'));
  assert.ok(byEn.some((r) => r.fmaId === 'FMA7201_L'));
  assert.ok(byFma.some((r) => r.fmaId === 'FMA7201_L'));
});

test('Isolation target resolution and unmapped sub-structure guard work cleanly', () => {
  const heart = getRecordById('anatomy:heart_7088');
  assert.ok(heart);
  const mappedStruct = buildStructureFromRecord(heart, 'FJ2428');
  assert.equal(mappedStruct.isMappedToCatalog, true);
  assert.equal(mappedStruct.fmaId, 'FMA7088');

  const unmapped = buildUnmappedStructure('FJ9999', 'Minor unnamed twig', 'arterial');
  assert.equal(unmapped.isMappedToCatalog, false);
  assert.equal(unmapped.fmaId, 'UNMAPPED');
});

test('Liver Hepatovenous segments belong to Digestive Liver FMA7199, never Cardiovascular', () => {
  const seg = getRecordByMeshName('FJ2820');
  assert.ok(seg);
  assert.equal(seg.fmaId, 'FMA7199');
  assert.equal(seg.system, 'digestive');
});

test('Right and Left Lung parenchyma lobes resolve cleanly to FMA7195 and FMA7196', () => {
  const rLung = getRecordByMeshName('BP3D_LUNG_R_SUP');
  const lLung = getRecordByMeshName('BP3D_LUNG_L_SUP');
  assert.ok(rLung && lLung);
  assert.equal(rLung.fmaId, 'FMA7195');
  assert.equal(rLung.system, 'respiratory');
  assert.equal(lLung.fmaId, 'FMA7196');
  assert.equal(lLung.system, 'respiratory');
});
