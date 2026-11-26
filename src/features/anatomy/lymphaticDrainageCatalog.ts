/**
 * Lymphatic Sentinel Nodes & Metastatic Drainage Pathways
 * (Gray's Anatomy & Robbins Basic Pathology)
 */

export interface LymphaticDrainagePathway {
  id: string;
  primaryOrganFa: string;
  primaryOrganEn: string;
  sentinelNodesFa: string;
  sentinelNodesEn: string;
  clinicalPearlFa: string;
  clinicalPearlEn: string;
  organPatterns: RegExp[];
}

export const LYMPHATIC_DRAINAGE_CATALOG: LymphaticDrainagePathway[] = [
  {
    id: "stomach_virchow",
    primaryOrganFa: "معده و احشای فوقانی شکم",
    primaryOrganEn: "Stomach & Upper GI",
    sentinelNodesFa: "گره‌های سلیاک ← مجرای سینه‌ای ← گره سوپراکلاویکولار چپ (گرهٔ ویرشو / Troisier's Sign)",
    sentinelNodesEn: "Celiac nodes -> Thoracic duct -> Left supraclavicular (Virchow's) node",
    clinicalPearlFa: "بزرگی بدون درد گرهٔ سوپراکلاویکولار چپ (Virchow) نشانهٔ کلاسیک متاستاز آدنوکارسینوم معده یا احشای شکمی است.",
    clinicalPearlEn: "Palpable left supraclavicular node (Troisier sign) indicates metastatic GI/abdominal malignancy via thoracic duct.",
    organPatterns: [/^stomach$/i, /celiac_nodes/i, /supraclavicular_nodes/i, /thoracic_duct/i],
  },
  {
    id: "testis_para_aortic",
    primaryOrganFa: "بیضه (Testis) — تخلیه به پاراآئورتیک",
    primaryOrganEn: "Testis (Para-aortic Drainage)",
    sentinelNodesFa: "گره‌های لومبار / پاراآئورتیک (L1-L2) در طول عروق گونادال (برخلاف اسکروتوم!)",
    sentinelNodesEn: "Lumbar / Para-aortic nodes (L1-L2) along gonadal vessels (NOT superficial inguinal!)",
    clinicalPearlFa: "بیضه از حفرهٔ شکمی نزول کرده، لذا سرطان بیضه به پاراآئورتیک می‌رود؛ اما پوست اسکروتوم و آلت به اینگوینال سطحی تخلیه می‌شوند.",
    clinicalPearlEn: "Testicular cancer spreads to para-aortic nodes (embryologic origin); scrotal skin drains to superficial inguinal nodes.",
    organPatterns: [/testis/i, /lateral_aortic_nodes/i, /preaortic/i],
  },
  {
    id: "lung_mediastinal",
    primaryOrganFa: "ریه و برونش‌ها",
    primaryOrganEn: "Lungs & Bronchi",
    sentinelNodesFa: "گره‌های اینتراپولمونری ← برونکوپولمونری (ناف ریه) ← تراکئوبرونشیال ← پاراآتراکئال",
    sentinelNodesEn: "Intrapulmonary -> Hilar (Bronchopulmonary) -> Tracheobronchial -> Paratracheal",
    clinicalPearlFa: "لوب تحتانی ریهٔ چپ می‌تواند از طریق گره‌های کارینا (زیرتراکئال) به مدیاستن راست تخلیه متقاطع داشته باشد.",
    clinicalPearlEn: "Left lower lobe can cross over via subcarinal nodes to right paratracheal mediastinal chain.",
    organPatterns: [/lobe_of_.*lung/i, /tracheobronchial_nodes/i, /paratracheal/i],
  },
  {
    id: "upper_limb_breast_axillary",
    primaryOrganFa: "پستان و اندام فوقانی",
    primaryOrganEn: "Breast & Upper Limb",
    sentinelNodesFa: "گره‌های آگزیلاری قدامی (پکتورال - بیش از ۷۵٪) ← مرکزی ← آپیکال ← ساب‌کلاویکولار",
    sentinelNodesEn: "Anterior (pectoral) axillary nodes (>75%) -> Central -> Apical axillary nodes",
    clinicalPearlFa: "حین دایسکشن آگزیلاری، مراقب آسیب به عصب توراسیک دراز (Winged scapula) و عصب توراکودورسال باشید.",
    clinicalPearlEn: "Axillary lymph node dissection places long thoracic nerve (winged scapula) and thoracodorsal nerve at risk.",
    organPatterns: [/axillary_nodes/i, /pectoralis_major/i],
  },
];

export function getLymphaticDrainageForOrgan(organId: string): LymphaticDrainagePathway | undefined {
  return LYMPHATIC_DRAINAGE_CATALOG.find((l) => l.organPatterns.some((p) => p.test(organId)));
}
