/**
 * TA2 Surface Landmarks & Bony Prominences Catalog
 *
 * Maps detailed Terminologia Anatomica 2 (TA2) bony landmarks, tubercles,
 * processes, and fossae directly onto parent skeletal meshes using normalized
 * local bounding-box coordinates [0..1] per axis.
 */

export interface SurfaceLandmark {
  id: string;
  parentOrganId: string;
  ta2Id: string;
  ta2Latin: string;
  nameFa: string;
  nameEn: string;
  /** Normalized position within parent bone's world Box3: 0=min, 1=max */
  normalizedBoxPos: [number, number, number];
  clinicalNoteFa: string;
  clinicalNoteEn: string;
}

export const SURFACE_LANDMARKS_CATALOG: SurfaceLandmark[] = [
  // Femur (Left)
  {
    id: "femur_l_greater_trochanter",
    parentOrganId: "femur_l",
    ta2Id: "TA2:1363",
    ta2Latin: "Trochanter major",
    nameFa: "تروکانتر بزرگ فمور (چپ)",
    nameEn: "Greater trochanter (Left)",
    normalizedBoxPos: [0.85, 0.93, 0.45],
    clinicalNoteFa: "محل اتصال عضلات گلوتئوس مدیوس/مینیموس و پیریفورمیس؛ نشانهٔ سطحی در معاینهٔ لگن.",
    clinicalNoteEn: "Insertion of gluteus medius/minimus and piriformis; palpable lateral hip landmark.",
  },
  {
    id: "femur_l_lesser_trochanter",
    parentOrganId: "femur_l",
    ta2Id: "TA2:1366",
    ta2Latin: "Trochanter minor",
    nameFa: "تروکانتر کوچک فمور (چپ)",
    nameEn: "Lesser trochanter (Left)",
    normalizedBoxPos: [0.35, 0.85, 0.28],
    clinicalNoteFa: "محل اتصال تاندون عضلهٔ ایلیوپسواس (قوی‌ترین فلکسور ران).",
    clinicalNoteEn: "Insertion of iliopsoas tendon (primary hip flexor).",
  },
  {
    id: "femur_l_neck",
    parentOrganId: "femur_l",
    ta2Id: "TA2:1362",
    ta2Latin: "Collum femoris",
    nameFa: "گردن آناتومیک فمور (چپ)",
    nameEn: "Neck of femur (Left)",
    normalizedBoxPos: [0.32, 0.94, 0.5],
    clinicalNoteFa: "محل شایع شکستگی در سالمندان؛ خطر نکروز آواسکولار سر فمور (شریان سیرکومفلکس مدیکال).",
    clinicalNoteEn: "Common fracture site in osteoporotic elderly; risk of avascular necrosis of femoral head.",
  },
  {
    id: "femur_l_medial_epicondyle",
    parentOrganId: "femur_l",
    ta2Id: "TA2:1379",
    ta2Latin: "Epicondylus medialis",
    nameFa: "اپی‌کندیل داخلی فمور (چپ)",
    nameEn: "Medial epicondyle of femur (Left)",
    normalizedBoxPos: [0.18, 0.08, 0.5],
    clinicalNoteFa: "محل اتصال رباط جانبی داخلی زانو (MCL) و توبرکل ادکتور.",
    clinicalNoteEn: "Attachment of medial collateral ligament (MCL) and adductor tubercle.",
  },

  // Humerus (Left)
  {
    id: "humerus_l_greater_tubercle",
    parentOrganId: "humerus_l",
    ta2Id: "TA2:1203",
    ta2Latin: "Tuberculum majus",
    nameFa: "توبرکل بزرگ هومروس (چپ)",
    nameEn: "Greater tubercle of humerus (Left)",
    normalizedBoxPos: [0.85, 0.95, 0.55],
    clinicalNoteFa: "محل اتصال عضلات روتاتور کاف: سوپرااسپیناتوس، اینفرااسپیناتوس و ترس مینور (SIT).",
    clinicalNoteEn: "Insertion of rotator cuff muscles: Supraspinatus, Infraspinatus, Teres minor.",
  },
  {
    id: "humerus_l_deltoid_tuberosity",
    parentOrganId: "humerus_l",
    ta2Id: "TA2:1211",
    ta2Latin: "Tuberositas deltoidea",
    nameFa: "توبروزیتهٔ دلتوئید هومروس (چپ)",
    nameEn: "Deltoid tuberosity (Left)",
    normalizedBoxPos: [0.78, 0.56, 0.55],
    clinicalNoteFa: "محل اتصال عضلهٔ دلتوئید؛ شکستگی تنهٔ هومروس زیر این نقطه عصب رادیال را تهدید می‌کند.",
    clinicalNoteEn: "Deltoid insertion; midshaft fractures near radial groove risk radial nerve palsy (wrist drop).",
  },
  {
    id: "humerus_l_medial_epicondyle",
    parentOrganId: "humerus_l",
    ta2Id: "TA2:1219",
    ta2Latin: "Epicondylus medialis",
    nameFa: "اپی‌کندیل داخلی هومروس (چپ)",
    nameEn: "Medial epicondyle of humerus (Left)",
    normalizedBoxPos: [0.12, 0.06, 0.45],
    clinicalNoteFa: "عبور عصب اولنار از ناودان خلفی آن (Funny bone)؛ منشأ فلکسورهای ساعد (Golfer's elbow).",
    clinicalNoteEn: "Ulnar nerve courses posteriorly in cubital tunnel; common flexor origin.",
  },

  // Scapula (Left)
  {
    id: "scapula_l_acromion",
    parentOrganId: "scapula_l",
    ta2Id: "TA2:1174",
    ta2Latin: "Acromion",
    nameFa: "زائدهٔ آخرمی / آکرومیون کتف (چپ)",
    nameEn: "Acromion of scapula (Left)",
    normalizedBoxPos: [0.92, 0.92, 0.65],
    clinicalNoteFa: "نقطهٔ مرجع اندازه‌گیری طول اندام فوقانی و مفصل آکرومیوکلاویکولار (AC).",
    clinicalNoteEn: "Forms acromioclavicular (AC) joint; roof of subacromial impingement space.",
  },
  {
    id: "scapula_l_coracoid",
    parentOrganId: "scapula_l",
    ta2Id: "TA2:1185",
    ta2Latin: "Processus coracoideus",
    nameFa: "زائدهٔ غرابی / کوراکوئید کتف (چپ)",
    nameEn: "Coracoid process (Left)",
    normalizedBoxPos: [0.75, 0.85, 0.92],
    clinicalNoteFa: "محل اتصال سر کوتاه بایسپس، کوراکوبراکیالیس و پکتورالیس مینور (محافظ شبکهٔ بازویی).",
    clinicalNoteEn: "Attachment of short head of biceps, coracobrachialis, and pectoralis minor.",
  },

  // Sternum & Pelvis
  {
    id: "sternum_angle_of_louis",
    parentOrganId: "manubrium_of_sternum",
    ta2Id: "TA2:1113",
    ta2Latin: "Angulus sterni",
    nameFa: "زاویهٔ استرنال (زاویهٔ لوئیس)",
    nameEn: "Sternal angle (Angle of Louis)",
    normalizedBoxPos: [0.5, 0.05, 0.85],
    clinicalNoteFa: "هم‌تراز با غضروف دندهٔ دوم، دو شاخه شدن نای (کارینا)، قوس آئورت و مهرهٔ T4-T5.",
    clinicalNoteEn: "Landmark for 2nd costal cartilage, tracheal bifurcation (carina), aortic arch, and T4-T5 disc.",
  },
  {
    id: "sternum_xiphoid",
    parentOrganId: "body_of_sternum",
    ta2Id: "TA2:1115",
    ta2Latin: "Processus xiphoideus",
    nameFa: "زائدهٔ خنجری (زایفوئید)",
    nameEn: "Xiphoid process",
    normalizedBoxPos: [0.5, 0.05, 0.8],
    clinicalNoteFa: "هم‌تراز با مهرهٔ T9؛ نشانهٔ مهم در محل قرارگیری دست حین احیای قلبی-ریوی (CPR).",
    clinicalNoteEn: "T9 vertebral level; inferior sternal landmark avoiding hepatic laceration during CPR.",
  },
  {
    id: "hip_bone_l_asis",
    parentOrganId: "hip_bone_l",
    ta2Id: "TA2:1302",
    ta2Latin: "Spina iliaca anterior superior",
    nameFa: "خار خاصره قدامی فوقانی (ASIS چپ)",
    nameEn: "Anterior superior iliac spine (Left ASIS)",
    normalizedBoxPos: [0.92, 0.82, 0.9],
    clinicalNoteFa: "مبدأ رباط اینگوینال (پوپارت) و عضلهٔ سارتوریوس؛ مرجع اندازه‌گیری طول واقعی اندام تحتانی.",
    clinicalNoteEn: "Origin of inguinal ligament and sartorius; true leg length measurement landmark.",
  },
  {
    id: "hip_bone_l_iliac_crest",
    parentOrganId: "hip_bone_l",
    ta2Id: "TA2:1299",
    ta2Latin: "Crista iliaca",
    nameFa: "ستیغ خاصره (Iliac Crest چپ)",
    nameEn: "Iliac crest (Left)",
    normalizedBoxPos: [0.65, 0.98, 0.55],
    clinicalNoteFa: "بالاترین لبهٔ آن خط توفیه (Tuffier's Line) را در سطح مهرهٔ L4 برای پونکسیون کمری می‌سازد.",
    clinicalNoteEn: "Highest point defines Tuffier's line (L4 level) for Lumbar Puncture.",
  },
  {
    id: "ulna_l_olecranon",
    parentOrganId: "ulna_l",
    ta2Id: "TA2:1244",
    ta2Latin: "Olecranon",
    nameFa: "زائدهٔ آرنجی / اوله‌کرانون اولنا (چپ)",
    nameEn: "Olecranon process (Left)",
    normalizedBoxPos: [0.5, 0.96, 0.15],
    clinicalNoteFa: "محل اتصال تاندون عضلهٔ ترایسپس براکیال؛ معاینهٔ مثلث هوتر در دررفتگی آرنج.",
    clinicalNoteEn: "Insertion of triceps brachii; forms Hueter's triangle with humeral epicondyles.",
  },
];

export function landmarksForOrgan(organId: string): SurfaceLandmark[] {
  return SURFACE_LANDMARKS_CATALOG.filter((l) => l.parentOrganId === organId);
}
