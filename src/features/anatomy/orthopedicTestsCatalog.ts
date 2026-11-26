/**
 * Orthopedic Joint Special Tests & Ligament Injury Mechanisms
 * (Magee Orthopedic Physical Assessment & Bates')
 */

export interface OrthopedicTestProfile {
  id: string;
  jointFa: string;
  jointEn: string;
  testNameFa: string;
  testNameEn: string;
  structureTestedFa: string;
  structureTestedEn: string;
  techniqueFa: string;
  techniqueEn: string;
  positiveSignFa: string;
  positiveSignEn: string;
  organPatterns: RegExp[];
}

export const ORTHOPEDIC_TESTS_CATALOG: OrthopedicTestProfile[] = [
  {
    id: "acl_lachman",
    jointFa: "مفصل زانو",
    jointEn: "Knee Joint",
    testNameFa: "تست لاکمن (Lachman) و کشوی قدامی (Anterior Drawer)",
    testNameEn: "Lachman Test & Anterior Drawer Test",
    structureTestedFa: "رباط صلیبی قدامی (ACL)",
    structureTestedEn: "Anterior Cruciate Ligament (ACL)",
    techniqueFa: "زانو در ۲۰–۳۰ درجه فلکشن؛ ثابت کردن فمور با یک دست و کشیدن تیبیا به سمت قدام با دست دیگر.",
    techniqueEn: "Knee flexed 20-30°; stabilize distal femur and translate proximal tibia anteriorly.",
    positiveSignFa: "جابجایی بیش از حد قدامی تیبیا و فقدان نقطهٔ توقف سفت (Soft end-feel)؛ حساس‌ترین تست پارگی حاد ACL.",
    positiveSignEn: "Excessive anterior tibial translation with soft/absent endpoint (most sensitive test for ACL tear).",
    organPatterns: [/anterior_cruciate_ligament/i],
  },
  {
    id: "pcl_posterior_drawer",
    jointFa: "مفصل زانو",
    jointEn: "Knee Joint",
    testNameFa: "تست کشوی خلفی (Posterior Drawer) و افتادگی (Sag Sign)",
    testNameEn: "Posterior Drawer & Posterior Sag Sign",
    structureTestedFa: "رباط صلیبی خلفی (PCL)",
    structureTestedEn: "Posterior Cruciate Ligament (PCL)",
    techniqueFa: "زانو در ۹۰ درجه فلکشن؛ هل دادن تیبیا به سمت خلف (مکانیسم شایع: برخورد داشبورد خودرو به زانو).",
    techniqueEn: "Knee flexed 90°; apply posterior force to proximal tibia (dashboard injury mechanism).",
    positiveSignFa: "عقب‌رفتن غیرعادی توبروزیتهٔ تیبیا نسبت به کندیل‌های فمور.",
    positiveSignEn: "Posterior drop-back of tibial plateau relative to femoral condyles.",
    organPatterns: [/posterior_cruciate_ligament/i],
  },
  {
    id: "meniscus_mcmurray",
    jointFa: "مفصل زانو",
    jointEn: "Knee Joint",
    testNameFa: "تست مک‌موری (McMurray) — آسیب منیسک و تریاد ناخوشایند",
    testNameEn: "McMurray Test (Meniscal Tear / Unhappy Triad)",
    structureTestedFa: "منیسک‌های داخلی و خارجی زانو (+ درگیری همزمان ACL و MCL در تریاد اودونوگو)",
    structureTestedEn: "Medial & Lateral Menisci (Unhappy Triad: ACL + MCL + Medial Meniscus)",
    techniqueFa: "فلکشن کامل زانو، چرخش خارجی ساق + استرس والگوس هم‌زمان با اکستنشن تدریجی (برای منیسک داخلی).",
    techniqueEn: "Full knee flexion, external rotation + valgus stress while extending (tests medial meniscus).",
    positiveSignFa: "لمس یا شنیدن کلیک دردناک در خط مفصلی زانو.",
    positiveSignEn: "Palpable or audible painful click/clunk along the joint line.",
    organPatterns: [/menisc/i, /collateral_ligament.*knee/i],
  },
  {
    id: "rotator_cuff_hawkins",
    jointFa: "مفصل شانه",
    jointEn: "Shoulder Joint",
    testNameFa: "تست هاوکینز-کندی (Hawkins-Kennedy) و دراپ آرم",
    testNameEn: "Hawkins-Kennedy Impingement & Drop Arm Test",
    structureTestedFa: "تاندون عضلهٔ سوپرااسپیناتوس (روتاتور کاف) در فضای ساب‌آکرومیال",
    structureTestedEn: "Supraspinatus Tendon (Subacromial Impingement)",
    techniqueFa: "۹۰ درجه فلکشن قدامی شانه و آرنج، سپس چرخش داخلی اجباری بازو.",
    techniqueEn: "90° forward flexion of shoulder and elbow followed by forced internal rotation.",
    positiveSignFa: "درد تیز قدامی-لترال شانه به علت گیر افتادن تاندون سوپرااسپیناتوس زیر رباط کوراکوآکرومیال.",
    positiveSignEn: "Subacromial pain due to compression of supraspinatus tendon against coracoacromial arch.",
    organPatterns: [/supraspinatus/i, /infraspinatus/i, /subscapularis/i],
  },
  {
    id: "hip_trendelenburg",
    jointFa: "مفصل ران",
    jointEn: "Hip Joint",
    testNameFa: "تست ترندلنبرگ (Trendelenburg Sign)",
    testNameEn: "Trendelenburg Sign",
    structureTestedFa: "عضلهٔ گلوتئوس مدیوس و مینیموس (عصب گلوتئال فوقانی)",
    structureTestedEn: "Gluteus Medius & Minimus (Superior Gluteal Nerve)",
    techniqueFa: "بیمار روی یک پا می‌ایستد و پای دیگر را از زمین بلند می‌کند.",
    techniqueEn: "Patient stands on one leg while lifting the contralateral foot.",
    positiveSignFa: "افتادگی لگن در سمت **پای بلندشده (سالم)** به علت ضعف ابداکتورهای پای تکیه‌گاه!",
    positiveSignEn: "Pelvis drops on the UNSUPPORTED (contralateral) side due to stance-leg abductor weakness.",
    organPatterns: [/gluteus_medius/i, /gluteus_minimus/i, /superior_gluteal_nerve/i],
  },
];

export function getOrthopedicTestForOrgan(organId: string): OrthopedicTestProfile | undefined {
  return ORTHOPEDIC_TESTS_CATALOG.find((t) => t.organPatterns.some((p) => p.test(organId)));
}
