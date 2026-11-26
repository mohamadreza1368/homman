/**
 * Spinal Dermatomes & Myotomes Atlas (Snell's Clinical Neuroanatomy & Netter)
 *
 * Maps spinal nerve roots (C5-S1) to sensory skin regions, myotome skeletal
 * muscles, deep tendon reflexes (DTR), and disc herniation clinical syndromes.
 */

export interface SpinalRootProfile {
  root: string;
  region: "cervical" | "thoracic" | "lumbar" | "sacral";
  sensoryDermatomeFa: string;
  sensoryDermatomeEn: string;
  myotomeActionFa: string;
  myotomeActionEn: string;
  reflexFa: string;
  reflexEn: string;
  clinicalPearlFa: string;
  clinicalPearlEn: string;
  musclePatterns: RegExp[];
  skinPatterns: RegExp[];
}

export const SPINAL_ROOTS_CATALOG: SpinalRootProfile[] = [
  {
    root: "C5",
    region: "cervical",
    sensoryDermatomeFa: "پوست روی عضلهٔ دلتوئید و بخش خارجی بازو (Regiment badge area)",
    sensoryDermatomeEn: "Lateral arm over deltoid (regiment badge area)",
    myotomeActionFa: "ابداکشن شانه (دلتوئید) و فلکشن آرنج (بایسپس)",
    myotomeActionEn: "Shoulder abduction (deltoid) & elbow flexion (biceps)",
    reflexFa: "رفلکس دو سر بازویی (Biceps DTR)",
    reflexEn: "Biceps tendon reflex",
    clinicalPearlFa: "فتق دیسک C4-C5 به ریشهٔ C5 فشار می‌آورد؛ ضعف ابداکشن شانه و کاهش رفلکس بایسپس.",
    clinicalPearlEn: "C4-C5 disc herniation compresses C5 root; weak shoulder abduction and diminished biceps reflex.",
    musclePatterns: [/^deltoid/i, /^biceps_brachii/i, /^supraspinatus/i],
    skinPatterns: [/deltoid|lateral.*arm|shoulder/i],
  },
  {
    root: "C6",
    region: "cervical",
    sensoryDermatomeFa: "سمت خارجی ساعد، انگشت شست و انگشت اشاره",
    sensoryDermatomeEn: "Lateral forearm, thumb, and index finger",
    myotomeActionFa: "اکستنشن مچ دست و فلکشن آرنج (براکیورادیالیس)",
    myotomeActionEn: "Wrist extension & elbow flexion (brachioradialis)",
    reflexFa: "رفلکس براکیورادیالیس (C6) و بایسپس",
    reflexEn: "Brachioradialis reflex",
    clinicalPearlFa: "فتق دیسک C5-C6 ریشهٔ C6 را درگیر می‌کند؛ بی‌حسی انگشت شست و ضعف اکستنشن مچ.",
    clinicalPearlEn: "C5-C6 disc herniation affects C6; thumb numbness and weak wrist extension.",
    musclePatterns: [/^brachioradialis/i, /^extensor_carpi_radialis/i, /^biceps_brachii/i],
    skinPatterns: [/thumb|lateral.*forearm|thenar/i],
  },
  {
    root: "C7",
    region: "cervical",
    sensoryDermatomeFa: "انگشت میانی دست (Middle finger) و پشت ساعد",
    sensoryDermatomeEn: "Middle finger and posterior forearm",
    myotomeActionFa: "اکستنشن آرنج (ترایسپس) و فلکشن مچ دست",
    myotomeActionEn: "Elbow extension (triceps) and wrist flexion",
    reflexFa: "رفلکس سه سر بازویی (Triceps DTR)",
    reflexEn: "Triceps tendon reflex",
    clinicalPearlFa: "شایع‌ترین فتق دیسک گردنی (C6-C7) ریشهٔ C7 را درگیر می‌کند؛ افت رفلکس ترایسپس.",
    clinicalPearlEn: "Most common cervical radiculopathy (C6-C7 disc); weak triceps and loss of triceps reflex.",
    musclePatterns: [/^triceps_brachii/i, /^flexor_carpi_radialis/i, /^extensor_digitorum/i],
    skinPatterns: [/middle_finger|posterior.*forearm|palm/i],
  },
  {
    root: "C8",
    region: "cervical",
    sensoryDermatomeFa: "انگشت حلقه و کوچک دست و لبهٔ داخلی ساعد",
    sensoryDermatomeEn: "Ring and little fingers, medial forearm",
    myotomeActionFa: "فلکشن انگشتان دست (FDS/FDP) و قدرت چنگ زدن (Grip)",
    myotomeActionEn: "Finger flexion (FDS/FDP) and hand grip",
    reflexFa: "بدون رفلکس کلاسیک (معاینهٔ قدرت چنگش)",
    reflexEn: "No standard DTR (test finger flexors)",
    clinicalPearlFa: "درگیری در سندرم خروجی توراکس (Thoracic Outlet) یا فتق دیسک C7-T1.",
    clinicalPearlEn: "Compressed in C7-T1 herniation or lower trunk brachial plexopathy (Klumpke).",
    musclePatterns: [/^flexor_digitorum/i, /^flexor_carpi_ulnaris/i],
    skinPatterns: [/little_finger|medial.*forearm|hypothenar/i],
  },
  {
    root: "T4",
    region: "thoracic",
    sensoryDermatomeFa: "نوار افقی قفسه سینه در سطح نوک پستان‌ها (Nipple line)",
    sensoryDermatomeEn: "Horizontal chest band at nipple line",
    myotomeActionFa: "عضلات بین‌دنده‌ای (تنفسی)",
    myotomeActionEn: "Intercostal muscles",
    reflexFa: "رفلکس‌های بین‌دنده‌ای",
    reflexEn: "Intercostal reflex",
    clinicalPearlFa: "نشانهٔ مرجع کلیدی در تعیین سطح آسیب نخاع توراسیک یا ارتفاع بی‌حسی اسپاینال.",
    clinicalPearlEn: "Classic surface landmark for thoracic spinal cord level and neuraxial block height.",
    musclePatterns: [/intercostal/i],
    skinPatterns: [/mammary|pectoral|chest/i],
  },
  {
    root: "T10",
    region: "thoracic",
    sensoryDermatomeFa: "نوار افقی شکم در سطح ناف (Umbilicus)",
    sensoryDermatomeEn: "Horizontal abdominal band at umbilicus",
    myotomeActionFa: "عضلات دیوارهٔ شکم (رکتوس ابدومینیس)",
    myotomeActionEn: "Abdominal wall musculature",
    reflexFa: "رفلکس سطحی شکم (Abdominal cutaneous reflex)",
    reflexEn: "Superficial abdominal reflex",
    clinicalPearlFa: "درد ارجاعی ابتدایی آپاندیسیت حاد ابتدا در ناحیهٔ ناف (T10) حس می‌شود.",
    clinicalPearlEn: "Visceral pain of early acute appendicitis refers to the periumbilical T10 dermatome.",
    musclePatterns: [/^rectus_abdominis/i, /external_oblique/i],
    skinPatterns: [/umbilic/i, /abdomen/i],
  },
  {
    root: "L4",
    region: "lumbar",
    sensoryDermatomeFa: "بخش داخلی ساق پا تا قوزک داخلی (Medial malleolus)",
    sensoryDermatomeEn: "Medial leg extending over medial malleolus",
    myotomeActionFa: "دورسی‌فلکشن و اینورژن مچ پا (تیبیالیس قدامی) + اکستنشن زانو",
    myotomeActionEn: "Ankle dorsiflexion/inversion (tibialis anterior) & knee extension",
    reflexFa: "رفلکس کشککی زانو (Patellar DTR - L3/L4)",
    reflexEn: "Patellar (knee-jerk) reflex",
    clinicalPearlFa: "فتق دیسک L3-L4 به ریشهٔ L4 فشار می‌آورد؛ کاهش رفلکس زانو و ضعف تیبیالیس قدامی.",
    clinicalPearlEn: "L3-L4 disc herniation affects L4; diminished patellar reflex and weak heel-walking.",
    musclePatterns: [/^tibialis_anterior/i, /^quadriceps|^rectus_femoris|^vastus_/i],
    skinPatterns: [/medial.*leg|patell|knee/i],
  },
  {
    root: "L5",
    region: "lumbar",
    sensoryDermatomeFa: "بخش خارجی ساق، پشت پا و انگشت شست پا",
    sensoryDermatomeEn: "Anterolateral leg, dorsum of foot, and great toe",
    myotomeActionFa: "دورسی‌فلکشن شست پا (اکستنسور هالوسیس لونگوس) و ابداکشن ران",
    myotomeActionEn: "Great toe extension (EHL) and hip abduction",
    reflexFa: "رفلکس همسترینگ داخلی (کاهش جزئی)",
    reflexEn: "Medial hamstring reflex",
    clinicalPearlFa: "شایع‌ترین فتق دیسک کمری (L4-L5) ریشهٔ L5 را فشرده کرده و افتادگی پا (Foot Drop) ایجاد می‌کند.",
    clinicalPearlEn: "L4-L5 disc herniation compresses L5; causes weak great-toe dorsiflexion and foot drop.",
    musclePatterns: [/extensor_hallucis_longus/i, /extensor_digitorum_longus/i, /gluteus_medius/i],
    skinPatterns: [/dorsum.*foot|great_toe|anterolateral.*leg/i],
  },
  {
    root: "S1",
    region: "sacral",
    sensoryDermatomeFa: "لبهٔ خارجی پا، انگشت کوچک پا و کف پا",
    sensoryDermatomeEn: "Lateral border of foot, little toe, and sole",
    myotomeActionFa: "پلانتارفلکشن مچ پا (گاستروکنمیوس و سولئوس) و ایورژن پا",
    myotomeActionEn: "Ankle plantarflexion (gastrocnemius/soleus) & foot eversion",
    reflexFa: "رفلکس تاندون آشیل (Achilles / Ankle Jerk - S1)",
    reflexEn: "Achilles tendon reflex",
    clinicalPearlFa: "فتق دیسک L5-S1 ریشهٔ S1 را درگیر می‌کند؛ ناتوانی در راه رفتن روی پنجه و حذف رفلکس آشیل.",
    clinicalPearlEn: "L5-S1 disc herniation compresses S1; weak toe-walking and absent Achilles reflex.",
    musclePatterns: [/^gastrocnemius|^lateral_head_of_gastrocnemius|^medial_head_of_gastrocnemius/i, /^soleus/i, /fibularis_longus/i],
    skinPatterns: [/heel|sole|lateral.*foot/i],
  },
];
