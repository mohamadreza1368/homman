import { describe, it, expect } from 'vitest';
import {
  evaluateInputSafety,
  parseViewerCommandIntent,
  extractRecognizedAnatomicalEntities,
  AnatomicalGlossaryItem,
} from './clinicalSafetyEngine';

describe('ClinicalSafetyEngine (Spec verification from specs/clinical-chat-safety.md)', () => {
  const testGlossary: readonly AnatomicalGlossaryItem[] = [
    {
      id: 'right_ventricle',
      farsiTerms: ['بطن راست', 'بطن راست قلب'],
      englishTerms: ['right ventricle'],
    },
    {
      id: 'left_ventricle',
      farsiTerms: ['بطن چپ'],
      englishTerms: ['left ventricle'],
    },
    {
      id: 'aorta',
      farsiTerms: ['شریان آئورت', 'آئورت'],
      englishTerms: ['aorta'],
    },
    {
      id: 'mitral_valve',
      farsiTerms: ['دریچه میترال'],
      englishTerms: ['mitral valve'],
    },
  ];

  it('Scenario 1: identifies 3D viewer focus intent and target organ from natural Persian query', () => {
    const input = 'لطفاً بطن راست قلب را به من نشان بده';
    const result = parseViewerCommandIntent(input, testGlossary);

    expect(result.actionType).toBe('focus_structure');
    expect(result.targetOrganId).toBe('right_ventricle');
  });

  it('Scenario 2: flags acute clinical emergency and enforces mandatory emergency disclaimer', () => {
    const emergencyInput = 'همین الان درد شدید در قفسه سینه دارم و عرق سرد کردم';
    const evalResult = evaluateInputSafety(emergencyInput);

    expect(evalResult.severity).toBe('critical_emergency');
    expect(evalResult.requiresEmergencyCallout).toBe(true);
    expect(evalResult.blocksDirectPrescription).toBe(true);
    expect(evalResult.mandatoryDisclaimer).toContain('۱۱۵');
  });

  it('Scenario 3: extracts multiple recognized anatomical entities from a sentence', () => {
    const sentence = 'می‌خواهم اطلاعات مربوط به شریان آئورت و دریچه میترال را بدانم';
    const entities = extractRecognizedAnatomicalEntities(sentence, testGlossary);

    const organIds = entities.map((e) => e.organId);
    expect(organIds).toContain('aorta');
    expect(organIds).toContain('mitral_valve');
    expect(entities.length).toBe(2);
  });

  it('Edge Case A: empty or whitespace input handles cleanly without throwing', () => {
    const emptyResult = evaluateInputSafety('   ');
    expect(emptyResult.severity).toBe('safe_educational');
    expect(emptyResult.requiresEmergencyCallout).toBe(false);

    const emptyIntent = parseViewerCommandIntent('   ', testGlossary);
    expect(emptyIntent.actionType).toBe('none');
  });

  it('Edge Case B: bilingual / English terminology matches accurately', () => {
    const query = 'Show the Aorta and its position';
    const intent = parseViewerCommandIntent(query, testGlossary);

    expect(intent.actionType).toBe('focus_structure');
    expect(intent.targetOrganId).toBe('aorta');
  });

  it('Edge Case C: blocks drug dosage recommendation requests and provides clinical disclaimer', () => {
    const dosageQuery = 'دوز مصرف آسپرین برای بیمار چند میلی‌گرم است؟';
    const evalResult = evaluateInputSafety(dosageQuery);

    expect(evalResult.severity).toBe('dosage_inquiry');
    expect(evalResult.blocksDirectPrescription).toBe(true);
    expect(evalResult.mandatoryDisclaimer).toBeDefined();
  });
});
