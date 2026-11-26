/**
 * Cardiac Conduction System & 12-Lead Precordial Electrodes (Guyton & Hall 2026, Ch. 9 & 10)
 *
 * Implements authoritative mathematical representations, anatomical landmarks,
 * and electrical activation curves for:
 * 1. Sinoatrial (SA) node & Internodal Tracts (Bachmann, Wenckebach, Thorel)
 * 2. Atrioventricular (AV) node (Triangle of Koch)
 * 3. Atrioventricular Bundle of His
 * 4. Right & Left Bundle Branches (RBB, LBB)
 * 5. Subendocardial Purkinje arborization network
 * 6. Standard AHA/IEC 12-lead precordial chest electrodes (V1-V6)
 */

export interface ConductionNode {
  id: string;
  nameFa: string;
  nameEn: string;
  firingTime: number; // Normalized cycle timestamp (0.0 to 1.0)
  duration: number;
  relativeOffset: [number, number, number]; // Offset relative to cardiac center
  descriptionFa: string;
  descriptionEn: string;
}

export interface ConductionPath {
  id: string;
  nameFa: string;
  nameEn: string;
  sourceNodeId: string;
  targetNodeId: string;
  points: [number, number, number][]; // Relative spline points
}

export interface PrecordialElectrode {
  lead: "V1" | "V2" | "V3" | "V4" | "V5" | "V6";
  nameFa: string;
  nameEn: string;
  anatomicalLandmarkFa: string;
  anatomicalLandmarkEn: string;
  standardColorHex: string; // AHA/IEC standard color code
  relativePosition: [number, number, number]; // Position relative to cardiac / sternal center
  clinicalSignificanceFa: string;
  clinicalSignificanceEn: string;
}

export const CONDUCTION_NODES: ConductionNode[] = [
  {
    id: "sa_node",
    nameFa: "گره سینوسی-دهلیزی (SA Node / ضربان‌ساز طبیعی)",
    nameEn: "Sinoatrial Node (Primary Pacemaker)",
    firingTime: 0.0,
    duration: 0.08,
    relativeOffset: [-0.022, 0.038, 0.015],
    descriptionFa:
      "ضربان‌ساز اولیه قلب در پیوستگاه ورید اجوف فوقانی و دهلیز راست؛ تولید خودکار پتانسیل عمل با نرخ ۶۰-۱۰۰ ضربان در دقیقه.",
    descriptionEn:
      "Primary physiological pacemaker located at junction of SVC and right atrium; self-depolarizes at 60-100 bpm.",
  },
  {
    id: "bachmann_tract",
    nameFa: "دسته قدامی باخمن (Bachmann's Bundle)",
    nameEn: "Bachmann's Bundle (Interatrial Band)",
    firingTime: 0.04,
    duration: 0.06,
    relativeOffset: [0.015, 0.032, 0.01],
    descriptionFa:
      "شاخه بین‌دهلیزی هدایت سریع جریان الکتریکی از دهلیز راست به دهلیز چپ جهت انقباض همزمان هر دو دهلیز.",
    descriptionEn:
      "Interatrial conduction band transmitting impulse rapidly across to left atrium for synchronized atrial contraction.",
  },
  {
    id: "av_node",
    nameFa: "گره دهلیزی-بطنی (AV Node)",
    nameEn: "Atrioventricular Node",
    firingTime: 0.1,
    duration: 0.09,
    relativeOffset: [-0.003, 0.008, 0.012],
    descriptionFa:
      "واقع در مثلث کوخ در کف دهلیز راست؛ ایجاد تاخیر فیزیولوژیک ۰٫۰۹ ثانیه‌ای جهت پر شدن کامل بطن‌ها پیش از انقباض.",
    descriptionEn:
      "Located in triangle of Koch; introduces crucial 0.09s delay enabling complete ventricular filling prior to systole.",
  },
  {
    id: "bundle_of_his",
    nameFa: "دسته‌بندی هیس (AV Bundle of His)",
    nameEn: "Bundle of His (Common Trunk)",
    firingTime: 0.16,
    duration: 0.04,
    relativeOffset: [0.002, -0.012, 0.008],
    descriptionFa:
      "تنها راه ارتباطی الکتریکی از میان اسکلت عایق فیبری قلب (Annulus Fibrosus) به بالای سپتوم بین بطنی.",
    descriptionEn:
      "Sole conductive pathway piercing the insulating fibrous skeleton into upper interventricular septum.",
  },
  {
    id: "right_bundle_branch",
    nameFa: "شاخه دسته‌ای راست (RBB)",
    nameEn: "Right Bundle Branch",
    firingTime: 0.18,
    duration: 0.06,
    relativeOffset: [-0.018, -0.038, 0.018],
    descriptionFa:
      "حرکت در امتداد سمت راست سپتوم بین بطنی، عبور از ترابکولا سپتومارژینال (باندمودریتور) تا عضلات پاپیلاری راست.",
    descriptionEn:
      "Courses along right side of septum, traversing septomarginal trabecula (moderator band) to anterior papillary muscle.",
  },
  {
    id: "left_bundle_branch",
    nameFa: "شاخه دسته‌ای چپ (LBB)",
    nameEn: "Left Bundle Branch",
    firingTime: 0.18,
    duration: 0.06,
    relativeOffset: [0.022, -0.038, 0.002],
    descriptionFa:
      "تقسیم به فاسیکل قدامی چپ (LAF) و فاسیکل خلفی چپ (LPF) جهت دپولاریزاسیون سریع دیواره ضخیم و پرفشار بطن چپ.",
    descriptionEn:
      "Divides into anterior and posterior fascicles to depolarize the thick high-pressure left ventricular myocardium.",
  },
  {
    id: "purkinje_network",
    nameFa: "شبکه الیاف پورکینژ (Purkinje Fiber System)",
    nameEn: "Purkinje Arborization Network",
    firingTime: 0.22,
    duration: 0.08,
    relativeOffset: [0.008, -0.065, 0.012],
    descriptionFa:
      "شبکه وسیع زیر اندوکاردی با بالاترین سرعت هدایت در بافت زنده (۴ متر بر ثانیه)؛ هدایت موج تحریک از رأس (Apex) به قاعده بطن‌ها.",
    descriptionEn:
      "Subendocardial arborization with maximum conduction velocity (4 m/s) initiating apex-to-base ventricular contraction.",
  },
];

export const CONDUCTION_PATHS: ConductionPath[] = [
  {
    id: "sa_to_bachmann",
    nameFa: "مسیر گره SA به دهلیز چپ",
    nameEn: "SA Node to Left Atrium",
    sourceNodeId: "sa_node",
    targetNodeId: "bachmann_tract",
    points: [
      [-0.022, 0.038, 0.015],
      [-0.005, 0.036, 0.014],
      [0.015, 0.032, 0.01],
    ],
  },
  {
    id: "sa_to_av",
    nameFa: "راه‌های بین‌گرهی قدامی، میانی و خلفی (Tracts)",
    nameEn: "Internodal Tracts to AV Node",
    sourceNodeId: "sa_node",
    targetNodeId: "av_node",
    points: [
      [-0.022, 0.038, 0.015],
      [-0.018, 0.024, 0.016],
      [-0.003, 0.008, 0.012],
    ],
  },
  {
    id: "av_to_his",
    nameFa: "مجرای نفوذ گره AV به دسته هیس",
    nameEn: "AV Node to Bundle of His",
    sourceNodeId: "av_node",
    targetNodeId: "bundle_of_his",
    points: [
      [-0.003, 0.008, 0.012],
      [-0.001, -0.002, 0.01],
      [0.002, -0.012, 0.008],
    ],
  },
  {
    id: "his_to_rbb",
    nameFa: "دسته هیس به شاخه راست",
    nameEn: "Bundle of His to Right Bundle",
    sourceNodeId: "bundle_of_his",
    targetNodeId: "right_bundle_branch",
    points: [
      [0.002, -0.012, 0.008],
      [-0.008, -0.025, 0.012],
      [-0.018, -0.038, 0.018],
    ],
  },
  {
    id: "his_to_lbb",
    nameFa: "دسته هیس به شاخه چپ",
    nameEn: "Bundle of His to Left Bundle",
    sourceNodeId: "bundle_of_his",
    targetNodeId: "left_bundle_branch",
    points: [
      [0.002, -0.012, 0.008],
      [0.012, -0.025, 0.006],
      [0.022, -0.038, 0.002],
    ],
  },
  {
    id: "bundles_to_purkinje",
    nameFa: "شاخه‌های بطنی به شبکه پورکینژ",
    nameEn: "Bundle Branches to Purkinje Network",
    sourceNodeId: "right_bundle_branch",
    targetNodeId: "purkinje_network",
    points: [
      [-0.018, -0.038, 0.018],
      [-0.005, -0.052, 0.015],
      [0.008, -0.065, 0.012],
    ],
  },
];

export const PRECORDIAL_ELECTRODES: PrecordialElectrode[] = [
  {
    lead: "V1",
    nameFa: "لید V1 (قرمز)",
    nameEn: "Lead V1 (Red)",
    anatomicalLandmarkFa: "فضای بین‌دنده‌ای چهارم (4th ICS) در لبه راست استخوان استرنوم",
    anatomicalLandmarkEn: "Fourth intercostal space at right sternal border",
    standardColorHex: "#e53935",
    relativePosition: [-0.025, 0.035, 0.09],
    clinicalSignificanceFa:
      "مشاهده مستقیم دپولاریزاسیون سپتوم و بطن راست؛ تشخیص بلوک شاخه‌ای راست (RBBB - شکل rSR') و هیپرتروفی بطن راست (RVH).",
    clinicalSignificanceEn:
      "Direct view of septum and right ventricle; diagnostic for RBBB (rSR' pattern) and RV hypertrophy.",
  },
  {
    lead: "V2",
    nameFa: "لید V2 (زرد)",
    nameEn: "Lead V2 (Yellow)",
    anatomicalLandmarkFa: "فضای بین‌دنده‌ای چهارم (4th ICS) در لبه چپ استخوان استرنوم",
    anatomicalLandmarkEn: "Fourth intercostal space at left sternal border",
    standardColorHex: "#fdd835",
    relativePosition: [0.025, 0.035, 0.09],
    clinicalSignificanceFa:
      "ارزیابی سپتوم بین بطنی؛ حساس‌ترین لید برای سکته قلبی قدامی-سپتال (STEMI قدامی با بالا رفتن قطعه ST).",
    clinicalSignificanceEn:
      "Septal lead; highly sensitive for acute anteroseptal myocardial infarction (ST elevation).",
  },
  {
    lead: "V3",
    nameFa: "لید V3 (سبز)",
    nameEn: "Lead V3 (Green)",
    anatomicalLandmarkFa: "نقطه میانی روی دنده پنجم بین لید V2 و لید V4",
    anatomicalLandmarkEn: "Midway between leads V2 and V4 (over 5th rib)",
    standardColorHex: "#43a047",
    relativePosition: [0.05, 0.015, 0.085],
    clinicalSignificanceFa:
      "ارزیابی جدار قدامی بطن چپ؛ نشان‌دهنده تغییر جهت امواج الکتریکی (Transition Zone R/S).",
    clinicalSignificanceEn:
      "Anterior wall of left ventricle; typically displays R/S transition zone in healthy individuals.",
  },
  {
    lead: "V4",
    nameFa: "لید V4 (قهوه‌ای)",
    nameEn: "Lead V4 (Brown)",
    anatomicalLandmarkFa: "فضای بین‌دنده‌ای پنجم (5th ICS) در خط میدکلاویکولار چپ (محل ضربه نوک قلب / PMI)",
    anatomicalLandmarkEn: "Fifth intercostal space in left midclavicular line (apex beat / PMI)",
    standardColorHex: "#8d6e63",
    relativePosition: [0.08, -0.01, 0.075],
    clinicalSignificanceFa:
      "دید مستقیم از آپکس (نوک قلب) بطن چپ؛ موج R بلند در افراد سالم؛ شاخص کلیدی هیپرتروفی بطن چپ (Sokolow-Lyon).",
    clinicalSignificanceEn:
      "Direct view of left ventricular apex; tall R wave; primary electrode for Sokolow-Lyon LVH criteria.",
  },
  {
    lead: "V5",
    nameFa: "لید V5 (سیاه)",
    nameEn: "Lead V5 (Black)",
    anatomicalLandmarkFa: "فضای بین‌دنده‌ای پنجم در خط قدامی زیربغلی چپ (هم‌سطح با V4)",
    anatomicalLandmarkEn: "Fifth intercostal space in left anterior axillary line (horizontal to V4)",
    standardColorHex: "#212121",
    relativePosition: [0.105, -0.01, 0.05],
    clinicalSignificanceFa:
      "لید لترال تحتانی بطن چپ؛ بررسی ایسکمی لترال و انفارکتوس شریان سیرکومفلکس (LCx).",
    clinicalSignificanceEn:
      "Low lateral left ventricle; detects lateral ischemia and LCx coronary artery occlusion.",
  },
  {
    lead: "V6",
    nameFa: "لید V6 (بنفش)",
    nameEn: "Lead V6 (Violet)",
    anatomicalLandmarkFa: "فضای بین‌دنده‌ای پنجم در خط میانی زیربغلی چپ (هم‌سطح با V4 و V5)",
    anatomicalLandmarkEn: "Fifth intercostal space in left midaxillary line (horizontal to V4)",
    standardColorHex: "#8e24aa",
    relativePosition: [0.12, -0.01, 0.015],
    clinicalSignificanceFa:
      "لید لترال حقیقی بطن چپ؛ ارزیابی همزمان با V5 و لیدهای اندامی I و aVL جهت تشخیص انفارکتوس لترال وسیع.",
    clinicalSignificanceEn:
      "True lateral left ventricle; combined with V5, I, and aVL to diagnose extensive lateral MI.",
  },
];

/**
 * Calculates current electrical excitation state of a conduction node given normalized cycle phase (0.0 to 1.0).
 * Returns excitation intensity from 0.0 (quiescent) to 1.0 (peak depolarization).
 */
export function calculateNodeExcitation(node: ConductionNode, normalizedPhase: number): number {
  const dt = normalizedPhase - node.firingTime;
  if (dt < 0 || dt > node.duration) return 0;
  // Sinusoidal bell-curve pulse
  const progress = dt / node.duration;
  return Math.sin(progress * Math.PI);
}
