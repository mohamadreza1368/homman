import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getPublishedOrganKnowledge,
  KNOWLEDGE_GRAPH_METADATA,
} from '../data/anatomyRegistry.ts';

test('Knowledge graph metadata and provenance are populated', () => {
  assert.ok(KNOWLEDGE_GRAPH_METADATA.schemaVersion);
  assert.ok(KNOWLEDGE_GRAPH_METADATA.terminologyNotice.includes('SNOMED CT'));
});

test('Heart FMA7088 connects cleanly to published educational disorders with full provenance', () => {
  const organ = getPublishedOrganKnowledge('FMA7088');
  assert.ok(organ, 'Heart knowledge graph entry must exist');
  assert.equal(organ.recordId, 'anatomy:heart_7088');
  assert.notEqual(organ.contentStatus, 'draft');
  assert.ok(organ.disorders.length >= 3);

  for (const d of organ.disorders) {
    assert.ok(d.snomedDisorderId);
    assert.ok(d.fsnEn.length > 0);
    assert.ok(d.preferredTermFa.length > 0);
    assert.ok(d.descriptionEn && d.descriptionEn.length > 0);
    assert.ok(d.descriptionFa && d.descriptionFa.length > 0);
    assert.ok(d.source.length > 0);
    assert.ok(d.sourceVersion.length > 0);
    assert.ok(d.reviewedBy.length > 0);
    assert.ok(d.reviewedAt.length > 0);
    assert.equal(d.contentStatus, 'educational_visualization');
  }
});

test('Unmapped structures NEVER return bogus pathology disorders', () => {
  assert.equal(getPublishedOrganKnowledge('UNMAPPED'), null);
  assert.equal(getPublishedOrganKnowledge(''), null);
  assert.equal(getPublishedOrganKnowledge(null), null);
});
