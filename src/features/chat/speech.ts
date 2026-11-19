import type { Language } from "@/lib/schemas";

/** Permitted playback speed range for Web Speech synthesis. */
export const VOICE_MIN_SPEED = 0.5;
export const VOICE_MAX_SPEED = 2.0;

/** Permitted output volume range. */
export const VOICE_MIN_VOLUME = 0.1;
export const VOICE_MAX_VOLUME = 1.0;

/** Default spoken language fallback when user preference is unset (auto). */
const AUTO_FALLBACK: Exclude<Language, "auto"> = "en";

/** Supported target speech languages in descending order of preference. */
const SPEAKABLE: readonly Exclude<Language, "auto">[] = ["en", "es", "bg"];

/** High-frequency grammatical function tokens for Spanish text classification. */
const SPANISH_STOPWORDS = new Set([
  "de", "la", "el", "que", "los", "las", "con", "para", "una", "del",
  "es", "en", "se", "por", "su", "al", "lo", "como", "más", "pero",
  "esta", "este", "son", "hacia", "entre", "cuando",
]);

/** High-frequency grammatical function tokens for English text classification. */
const ENGLISH_STOPWORDS = new Set([
  "the", "of", "and", "is", "to", "in", "that", "it", "for", "with",
  "as", "are", "was", "this", "from", "by", "an", "be", "or", "which",
  "into", "between", "when", "its",
]);

const THRESHOLD_MIN_MATCHES = 2;
const THRESHOLD_MIN_FREQUENCY = 0.12;

function extractPrimarySubtag(bcp47Tag: string): string {
  const [subtag] = bcp47Tag.toLowerCase().split(/[-_]/);
  return subtag ?? "";
}

/**
 * Filters and prioritizes local, non-cloud synthesizer voices installed on the host OS
 * matching the desired language subtag.
 */
export function voicesForLanguage(
  voiceCatalog: readonly SpeechSynthesisVoice[],
  targetLanguage: Language,
): SpeechSynthesisVoice[] {
  const normalizedLang = targetLanguage === "auto" ? AUTO_FALLBACK : targetLanguage;

  return voiceCatalog
    .filter((v) => v.localService && extractPrimarySubtag(v.lang) === normalizedLang)
    .sort((a, b) => {
      if (a.default !== b.default) {
        return a.default ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
}

/**
 * Heuristically identifies whether a text block is written in Bulgarian, Spanish, or English.
 * Returns null if the language cannot be resolved with high confidence or represents an unsupported locale.
 */
export function detectLanguage(prose: string): Exclude<Language, "auto"> | null {
  const cyrillicChars = (prose.match(/\p{Script=Cyrillic}/gu) ?? []).length;
  const latinChars = (prose.match(/\p{Script=Latin}/gu) ?? []).length;

  if (cyrillicChars > latinChars) {
    return "bg";
  }
  if (cyrillicChars === 0 && latinChars === 0) {
    return null;
  }

  // Characteristic orthographic marks unique to Spanish
  if (/[ñ¿¡]/i.test(prose)) {
    return "es";
  }

  const lexicalTokens = prose.toLowerCase().match(/[\p{Letter}]+/gu) ?? [];
  let scoreSpanish = 0;
  let scoreEnglish = 0;

  for (const token of lexicalTokens) {
    if (SPANISH_STOPWORDS.has(token)) {
      scoreSpanish += 1;
    } else if (ENGLISH_STOPWORDS.has(token)) {
      scoreEnglish += 1;
    }
  }

  // Include accented vowels as supporting indicator points for Spanish
  const accentedVowels = (prose.match(/[áéíóú]/gi) ?? []).length;
  scoreSpanish += accentedVowels;

  if (scoreSpanish === scoreEnglish) {
    return null;
  }

  const leadingScore = Math.max(scoreSpanish, scoreEnglish);
  if (leadingScore < THRESHOLD_MIN_MATCHES) {
    return null;
  }
  if (leadingScore / lexicalTokens.length < THRESHOLD_MIN_FREQUENCY) {
    return null;
  }

  return scoreSpanish > scoreEnglish ? "es" : "en";
}

/**
 * Resolves the effective speech synthesis language to use for an utterance.
 */
export function effectiveLanguage(
  configuredPreference: Language,
  proseContent: string,
): Exclude<Language, "auto"> | null {
  if (configuredPreference !== "auto") {
    return configuredPreference;
  }
  return detectLanguage(proseContent);
}

/**
 * Returns the subset of app-supported languages that have verified local voices installed on this host.
 */
export function speakableLanguages(
  availableVoices: readonly SpeechSynthesisVoice[],
): Exclude<Language, "auto">[] {
  return SPEAKABLE.filter((lang) => voicesForLanguage(availableVoices, lang).length > 0);
}

/**
 * Asynchronously retrieves installed browser voices, listening for the `voiceschanged` event
 * when Chromium's initial synchronous call returns an unpopulated list.
 */
export function loadVoices(
  synthesizer: SpeechSynthesis,
  timeoutMs = 2000,
): Promise<SpeechSynthesisVoice[]> {
  const initialBatch = synthesizer.getVoices();
  if (initialBatch.length > 0) {
    return Promise.resolve(initialBatch);
  }

  return new Promise((resolve) => {
    let resolved = false;

    const handleResolved = (results: SpeechSynthesisVoice[]) => {
      if (!resolved) {
        resolved = true;
        synthesizer.removeEventListener("voiceschanged", onVoiceChange);
        clearTimeout(timerId);
        resolve(results);
      }
    };

    const onVoiceChange = () => handleResolved(synthesizer.getVoices());
    const timerId = setTimeout(() => handleResolved(synthesizer.getVoices()), timeoutMs);

    synthesizer.addEventListener("voiceschanged", onVoiceChange);
  });
}
