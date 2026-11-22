/**
 * Hoomaan 3D Anatomy Platform - Asset Pipeline
 * Terminologia Anatomica 2 (TA2) Indexing and Nomenclature Resolution.
 */

const CANONICAL_LATIN_CORRECTIONS = [
  ["coeliac trunk", "Truncus coeliacus"],
  ["superior mesenteric artery", "Arteria mesenterica superior"],
  ["lateral retromalleolar region", "Regio retromalleolaris lateralis"],
  ["medial retromalleolar region", "Regio retromalleolaris medialis"],
  ["superficial investing cervical fascia", "Fascia investiens superficialis colli"],
  ["medial reticulospinal tract", "Tractus reticulospinalis medialis"],
  ["medial head of triceps brachii", "Caput mediale musculi tricipitis brachii"],
  ["flexor digitorum superficialis", "Flexor superficialis digitorum"],
  ["flexor digiti minimi of foot", "Flexor digiti minimi pedis"],
  ["inferior thyroid artery", "Arteria thyreoidea inferior"],
  ["transverse cervical artery", "Arteria transversa colli"],
  ["middle cardiac vein", "Vena media cordis"],
  ["lateral axillary nodes", "Nodi axillares laterales"],
  ["posterior axillary nodes", "Nodi axillares posteriores"],
  ["anterior axillary nodes", "Nodi axillares anteriores"],
  ["infraclavicular nodes", "Nodi infraclaviculares"],
  ["anterior interventricular artery", "Arteria interventricularis anterior"],
  ["septal branches of anterior interventricular artery", "Rami septales arteriae interventricularis anterioris"],
  ["posterior division of internal iliac artery", "Divisio posterior arteriae iliacae internae"],
  ["frontal branch of superficial temporal artery", "Ramus frontalis arteriae temporalis superficialis"],
  ["frontal branches of callosomarginal artery", "Rami frontales arteriae callosomarginalis"],
  ["brainstem", "Truncus encephali"],
  ["parieto-occipital artery", "Arteria parietooccipitalis"],
  ["musculophrenic artery", "Arteria musculophrenica"],
  ["external pudendal veins", "Venae pudendales externae"],
  ["portal veins of hypophysis", "Venae portales hypophysiales"],
  ["medial vein of right lung", "Vena medialis pulmonis dextri"],
  ["lateral left branches of hepatic portal vein", "Rami sinistri laterales venae portae hepatis"],
  ["subcutaneous bursa of medial malleolus", "Bursa subcutanea malleoli medialis"],
  ["inferior pancreaticoduodenal artery", "Arteria pancreaticoduodenalis inferior"],
  ["ascending branch of left colic artery", "Ramus ascendens arteriae colicae sinistrae"],
  ["palmar carpal branch of radial artery", "Ramus carpeus palmaris arteriae radialis"],
  ["anterior division of retromandibular vein", "Divisio anterior venae retromandibularis"],
  ["medial circumflex femoral veins", "Venae circumflexae mediales femoris"],
  ["lateral circumflex femoral veins", "Venae circumflexae laterales femoris"],
  ["anterior root of posterior femoral cutaneous nerve", "Radix anterior nervi cutanei posterioris femoris"],
];

const CANONICAL_ENGLISH_CORRECTIONS = [
  ["lleocolic vein", "Ileocolic vein"],
];

const SUPPLEMENTARY_CORRECTIONS = [
  ["articular capsules of metatarsophalangeal joints", "Capsulae articulares articulationum metatarsophalangealium"],
  ["articular capsule of superior tibiofibular joint", "Capsula articularis tibiofibularis superior"],
  ["articular capsule of acromioclavicular joint", "Capsula articularis acromioclavicularis"],
  ["articular capsules of metacarpophalangeal joints", "Capsulae articulares articulationes metacarpophalangeae"],
  ["articular capsules of proximal interphalangeal joints", "Capsulae articulares articulationes interphalangeae proximales"],
  ["articular capsules of distal interphalangeal joints", "Capsulae articulares articulationes interphalangeae distales"],
  ["costal cartilage of first rib", "Cartilago costae primae"],
  ["costal cartilage of second rib", "Cartilago costae secundae"],
  ["costal cartilage of third rib", "Cartilago costae tertiae"],
  ["costal cartilage of fourth rib", "Cartilago costae quartae"],
  ["costal cartilage of fifth rib", "Cartilago costae quintae"],
  ["costal cartilage of sixth rib", "Cartilago costae sextae"],
  ["costal cartilage of seventh rib", "Cartilago costae septimae"],
  ["costal cartilage of eighth rib", "Cartilago costae octavae"],
  ["costal cartilage of tenth rib", "Cartilago costae decimae"],
  ["left renal artery", "Arteria renalis"],
  ["right renal artery", "Arteria renalis"],
];

export const TA2_CORRECTIONS = Object.freeze(
  Object.fromEntries([
    ...CANONICAL_LATIN_CORRECTIONS.map(([en, la]) => [en, { la }]),
    ...CANONICAL_ENGLISH_CORRECTIONS.map(([key, en]) => [key, { en }]),
  ]),
);

export const ADDED_TERM_CORRECTIONS = Object.freeze(
  Object.fromEntries(SUPPLEMENTARY_CORRECTIONS.map(([en, la]) => [en, { la }])),
);

export const ADDED_TERM_OPEN_QUESTIONS = Object.freeze({
  "articular capsule of elbow joint": "`articulation cubiti` — a raw fragment where a genitive belongs",
  "articular capsule of radiocarpal joint": "joint named in the nominative, not the genitive",
  "articular capsule of glenohumeral joint": "joint named in the nominative, not the genitive",
  "articular capsules of distal interphalangeal joints of foot":
    "`distali art. interphalangelorum` — abbreviated, and `interphalangelorum` is malformed",
  "articular capsules of proximal interphalangeal joints of foot":
    "`art. interphalangelorum prox.` — abbreviated, and `interphalangelorum` is malformed",
});

/**
 * Parser and search index builder for Terminologia Anatomica 2 (TA2).
 */
export class TerminologiaAnatomicaIndexer {
  constructor(
    patchRules = { ...TA2_CORRECTIONS, ...ADDED_TERM_CORRECTIONS },
    openQuestions = ADDED_TERM_OPEN_QUESTIONS,
  ) {
    this.overrides = patchRules;
    this.auditQuestions = openQuestions;
  }

  static stripDiacritics(text) {
    return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").normalize("NFC");
  }

  static toSlug(text) {
    return this.stripDiacritics(text)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  parse(rawCsv) {
    if (!rawCsv || rawCsv.trim().length === 0) {
      throw new Error("Empty TA2 CSV dataset provided.");
    }

    const cleanInput = rawCsv.charCodeAt(0) === 0xfeff ? rawCsv.slice(1) : rawCsv;
    const lines = cleanInput.split(/\r?\n/).filter((line) => line.trim().length > 0);

    if (lines.length < 2) {
      throw new Error("TA2 dataset does not contain enough records.");
    }

    const header = this.splitCsvLine(lines[0]);
    const englishIndex = header.indexOf("English");
    const latinIndex = header.indexOf("Latin");

    if (englishIndex === -1 || latinIndex === -1) {
      throw new Error(`TA2.csv missing required headers (English, Latin). Found: ${header.join(";")}`);
    }

    const dictionary = new Map();

    for (let i = 1; i < lines.length; i++) {
      const cells = this.splitCsvLine(lines[i]);
      if (cells.length !== header.length) continue;

      const rawEnglish = cells[englishIndex]?.trim();
      if (!rawEnglish) continue;

      const lookupKey = rawEnglish.toLowerCase();
      if (!dictionary.has(lookupKey)) {
        const patch = this.overrides[lookupKey];
        const rawLatin = cells[latinIndex]?.trim() ?? "";
        const cleanLatin = patch?.la ?? TerminologiaAnatomicaIndexer.stripDiacritics(rawLatin);
        const resolvedEnglish = patch?.en ?? rawEnglish;

        dictionary.set(lookupKey, {
          en: resolvedEnglish,
          la: cleanLatin,
        });
      }
    }

    // Verify all specified patches and questions exist in dictionary
    const expectedKeys = new Set([
      ...Object.keys(this.overrides),
      ...Object.keys(this.auditQuestions),
    ]);

    for (const key of expectedKeys) {
      if (!dictionary.has(key)) {
        throw new Error(`Correction specified for non-existent vocabulary key: "${key}".`);
      }
    }

    return dictionary;
  }

  splitCsvLine(line) {
    const unquoted = line.startsWith('"') && line.endsWith('"') ? line.slice(1, -1) : line;
    return unquoted.split(";");
  }
}

/**
 * Ingests semicolon-delimited TA2 CSV content and returns a dictionary indexed by lowercase English terms.
 * @param {string} rawCsv
 * @returns {Map<string, { en: string, la: string }>}
 */
export function parseTa2(rawCsv) {
  return new TerminologiaAnatomicaIndexer().parse(rawCsv);
}

/**
 * Deterministically transforms an anatomical name into a safe, normalized alphanumeric slug identifier.
 * @param {string} term
 * @returns {string}
 */
export function slugify(term) {
  return TerminologiaAnatomicaIndexer.toSlug(term);
}
