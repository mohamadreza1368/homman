/**
 * HOOMAAN Asset Pipeline - Terminologia Anatomica 2 (TA2) Indexer
 * Parses TA2 vocabulary standard, normalizes typographical anomalies,
 * removes diacritics from anatomical Latin, and provides deterministic organ slugification.
 */

export const TA2_CORRECTIONS = {
  "coeliac trunk": { la: "Truncus coeliacus" },
  "superior mesenteric artery": { la: "Arteria mesenterica superior" },
  "lleocolic vein": { en: "Ileocolic vein" },
  "lateral retromalleolar region": { la: "Regio retromalleolaris lateralis" },
  "medial retromalleolar region": { la: "Regio retromalleolaris medialis" },
  "superficial investing cervical fascia": { la: "Fascia investiens superficialis colli" },
  "medial reticulospinal tract": { la: "Tractus reticulospinalis medialis" },
  "medial head of triceps brachii": { la: "Caput mediale musculi tricipitis brachii" },
  "flexor digitorum superficialis": { la: "Flexor superficialis digitorum" },
  "flexor digiti minimi of foot": { la: "Flexor digiti minimi pedis" },
  "inferior thyroid artery": { la: "Arteria thyreoidea inferior" },
  "transverse cervical artery": { la: "Arteria transversa colli" },
  "middle cardiac vein": { la: "Vena media cordis" },
  "lateral axillary nodes": { la: "Nodi axillares laterales" },
  "posterior axillary nodes": { la: "Nodi axillares posteriores" },
  "anterior axillary nodes": { la: "Nodi axillares anteriores" },
  "infraclavicular nodes": { la: "Nodi infraclaviculares" },
  "anterior interventricular artery": { la: "Arteria interventricularis anterior" },
  "septal branches of anterior interventricular artery": {
    la: "Rami septales arteriae interventricularis anterioris",
  },
  "posterior division of internal iliac artery": {
    la: "Divisio posterior arteriae iliacae internae",
  },
  "frontal branch of superficial temporal artery": {
    la: "Ramus frontalis arteriae temporalis superficialis",
  },
  "frontal branches of callosomarginal artery": {
    la: "Rami frontales arteriae callosomarginalis",
  },
  brainstem: { la: "Truncus encephali" },
  "parieto-occipital artery": { la: "Arteria parietooccipitalis" },
  "musculophrenic artery": { la: "Arteria musculophrenica" },
  "external pudendal veins": { la: "Venae pudendales externae" },
  "portal veins of hypophysis": { la: "Venae portales hypophysiales" },
  "medial vein of right lung": { la: "Vena medialis pulmonis dextri" },
  "lateral left branches of hepatic portal vein": {
    la: "Rami sinistri laterales venae portae hepatis",
  },
  "subcutaneous bursa of medial malleolus": { la: "Bursa subcutanea malleoli medialis" },
  "inferior pancreaticoduodenal artery": { la: "Arteria pancreaticoduodenalis inferior" },
  "ascending branch of left colic artery": { la: "Ramus ascendens arteriae colicae sinistrae" },
  "palmar carpal branch of radial artery": { la: "Ramus carpeus palmaris arteriae radialis" },
  "anterior division of retromandibular vein": { la: "Divisio anterior venae retromandibularis" },
  "medial circumflex femoral veins": { la: "Venae circumflexae mediales femoris" },
  "lateral circumflex femoral veins": { la: "Venae circumflexae laterales femoris" },
  "anterior root of posterior femoral cutaneous nerve": {
    la: "Radix anterior nervi cutanei posterioris femoris",
  },
};

export const ADDED_TERM_CORRECTIONS = {
  "articular capsules of metatarsophalangeal joints": {
    la: "Capsulae articulares articulationum metatarsophalangealium",
  },
  "articular capsule of superior tibiofibular joint": {
    la: "Capsula articularis tibiofibularis superior",
  },
  "articular capsule of acromioclavicular joint": {
    la: "Capsula articularis acromioclavicularis",
  },
  "articular capsules of metacarpophalangeal joints": {
    la: "Capsulae articulares articulationes metacarpophalangeae",
  },
  "articular capsules of proximal interphalangeal joints": {
    la: "Capsulae articulares articulationes interphalangeae proximales",
  },
  "articular capsules of distal interphalangeal joints": {
    la: "Capsulae articulares articulationes interphalangeae distales",
  },
  "costal cartilage of first rib": { la: "Cartilago costae primae" },
  "costal cartilage of second rib": { la: "Cartilago costae secundae" },
  "costal cartilage of third rib": { la: "Cartilago costae tertiae" },
  "costal cartilage of fourth rib": { la: "Cartilago costae quartae" },
  "costal cartilage of fifth rib": { la: "Cartilago costae quintae" },
  "costal cartilage of sixth rib": { la: "Cartilago costae sextae" },
  "costal cartilage of seventh rib": { la: "Cartilago costae septimae" },
  "costal cartilage of eighth rib": { la: "Cartilago costae octavae" },
  "costal cartilage of tenth rib": { la: "Cartilago costae decimae" },
  "left renal artery": { la: "Arteria renalis" },
  "right renal artery": { la: "Arteria renalis" },
};

export const ADDED_TERM_OPEN_QUESTIONS = {
  "articular capsule of elbow joint": "`articulation cubiti` — a raw fragment where a genitive belongs",
  "articular capsule of radiocarpal joint": "joint named in the nominative, not the genitive",
  "articular capsule of glenohumeral joint": "joint named in the nominative, not the genitive",
  "articular capsules of distal interphalangeal joints of foot":
    "`distali art. interphalangelorum` — abbreviated, and `interphalangelorum` is malformed",
  "articular capsules of proximal interphalangeal joints of foot":
    "`art. interphalangelorum prox.` — abbreviated, and `interphalangelorum` is malformed",
};

/**
 * Strips diacritical accents from anatomical Latin to ensure standardized ASCII/NFC representations.
 */
function cleanLatinTerm(str) {
  return str.normalize("NFD").replace(/\p{Diacritic}/gu, "").normalize("NFC");
}

/**
 * Parses vendored semicolon-delimited TA2 standard and compiles an index keyed by lowercase English terms.
 * @param {string} rawCsv
 * @returns {Map<string, { en: string, la: string }>}
 */
export function parseTa2(rawCsv) {
  const sanitized = rawCsv.charCodeAt(0) === 0xfeff ? rawCsv.slice(1) : rawCsv;
  const rows = sanitized.split(/\r?\n/).map((r) => r.trim()).filter((r) => r.length > 0);

  if (rows.length === 0) {
    throw new Error("Empty TA2 CSV dataset provided.");
  }

  const unwrapRow = (line) => line.replace(/^"(.*)"$/, "$1").split(";");
  const headerCols = unwrapRow(rows[0]);
  const enIdx = headerCols.indexOf("English");
  const laIdx = headerCols.indexOf("Latin");

  if (enIdx === -1 || laIdx === -1) {
    throw new Error(`TA2.csv missing required headers (English, Latin). Found: ${headerCols.join(";")}`);
  }

  const overrides = { ...TA2_CORRECTIONS, ...ADDED_TERM_CORRECTIONS };
  const vocabularyMap = new Map();

  for (let i = 1; i < rows.length; i++) {
    const fields = unwrapRow(rows[i]);
    if (fields.length !== headerCols.length) continue;

    const rawEn = fields[enIdx]?.trim();
    if (!rawEn) continue;

    const lookupKey = rawEn.toLowerCase();
    if (!vocabularyMap.has(lookupKey)) {
      const patch = overrides[lookupKey];
      const parsedEn = patch?.en ?? rawEn;
      const parsedLa = patch?.la ?? cleanLatinTerm(fields[laIdx]?.trim() || "");

      vocabularyMap.set(lookupKey, {
        en: parsedEn,
        la: parsedLa,
      });
    }
  }

  // Sanity audit: verify all declared patches and notes match active dictionary terms
  const allAuditedKeys = [...Object.keys(overrides), ...Object.keys(ADDED_TERM_OPEN_QUESTIONS)];
  for (const requiredKey of allAuditedKeys) {
    if (!vocabularyMap.has(requiredKey)) {
      throw new Error(`Correction specified for non-existent vocabulary key: "${requiredKey}".`);
    }
  }

  return vocabularyMap;
}

/**
 * Deterministically transforms an anatomical name into a safe, normalized alphanumeric slug identifier.
 * @param {string} term
 * @returns {string}
 */
export function slugify(term) {
  return term
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
