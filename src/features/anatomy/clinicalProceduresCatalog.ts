/**
 * Clinical Procedures & Emergency Access HUD (Harrison's Principles & Cecil Medicine)
 *
 * Implements high-yield procedural anatomical landmarks, safe entry zones,
 * tissue layer depths, neurovascular danger zones, and 3D coordinate targets for:
 * 1. Lumbar Puncture (LP - Tuffier's Line L3-L4 / L4-L5)
 * 2. Tube Thoracostomy / Chest Tube (Safe Triangle 5th ICS)
 * 3. Central Venous Catheterization (Internal Jugular in Sedillot's Triangle)
 * 4. Emergency Cricothyroidotomy (Cricothyroid Membrane)
 * 5. Cardiac Auscultation 4-Valve Landmarks (Aortic, Pulmonic, Tricuspid, Mitral)
 */

export interface ProcedureLayer {
  fa: string;
  en: string;
}

export interface ClinicalProcedure {
  id: string;
  shortLabelEn: string;
  nameFa: string;
  nameEn: string;
  category: "emergency" | "critical_care" | "neurology" | "cardiology";
  anatomicalLandmarkFa: string;
  anatomicalLandmarkEn: string;
  needleTrajectoryFa: string;
  needleTrajectoryEn: string;
  dangerStructureFa: string;
  dangerStructureEn: string;
  tissueLayers: ProcedureLayer[];
  clinicalIndicationFa: string;
  clinicalIndicationEn: string;
  contraindicationsFa: string;
  contraindicationsEn: string;
  relativeTargetPosition: [number, number, number]; // Coordinates relative to body/spine/thorax
  ringRadius: number;
  colorHex: string;
}

export const CLINICAL_PROCEDURES_CATALOG: ClinicalProcedure[] = [
  {
    id: "lumbar_puncture",
    shortLabelEn: "Lumbar Puncture (LP)",
    nameFa: "پونکسیون کمری (Lumbar Puncture / LP)",
    nameEn: "Lumbar Puncture (Spinal Tap)",
    category: "neurology",
    anatomicalLandmarkFa:
      "خط توفیه (Tuffier's Line): خط واصل بالاترین نقطه ستیغ‌های خاصره (Iliac Crests) که از مهره L4 یا فضای بین‌مهره‌ای L4-L5 عبور می‌کند.",
    anatomicalLandmarkEn:
      "Tuffier's Line (Intercristal line): Line connecting highest points of iliac crests, intersecting L4 spinous process or L4-L5 interspace.",
    needleTrajectoryFa:
      "ورود سوزن اسپاینال در فضای بین مهره‌ای L3-L4 یا L4-L5؛ دقیقاً در خط وسط (Midline) با زاویه ۱۵ درجه به سمت بالا (به طرف ناف بیمار) به موازات زوائد خاری.",
    needleTrajectoryEn:
      "Needle inserted at L3-L4 or L4-L5 interspace strictly midline, angled 15 degrees cephalad (aiming toward umbilicus) parallel to spinous processes.",
    dangerStructureFa:
      "مخروط انتهایی نخاع (Conus Medullaris): در بزرگسالان در سطح L1-L2 پایان می‌یابد؛ انجام LP در سطوح بالاتر خطر آسیب جبران‌ناپذیر نخاعی دارد.",
    dangerStructureEn:
      "Conus medullaris (terminates at L1-L2 in adults); performing puncture above L3 risks permanent spinal cord laceration.",
    tissueLayers: [
      { fa: "۱. پوست و بافت زیرجلدی (Skin & Subcutaneous)", en: "Skin & Subcutaneous tissue" },
      { fa: "۲. رباط سوپرااسپینوس (Supraspinous Ligament)", en: "Supraspinous ligament" },
      { fa: "۳. رباط اینتراسپینوس (Interspinous Ligament)", en: "Interspinous ligament" },
      { fa: "۴. رباط فلاووم / زرد (Ligamentum Flavum - حس افت مقاومت 'Pop')", en: "Ligamentum flavum (Distinct 'pop' sensation)" },
      { fa: "۵. فضای اپیدورال (Epidural Space)", en: "Epidural space" },
      { fa: "۶. سخت‌شامه و عنکبوتیه (Dura & Arachnoid Mater)", en: "Dura mater and arachnoid mater" },
      { fa: "۷. فضای ساب‌آراکنوئید و دریافت مایع مغزی-نخاعی (CSF)", en: "Subarachnoid space (CSF drainage)" },
    ],
    clinicalIndicationFa:
      "تشخیص مننژیت باکتریال/ویروسی، خونریزی زیر عنکبوتیه (SAH با زانتوکرومی)، سنجش فشار مایع مغزی‌نخاعی در هیدروسفالی فشار طبیعی، و ام‌اس.",
    clinicalIndicationEn:
      "Diagnosis of bacterial/viral meningitis, subarachnoid hemorrhage (xanthochromia), idiopathic intracranial hypertension, and multiple sclerosis.",
    contraindicationsFa:
      "افزایش فشار داخل جمجمه‌ای با توده فضاگیر (خطر فتق کشنده مغزی)، عفونت پوست موضعی، ترومبوسایتوپنی شدید و کواگولوپاتی.",
    contraindicationsEn:
      "Elevated intracranial pressure with mass lesion (herniation risk), overlying skin infection, and severe coagulopathy.",
    relativeTargetPosition: [0.0, 1.05, -0.09], // Posterior lumbar spine
    ringRadius: 0.016,
    colorHex: "#38bdf8",
  },
  {
    id: "chest_tube_thoracostomy",
    shortLabelEn: "Chest Tube (5th ICS)",
    nameFa: "تعبیه چست تیوب در مثلث ایمن (Chest Tube / Thoracostomy)",
    nameEn: "Tube Thoracostomy (Chest Tube Insertion)",
    category: "emergency",
    anatomicalLandmarkFa:
      "مثلث ایمن توراکس (Safe Triangle): در فضای بین دنده‌ای پنجم (5th ICS) در خط میدآگزیلاری (هم‌سطح نوک سینه در آقایان).",
    anatomicalLandmarkEn:
      "Safe Triangle of chest in the 5th intercostal space (ICS) midaxillary line (nipple level).",
    needleTrajectoryFa:
      "برش و ورود تروکار/کلمپ دقیقاً چسبیده به لبه فوقانی دنده ۶ (Superior Border) جهت پرهیز کامل از آسیب به بسته عروقی-عصبی VAN دنده‌ای.",
    needleTrajectoryEn:
      "Dissection and tube advancement immediately superior to rib margin (riding over lower rib) to avoid intercostal VAN bundle.",
    dangerStructureFa:
      "بسته عروقی-عصبی بین دنده‌ای (VAN: ورید، شریان، عصب) در ناودان زیرین هر دنده؛ دیافراگم و کبد/طحال در صورت ورود زیر دنده پنجم.",
    dangerStructureEn:
      "Intercostal VAN (vein, artery, nerve) bundle in costal groove beneath each rib; diaphragm, liver and spleen if inserted below 5th ICS.",
    tissueLayers: [
      { fa: "۱. پوست و فاشیای سطحی (Skin & Fascia)", en: "Skin & superficial fascia" },
      { fa: "۲. عضله دندانه‌ای قدامی (Serratus Anterior)", en: "Serratus anterior muscle" },
      { fa: "۳. عضلات بین‌دنده‌ای خارجی، داخلی و عمقی", en: "External, internal, and innermost intercostal muscles" },
      { fa: "۴. فاشیا اندوتوراسیک (Endothoracic Fascia)", en: "Endothoracic fascia" },
      { fa: "۵. پلور پاریتال / جداری (Parietal Pleura - حس شکستن و جهش هوا/مایع)", en: "Parietal pleura (Sudden release into pleural cavity)" },
    ],
    clinicalIndicationFa:
      "پنوموتوراکس فشاری (Tension Pneumothorax)، هموتوراکس ماسیو، افیوژن پلورال علامت‌دار وسیع، امپیم و شیلوز.",
    clinicalIndicationEn:
      "Tension pneumothorax, large hemothorax, complicated parapneumonic effusion, and empyema.",
    contraindicationsFa:
      "امتناع بیمار هوشیار، چسبندگی‌های وسیع قبلی پلورال (نیازمند توراکوتومی باز).",
    contraindicationsEn:
      "Absolute contraindications are rare in emergencies; severe fibrothorax may require open thoracotomy.",
    relativeTargetPosition: [0.12, 1.25, 0.02], // Lateral 5th ICS
    ringRadius: 0.02,
    colorHex: "#f43f5e",
  },
  {
    id: "internal_jugular_cvc",
    shortLabelEn: "IJV Central Line (CVC)",
    nameFa: "کاتتریزاسیون ورید ژوگولار داخلی (Internal Jugular CVC)",
    nameEn: "Internal Jugular Central Venous Line",
    category: "critical_care",
    anatomicalLandmarkFa:
      "مثلث سدیلو (Sedillot's Triangle): بین سر استرنال و سر کلاویکولار عضله SCM و استخوان ترقوه؛ در سطح غضروف کریکوئید (مهره C6).",
    anatomicalLandmarkEn:
      "Apex of Sedillot's triangle formed by sternal and clavicular heads of SCM and clavicle; at level of cricoid cartilage (C6).",
    needleTrajectoryFa:
      "ورود در رأس مثلث با زاویه ۳۰-۴۵ درجه نسبت به پوست، جهت‌گیری به سمت نیپل (نوک سینه) همان سمت همراه با آسپیراسیون مداوم.",
    needleTrajectoryEn:
      "Needle enters at apex of triangle angled 30-45 degrees to coronal plane, directed towards ipsilateral nipple with continuous syringe suction.",
    dangerStructureFa:
      "شریان کاروتید مشترک (Common Carotid Artery) بلافاصله در مدیکال ورید؛ گنبد پلور و اپکس ریه در تحتانی (خطر پنوموتوراکس).",
    dangerStructureEn:
      "Common carotid artery (immediately medial and posterior); cupola of pleura / lung apex inferiorly (pneumothorax risk).",
    tissueLayers: [
      { fa: "۱. پوست و عضله پلاتیسما (Platysma)", en: "Skin & platysma muscle" },
      { fa: "۲. فاشیای عمقی گردن (Deep Cervical Fascia)", en: "Deep cervical investing fascia" },
      { fa: "۳. غلاف کاروتید (Carotid Sheath)", en: "Carotid sheath anterior wall" },
      { fa: "۴. ورید ژوگولار داخلی (IJV Luminal Entry)", en: "Internal jugular vein lumen" },
    ],
    clinicalIndicationFa:
      "احیای مایعات پرفشار در شوک سپتیک/هموراژیک، انفوزیون داروهای اینوتروپ و وازوپرسور محرک رگ، مونیتورینگ فشار ورید مرکزی (CVP).",
    clinicalIndicationEn:
      "Resuscitation in distributive/hypovolemic shock, vasopressor and inotrope infusions, total parenteral nutrition, and CVP monitoring.",
    contraindicationsFa:
      "عفونت پوست گردن، ترومبوز ورید ژوگولار، آناتومی مخدوش گردن ناشی از تروما یا جراحی قبلی.",
    contraindicationsEn:
      "Ipsilateral thrombosis, anatomical distortion, severe coagulopathy (subclavian or femoral access preferred).",
    relativeTargetPosition: [0.035, 1.42, 0.045], // Right anterior neck
    ringRadius: 0.014,
    colorHex: "#8b5cf6",
  },
  {
    id: "emergency_cricothyroidotomy",
    shortLabelEn: "Cricothyroidotomy",
    nameFa: "کریکوتیروئیدوتومی اورژانسی راه هوایی (Emergency Cricothyroidotomy)",
    nameEn: "Emergency Surgical Cricothyroidotomy",
    category: "emergency",
    anatomicalLandmarkFa:
      "غشای کریکوتیروئید: فرورفتگی نرم لمس شونده بین لبه تحتانی غضروف تیروئید (سیب آدم) و لبه فوقانی غضروف انگشتری کریکوئید.",
    anatomicalLandmarkEn:
      "Cricothyroid membrane: Palpable soft depression between inferior border of thyroid cartilage and superior border of cricoid ring.",
    needleTrajectoryFa:
      "برش عمودی پوست خط وسط، سپس برش افقی غشای کریکوتیروئید در نیمه تحتانی (جهت پرهیز از شریان‌های کریکوتیروئید فوقانی).",
    needleTrajectoryEn:
      "Vertical midline skin incision, followed by horizontal stab incision through lower half of cricothyroid membrane to preserve cricothyroid arteries.",
    dangerStructureFa:
      "تارهای صوتی حقیقی در ۱ سانتی‌متری بالای غشا؛ شریان‌های کوچک کریکوتیروئید در نیمه فوقانی غشا؛ مری خلف حنجره.",
    dangerStructureEn:
      "True vocal cords (1 cm cephalad); cricothyroid vascular anastomosis (upper membrane border); posterior cricoid lamina / esophagus.",
    tissueLayers: [
      { fa: "۱. پوست خط وسط گردن (Midline Skin)", en: "Midline cervical skin" },
      { fa: "۲. فاشیای گردنی بدون عضله (Avascular Line)", en: "Superficial fascia (median avascular line)" },
      { fa: "۳. غشای الاستیک کریکوتیروئید (Cricothyroid Membrane)", en: "Cricothyroid membrane" },
      { fa: "۴. لومن زیرگلاتی حنجره (Subglottic Airway)", en: "Subglottic laryngeal lumen" },
    ],
    clinicalIndicationFa:
      "شرایط اضطراری مرگبار 'امکان لوله‌گذاری نیست، امکان اکسیژن‌رسانی نیست' (Can't Intubate, Can't Oxygenate - CICO) در ترومای حاد صورت یا لارنگواسپاسم شدید.",
    clinicalIndicationEn:
      "Emergency life-saving airway rescue in 'Cannot Intubate, Cannot Oxygenate' (CICO) scenarios or severe maxillofacial trauma.",
    contraindicationsFa:
      "کودکان زیر ۸-۱۰ سال (به دلیل خطر تنگی زیرگلوت - در کودکان کریکوتیروئیدوتومی سوزنی ارجح است)، قطع کامل حنجره از نای.",
    contraindicationsEn:
      "Children under 8-10 years (needle jet ventilation preferred due to subglottic stenosis risk); complete tracheal transection.",
    relativeTargetPosition: [0.0, 1.41, 0.065], // Anterior mid-larynx
    ringRadius: 0.012,
    colorHex: "#eab308",
  },
  {
    id: "cardiac_auscultation_areas",
    shortLabelEn: "Cardiac Auscultation",
    nameFa: "کانون‌های چهارگانه سمع قلب (Cardiac Auscultation Landmarks)",
    nameEn: "Four Classic Cardiac Auscultation Landmarks",
    category: "cardiology",
    anatomicalLandmarkFa:
      "کانون آئورت (دنده ۲ راست)، کانون پولمونر (دنده ۲ چپ)، کانون تریکوسپید (دنده ۵ چپ لبه استرنوم)، کانون میترال (آپکس قلب دنده ۵ چپ خط میدکلاویکولار).",
    anatomicalLandmarkEn:
      "Aortic (2nd right ICS), Pulmonic (2nd left ICS), Tricuspid (4th-5th left ICS parasternal), Mitral (5th left ICS midclavicular).",
    needleTrajectoryFa:
      "معاینه بالینی با گوشی پزشکی (دیافراگم برای صداهای با فرکانس بالا مثل S1/S2 و مرمرهای نارسایی؛ بل برای صداهای بم S3/S4 و تنگی میترال).",
    needleTrajectoryEn:
      "Stethoscope placement: Diaphragm for high-pitched sounds (S1, S2, regurgitation murmurs); Bell for low-frequency sounds (S3, S4, mitral stenosis gallop).",
    dangerStructureFa:
      "تشخیص اشتباه مرمرهای سیستولیک و دیاستولیک؛ نارسایی دریچه‌ای و تنگی بحرانی آئورت با گرادیان فشار بالا.",
    dangerStructureEn:
      "Misdiagnosing systolic vs diastolic murmurs; overlooking high-gradient critical aortic stenosis.",
    tissueLayers: [
      { fa: "کانون آئورت: فضای دوم بین‌دنده‌ای راست لبه استرنوم (سمع صدای بسته شدن A2)", en: "Aortic: 2nd right ICS sternal border (A2 closure loudest)" },
      { fa: "کانون پولمونر: فضای دوم بین‌دنده‌ای چپ لبه استرنوم (سمع صدای P2 و اسپلیتینگ فیزیولوژیک)", en: "Pulmonic: 2nd left ICS sternal border (P2 closure & splitting)" },
      { fa: "کانون تریکوسپید: فضای چهارم/پنجم بین‌دنده‌ای چپ لبه استرنوم", en: "Tricuspid: 4th/5th left ICS parasternal" },
      { fa: "کانون میترال (آپکس): فضای پنجم بین‌دنده‌ای چپ در خط میدکلاویکولار (سمع صدای S1 و مرمر نارسایی)", en: "Mitral (Apex): 5th left ICS midclavicular line (S1 loudest, MR murmur)" },
    ],
    clinicalIndicationFa:
      "غربالگری تنگی و نارسایی دریچه‌های قلبی، پرولاپس میترال، نقص دیواره بین‌بطنی (VSD)، و نارسایی قلبی (صداهای سوم و چهارم قلب).",
    clinicalIndicationEn:
      "Diagnostic physical exam for valvular stenosis and regurgitation, hypertrophic cardiomyopathy, and heart failure gallops.",
    contraindicationsFa: "هیچ‌گونه منبع منعی برای معاینه بالینی غیرتهاجمی وجود ندارد.",
    contraindicationsEn: "None; non-invasive routine bedside examination.",
    relativeTargetPosition: [0.04, 1.28, 0.09], // Precordium
    ringRadius: 0.024,
    colorHex: "#10b981",
  },
];

/**
 * Resolves a clinical procedure by unique ID.
 */
export function getClinicalProcedure(procedureId: string): ClinicalProcedure | undefined {
  return CLINICAL_PROCEDURES_CATALOG.find((p) => p.id === procedureId);
}
