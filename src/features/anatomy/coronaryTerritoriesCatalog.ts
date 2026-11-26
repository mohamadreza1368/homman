/**
 * Coronary Arterial Territories & 12-Lead ECG Infarction Mapping
 * (Braunwald's Heart Disease & Guyton & Hall)
 */

export interface CoronaryTerritory {
  id: string;
  nameFa: string;
  nameEn: string;
  ecgLeads: string[];
  myocardialTerritoryFa: string;
  myocardialTerritoryEn: string;
  conductionRiskFa: string;
  conductionRiskEn: string;
  clinicalPearlFa: string;
  clinicalPearlEn: string;
  organPatterns: RegExp[];
}

export const CORONARY_TERRITORIES_CATALOG: CoronaryTerritory[] = [
  {
    id: "lad_anterior",
    nameFa: "شریان نزولی قدامی چپ (LAD / Widows' Maker)",
    nameEn: "Left Anterior Descending (LAD) Territory",
    ecgLeads: ["V1", "V2", "V3", "V4"],
    myocardialTerritoryFa: "دیوارهٔ قدامی بطن چپ، ۲/۳ قدامی سپتوم بین‌بطنی و آپکس (نوک قلب)",
    myocardialTerritoryEn: "Anterior wall of LV, anterior 2/3 of interventricular septum, and cardiac apex",
    conductionRiskFa: "خطر بالای بلوک شاخه‌ای راست (RBBB)، بلوک فاسیکل قدامی چپ و بلوک کامل (Mobitz II)",
    conductionRiskEn: "High risk of RBBB, left anterior fascicular block (LAFB), and Mobitz II AV block",
    clinicalPearlFa: "شایع‌ترین رگ درگیر در سکتهٔ حاد قلبی (۴۰–۵۰٪ موارد)؛ بالا رفتن ST در V1 تا V4.",
    clinicalPearlEn: "Most frequently occluded coronary artery (40-50% of MIs); ST-elevation in V1-V4.",
    organPatterns: [/left_coronary_artery/i, /anterior_interventricular/i],
  },
  {
    id: "lcx_lateral",
    nameFa: "شریان سیرکومفلکس چپ (LCx)",
    nameEn: "Left Circumflex (LCx) Territory",
    ecgLeads: ["I", "aVL", "V5", "V6"],
    myocardialTerritoryFa: "دیوارهٔ طرفی (لترال) و خلفی-لترال بطن چپ",
    myocardialTerritoryEn: "Lateral and posterolateral walls of the left ventricle",
    conductionRiskFa: "تأمین خون گره SA در ۴۰٪ افراد؛ امکان آریتمی‌های دهلیزی.",
    conductionRiskEn: "Supplies SA node in ~40% of population; risk of atrial arrhythmias.",
    clinicalPearlFa: "تغییرات ST در لیدهای I, aVL (لترال بالا) و V5-V6 (لترال پایین)؛ افتادگی ST در V1-V3 نشانهٔ انفارکتوس خلفی است.",
    clinicalPearlEn: "ST-elevation in I, aVL, V5-V6; reciprocal ST-depression in V1-V3 signals posterior MI.",
    organPatterns: [/circumflex_artery_of_heart/i],
  },
  {
    id: "rca_inferior",
    nameFa: "شریان کرونری راست (RCA)",
    nameEn: "Right Coronary Artery (RCA) Territory",
    ecgLeads: ["II", "III", "aVF", "V4R"],
    myocardialTerritoryFa: "دیوارهٔ تحتانی بطن چپ، بطن راست (RV)، ۱/۳ خلفی سپتوم و عضله پاپیلاری خلفی-داخلی",
    myocardialTerritoryEn: "Inferior LV wall, right ventricle, posterior 1/3 of septum, posteromedial papillary muscle",
    conductionRiskFa: "تأمین خون گره SA (۶۰٪) و گره AV (۹۰٪) ← خطر برادی‌کاردی سینوسی و بلوک درجه ۱/ونکه‌باخ.",
    conductionRiskEn: "Supplies SA node (60%) & AV node (90%) -> sinus bradycardia, Mobitz I (Wenckebach).",
    clinicalPearlFa: "در انفارکتوس بطن راست (RCA پروگزیمال)، تجویز نیتروگلیسیرین می‌تواند باعث افت شدید فشار خون شود!",
    clinicalPearlEn: "In RV infarction (proximal RCA), preload-reducing nitrates cause severe hypotension.",
    organPatterns: [/right_coronary_artery/i, /right_inferolateral/i],
  },
];

export function getCoronaryTerritoryForOrgan(organId: string): CoronaryTerritory | undefined {
  return CORONARY_TERRITORIES_CATALOG.find((c) => c.organPatterns.some((p) => p.test(organId)));
}
