import { describe, it, expect } from 'vitest';
import {
  PathologyEntry,
  searchPathologyCatalog,
  findPathologiesByOrgan,
  getInvolvedOrgansForPathology,
} from './diseaseCorrelationEngine';

describe('DiseaseCorrelationEngine (Spec verification from specs/disease-pathology-catalog.md)', () => {
  const sampleCatalog: readonly PathologyEntry[] = [
    {
      id: 'MONDO:0005068',
      titleFa: 'انفارکتوس میوکارد',
      titleEn: 'Myocardial Infarction',
      icd10Code: 'I21',
      affectedOrganIds: ['heart', 'left_ventricle', 'coronary_arteries'],
      summaryFa: 'نکروز ایسکمیک میوکارد به علت انسداد حاد شریان کرونر.',
    },
    {
      id: 'MONDO:0005812',
      titleFa: 'سنگ کلیه',
      titleEn: 'Nephrolithiasis',
      icd10Code: 'N20',
      affectedOrganIds: ['kidney', 'ureter'],
      summaryFa: 'تشکیل رسوبات معدنی سخت در مجاری ادراری کلیه.',
    },
  ];

  it('Scenario 1: searches pathology by Persian title substring', () => {
    const results = searchPathologyCatalog('انفارکتوس', sampleCatalog);
    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe('MONDO:0005068');
    expect(results[0]?.titleEn).toBe('Myocardial Infarction');
  });

  it('Scenario 2: extracts associated pathologies given an organ identifier', () => {
    const results = findPathologiesByOrgan('kidney', sampleCatalog);
    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe('MONDO:0005812');
    expect(results[0]?.titleFa).toBe('سنگ کلیه');
  });

  it('Scenario 3: retrieves list of involved 3D anatomical organs for a pathology', () => {
    const organs = getInvolvedOrgansForPathology('MONDO:0005068', sampleCatalog);
    expect(organs).toEqual(['heart', 'left_ventricle', 'coronary_arteries']);
  });

  it('Edge Case A: normalizes Arabic Yeh/Kaf diacritics in search queries', () => {
    // Query with Arabic Yeh (ي) instead of Persian (ی)
    const arabicQuery = 'انفارکتوس ميوکارد';
    const results = searchPathologyCatalog(arabicQuery, sampleCatalog);

    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe('MONDO:0005068');
  });

  it('Edge Case B: handles non-existent or systemic diseases gracefully', () => {
    const nonExistent = getInvolvedOrgansForPathology('NON_EXISTENT_ID', sampleCatalog);
    expect(nonExistent).toEqual([]);
  });

  it('Edge Case C: returns empty array on unmatching search term', () => {
    const results = searchPathologyCatalog('اتومبیل', sampleCatalog);
    expect(results).toEqual([]);
  });

  describe('Comprehensive Clinical Catalog (Robbins & Harrison)', () => {
    it('searches diseases by Persian keywords and clinical aliases', async () => {
      const { searchDiseases } = await import('./catalog');
      expect(searchDiseases('سکته قلبی').length).toBeGreaterThanOrEqual(1);
      expect(searchDiseases('آپاندیس').length).toBeGreaterThanOrEqual(1);
      expect(searchDiseases('آلزایمر').length).toBeGreaterThanOrEqual(1);
      expect(searchDiseases('prostate').length).toBeGreaterThanOrEqual(1);
    });

    it('maps 3D anatomical structure IDs to correct clinical pathologies for both genders', async () => {
      const { diseasesForStructure } = await import('./catalog');

      // Male cardiac structure
      const maleHeart = diseasesForStructure('left_ventricle', 'male');
      expect(maleHeart.some((d) => d.id === 'myocardial-infarction')).toBe(true);

      // Male endocrine structure
      const maleThyroid = diseasesForStructure('thyroid_gland', 'male');
      expect(maleThyroid.some((d) => d.id === 'hashimotos-thyroiditis')).toBe(true);

      // Female pelvic / reproductive structure
      const femaleOvary = diseasesForStructure('ovary_l', 'female');
      expect(femaleOvary.some((d) => d.id === 'ovarian-cysts-and-tumors')).toBe(true);

      // Female digestive structure
      const femaleAppendix = diseasesForStructure('vermiform_appendix', 'female');
      expect(femaleAppendix.some((d) => d.id === 'appendicitis')).toBe(true);
    });
  });
});
