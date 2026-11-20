/**
 * Clinical Safety, Triage & Command Dispatch Engine
 *
 * Implemented strictly from specs/clinical-chat-safety.md
 * Independent Clean-Room implementation for safety guardrails,
 * red-flag emergency detection, and anatomical intent dispatch.
 */

export type SafetySeverityLevel = 'safe_educational' | 'dosage_inquiry' | 'critical_emergency';

export interface TriageEvaluation {
  readonly severity: SafetySeverityLevel;
  readonly requiresEmergencyCallout: boolean;
  readonly blocksDirectPrescription: boolean;
  readonly mandatoryDisclaimer?: string;
}

export interface IntentDispatchResult {
  readonly actionType: 'none' | 'focus_structure' | 'isolate_structure';
  readonly targetOrganId?: string;
  readonly matchedKeyword?: string;
}

export interface AnatomicalEntityMatch {
  readonly organId: string;
  readonly matchedText: string;
  readonly startIndex: number;
  readonly endIndex: number;
}

export interface AnatomicalGlossaryItem {
  readonly id: string;
  readonly farsiTerms: readonly string[];
  readonly englishTerms: readonly string[];
}

const EMERGENCY_RED_FLAGS: readonly RegExp[] = [
  /(?:درد\s+شدید|تیر\s+کشیدن|سوزش\s+شدید).*(?:قفسه\s+سینه|قلب|بازو|پشت)/i,
  /(?:عرق\s+سرد|تنگی\s+نفس\s+شدید|سختی\s+تنفس)/i,
  /(?:سکته|بیهوش|افتادن\s+فشار|عدم\s+هوشیاری)/i,
  /(?:chest\s+pain|difficulty\s+breathing|loss\s+of\s+consciousness|severe\s+arrhythmia)/i,
];

const PRESCRIPTION_DOSAGE_FLAGS: readonly RegExp[] = [
  /(?:دوز|میزان\s+مصرف|چند\s+میلی[‌\s]?گرم|طریقه\s+مصرف|تجویز\s+دارو)/i,
  /(?:dosage|how\s+many\s+mg|prescription\s+dose|take\s+how\s+much)/i,
];

const NAVIGATION_FOCUS_CUES: readonly RegExp[] = [
  /(?:نشان\s+بده|نمایش\s+بده|کجاست|مشاهده|zoom|focus|show)/i,
];

const NAVIGATION_ISOLATE_CUES: readonly RegExp[] = [
  /(?:جدا\s+کن|تنها\s+نشان\s+بده|ایزوله\s+کن|isolate)/i,
];

const EMERGENCY_DISCLAIMER_TEXT =
  'این نرم‌افزار صرفاً جنبه آموزشی دارد و مرجع تشخیصی یا درمانی نیست. در شرایط حاد فوراً با اورژانس (۱۱۵) تماس بگیرید.';

const DOSAGE_DISCLAIMER_TEXT =
  'این اطلس آموزشی مجاز به تعیین یا توصیه دوز دارویی نیست. لطفاً با پزشک یا داروساز مشورت فرمایید.';

/**
 * Assesses input text for critical clinical red flags and medical prescription queries.
 */
export function evaluateInputSafety(inputText: string): TriageEvaluation {
  const normalized = inputText.trim();
  if (!normalized) {
    return {
      severity: 'safe_educational',
      requiresEmergencyCallout: false,
      blocksDirectPrescription: false,
    };
  }

  // 1. Check critical emergency cues
  for (const pattern of EMERGENCY_RED_FLAGS) {
    if (pattern.test(normalized)) {
      return {
        severity: 'critical_emergency',
        requiresEmergencyCallout: true,
        blocksDirectPrescription: true,
        mandatoryDisclaimer: EMERGENCY_DISCLAIMER_TEXT,
      };
    }
  }

  // 2. Check dosage / medication prescribing inquiries
  for (const pattern of PRESCRIPTION_DOSAGE_FLAGS) {
    if (pattern.test(normalized)) {
      return {
        severity: 'dosage_inquiry',
        requiresEmergencyCallout: false,
        blocksDirectPrescription: true,
        mandatoryDisclaimer: DOSAGE_DISCLAIMER_TEXT,
      };
    }
  }

  return {
    severity: 'safe_educational',
    requiresEmergencyCallout: false,
    blocksDirectPrescription: false,
  };
}

/**
 * Dispatches 3D viewer intent (e.g. focusing or isolating a structure) from prompt text.
 */
export function parseViewerCommandIntent(
  inputText: string,
  knownGlossary: readonly AnatomicalGlossaryItem[]
): IntentDispatchResult {
  const normalized = inputText.trim();
  if (!normalized) {
    return { actionType: 'none' };
  }

  // Determine action intent
  let action: 'focus_structure' | 'isolate_structure' | 'none' = 'none';
  if (NAVIGATION_ISOLATE_CUES.some((r) => r.test(normalized))) {
    action = 'isolate_structure';
  } else if (NAVIGATION_FOCUS_CUES.some((r) => r.test(normalized))) {
    action = 'focus_structure';
  }

  if (action === 'none') {
    return { actionType: 'none' };
  }

  // Search for the most specific matching organ in prompt
  for (const item of knownGlossary) {
    for (const term of item.farsiTerms) {
      if (normalized.includes(term)) {
        return {
          actionType: action,
          targetOrganId: item.id,
          matchedKeyword: term,
        };
      }
    }
    for (const term of item.englishTerms) {
      if (new RegExp(`\\b${term}\\b`, 'i').test(normalized)) {
        return {
          actionType: action,
          targetOrganId: item.id,
          matchedKeyword: term,
        };
      }
    }
  }

  return { actionType: 'none' };
}

/**
 * Extracts all recognized anatomical entities from a text block for contextual highlighting.
 * Uses greedy longest-match deduplication so that sub-phrases (e.g. "آئورت" inside "شریان آئورت")
 * are not duplicated.
 */
export function extractRecognizedAnatomicalEntities(
  content: string,
  glossary: readonly AnatomicalGlossaryItem[]
): readonly AnatomicalEntityMatch[] {
  const rawMatches: AnatomicalEntityMatch[] = [];

  for (const item of glossary) {
    const allTerms = [...item.farsiTerms, ...item.englishTerms];
    for (const term of allTerms) {
      let searchIndex = 0;
      const lowerContent = content.toLowerCase();
      const lowerTerm = term.toLowerCase();

      while (searchIndex < lowerContent.length) {
        const found = lowerContent.indexOf(lowerTerm, searchIndex);
        if (found === -1) break;

        rawMatches.push({
          organId: item.id,
          matchedText: content.substring(found, found + term.length),
          startIndex: found,
          endIndex: found + term.length,
        });

        searchIndex = found + term.length;
      }
    }
  }

  // Sort by span length descending so longer phrases take precedence
  rawMatches.sort((a, b) => (b.endIndex - b.startIndex) - (a.endIndex - a.startIndex));

  const filtered: AnatomicalEntityMatch[] = [];
  for (const match of rawMatches) {
    const overlaps = filtered.some(
      (existing) =>
        Math.max(match.startIndex, existing.startIndex) <
        Math.min(match.endIndex, existing.endIndex)
    );
    if (!overlaps) {
      filtered.push(match);
    }
  }

  // Return in original text appearance order
  return filtered.sort((a, b) => a.startIndex - b.startIndex);
}
