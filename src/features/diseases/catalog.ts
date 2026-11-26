import { normalizeMedicalSearchTerm } from "./diseaseCorrelationEngine";

/**
 * Curated clinical pathology definition connecting anatomical structures
 * to diseases documented in Robbins & Cotran Pathologic Basis of Disease (10th ed),
 * Harrison's Principles of Internal Medicine (21st ed), and Cecil Medicine (2024).
 */
export interface Disease {
  id: string;
  category: "cardiovascular" | "respiratory" | "digestive" | "renal" | "nervous" | "endocrine" | "skeletal" | "reproductive";
  name: { fa: string; en: string };
  summary: { fa: string; en: string };
  effect: { fa: string; en: string };
  clinicalSigns?: { fa: string; en: string };
  aliases: string[];
  source: string;
  sites: {
    fa: string;
    en: string;
    male: string[];
    female: string[];
  }[];
}

export const diseases: Disease[] = [
  // ==========================================
  // CARDIOVASCULAR (قلبی - عروقی)
  // ==========================================
  {
    id: "myocardial-infarction",
    category: "cardiovascular",
    name: { fa: "انفارکتوس حاد میوکارد (سکته قلبی)", en: "Acute Myocardial Infarction" },
    summary: {
      fa: "نکروز ایسکمیک پیش‌رونده در بافت میوکارد ناشی از انسداد حاد شریان‌های کرونر (عمدتاً بر اثر پارگی پلاک آترواسکلروتیک و ترومبوز ثانویه).",
      en: "Ischemic necrosis of myocardial tissue caused by acute occlusion of coronary arteries, typically following atherosclerotic plaque rupture.",
    },
    effect: {
      fa: "کاهش حاد قدرت انقباضی بطن چپ، آریتمی‌های کشنده، نارسایی حاد پمپاژ قلبی و در موارد شدید شوک کاردیوژنیک.",
      en: "Acute loss of left ventricular contractile power, lethal arrhythmias, pump failure, and potentially cardiogenic shock.",
    },
    clinicalSigns: {
      fa: "درد فشاری پشت جناغ، انتشار به بازوی چپ، تنگی نفس و تغییرات قطعه ST در نوار قلب.",
      en: "Substernal crushing chest pain radiating to the left arm, dyspnea, and ST-segment elevations.",
    },
    aliases: ["سکته قلبی", "حمله قلبی", "میوکارد", "کرونر", "infarction", "heart attack", "mi", "coronary"],
    source: "Robbins & Cotran 10th Ed, Ch 12 (The Heart) / Harrison's 21st Ed, Ch 269",
    sites: [
      {
        fa: "بطن چپ",
        en: "Left ventricle",
        male: ["left_ventricle", "inferior_papillary_muscle_of_left_ventricle"],
        female: [],
      },
      {
        fa: "شریان کرونر چپ",
        en: "Left coronary artery",
        male: ["left_coronary_artery", "circumflex_artery_of_heart"],
        female: [],
      },
      {
        fa: "شریان کرونر راست",
        en: "Right coronary artery",
        male: ["right_coronary_artery"],
        female: [],
      },
    ],
  },
  {
    id: "coronary-atherosclerosis",
    category: "cardiovascular",
    name: { fa: "آترواسکلروز عروق کرونر (تصلب شرایین)", en: "Coronary Atherosclerosis" },
    summary: {
      fa: "تجمع تدریجی لیپیدها، ماکروفاژها و بافت فیبروزه در لایه انتیما شریان‌های کرونر که سبب تنگی لومن و کاهش پرفیوژن خونی میوکارد می‌شود.",
      en: "Progressive accumulation of fibrofatty atheromatous plaques within coronary intima, causing luminal narrowing and hypoperfusion.",
    },
    effect: {
      fa: "ایسکمی مزمن بافت قلب، آنژین صدری پایدار و ناپایدار و مستعدسازی قلب برای حوادث ترومبوتیک حاد.",
      en: "Chronic myocardial ischemia, stable and unstable angina, and high predisposition to acute thrombosis.",
    },
    aliases: ["تصلب شرایین", "گرفتگی رگ", "آتروم", "پلاک کرونری", "atheroma", "cad", "atherosclerosis"],
    source: "Harrison's Principles of Internal Medicine 21st Ed, Ch 267",
    sites: [
      {
        fa: "شریان‌های کرونر",
        en: "Coronary arteries",
        male: ["left_coronary_artery", "right_coronary_artery", "circumflex_artery_of_heart"],
        female: [],
      },
      {
        fa: "آئورت صعودی",
        en: "Ascending aorta",
        male: ["ascending_aorta"],
        female: [],
      },
    ],
  },
  {
    id: "aortic-aneurysm",
    category: "cardiovascular",
    name: { fa: "آنوریسم آئورت", en: "Aortic Aneurysm" },
    summary: {
      fa: "اتساع دائمی و غیرطبیعی تمام لایه‌های جدار آئورت (به قطر بیش از ۵۰٪ نرمال) در نواحی صعودی، قوس، قفسه سینه یا شکم.",
      en: "Permanent pathological dilatation involving all three layers of the aortic wall in thoracic or abdominal segments.",
    },
    effect: {
      fa: "خطر فاجعه‌بار پارگی حاد جدار، خونریزی وسیع داخلی، ترومبوآمبولی شریانی و مرگ ناگهانی.",
      en: "Catastrophic risk of rupture, massive internal exsanguination, distal thromboembolism, and sudden death.",
    },
    aliases: ["آنوریسم", "پارگی آئورت", "اتساع آئورت", "aorta", "aneurysm", "aaa"],
    source: "Cecil Textbook of Medicine 27th Ed, Ch 64",
    sites: [
      {
        fa: "آئورت شکمی",
        en: "Abdominal aorta",
        male: ["abdominal_aorta"],
        female: ["descending_aorta_lower"],
      },
      {
        fa: "آئورت قفسه سینه و قوس",
        en: "Thoracic aorta & arch",
        male: ["thoracic_aorta", "aortic_arch", "ascending_aorta"],
        female: ["descending_aorta_upper"],
      },
    ],
  },
  {
    id: "mitral-valve-stenosis",
    category: "cardiovascular",
    name: { fa: "تنگی و افتادگی دریچه میترال", en: "Mitral Valve Stenosis & Prolapse" },
    summary: {
      fa: "باریک‌شدن دهانه جریان ورودی به بطن چپ ناشی از فیبروز یا رسوب کلسیم (اغلب متعاقب روماتیسم قلبی) یا پس‌زدگی جریان خون در سیستول.",
      en: "Narrowing of the mitral orifice restricting inflow into the left ventricle, or systolic ballooning causing regurgitation.",
    },
    effect: {
      fa: "افزایش فشار و اتساع دهلیز چپ، احتقان و ادم ریوی، و فیبریلاسیون دهلیزی مقاوم.",
      en: "Elevated left atrial pressure and dilation, pulmonary congestion/edema, and secondary atrial fibrillation.",
    },
    aliases: ["دریچه میترال", "پرولاپس میترال", "تنگی میترال", "روماتیسم قلبی", "mitral", "mvp"],
    source: "Robbins & Cotran 10th Ed, Ch 12",
    sites: [
      {
        fa: "دریچه دهلیزی-بطنی چپ (میترال)",
        en: "Mitral valve leaflets",
        male: ["posterior_leaflet_of_left_atrioventricular_valve"],
        female: [],
      },
      {
        fa: "دهلیز چپ",
        en: "Left atrium",
        male: ["left_atrium"],
        female: [],
      },
    ],
  },
  {
    id: "atrial-fibrillation",
    category: "cardiovascular",
    name: { fa: "فیبریلاسیون دهلیزی (AF)", en: "Atrial Fibrillation" },
    summary: {
      fa: "شایع‌ترین تاکی‌آریتمی فوق‌بطنی با فعال‌سازی الکتریکی کاملاً نامنظم، ریزموج و آشفته در دهلیزها (۴۰۰ تا ۶۰۰ ضربه در دقیقه).",
      en: "The most common supraventricular tachyarrhythmia characterized by chaotic, uncoordinated atrial micro-reentry waves.",
    },
    effect: {
      fa: "فقدان سیستول موثر دهلیزی (از دست رفتن Atrial Kick)، رکود خون در گوشک دهلیز و خطر بالای تشکیل ترومبوس و سکته مغزی آمبولیک.",
      en: "Loss of effective atrial contraction (atrial kick), blood stasis in left atrial appendage, and high stroke risk.",
    },
    aliases: ["آریتمی", "تپش قلب", "فیبریلاسیون", "ای اف", "afib", "arrhythmia"],
    source: "Basic Arrhythmias 8th Ed (2025) / Harrison's Ch 245",
    sites: [
      {
        fa: "دهلیز راست و چپ",
        en: "Atria",
        male: ["right_atrium", "left_atrium"],
        female: [],
      },
    ],
  },

  // ==========================================
  // RESPIRATORY (تنفسی و ریه)
  // ==========================================
  {
    id: "pneumonia",
    category: "respiratory",
    name: { fa: "ذات‌الریه / پنومونی حاد باکتریال", en: "Bacterial Pneumonia" },
    summary: {
      fa: "عفونت حاد پارانشیم ریه (آلوئول‌ها و برونشیول‌ها) که با ارتشاح اگزودای التهابی چرکی، نوتروفیل‌ها و قوام‌یافتگی (Consolidation) مشخص می‌شود.",
      en: "Acute infection of pulmonary parenchyma marked by intra-alveolar purulent exudate, consolidation, and neutrophil recruitment.",
    },
    effect: {
      fa: "کاهش شدید سطح تبادل اکسیژن و دی‌اکسید کربن، هیپوکسمی، تب، سرفه خلط‌دار و درد پلورتیک قفسه سینه.",
      en: "Impaired alveolar gas exchange, severe hypoxemia, productive cough, fever, and pleuritic chest pain.",
    },
    aliases: ["سینه پهلو", "عفونت ریه", "پنومونی", "lung infection", "pneumonia"],
    source: "Robbins & Cotran 10th Ed, Ch 15 / Cecil Ch 85",
    sites: [
      {
        fa: "لوب‌های ریه چپ",
        en: "Left lung lobes",
        male: ["superior_lobe_of_left_lung", "inferior_lobe_of_left_lung"],
        female: [],
      },
      {
        fa: "لوب‌های ریه راست",
        en: "Right lung lobes",
        male: ["superior_lobe_of_right_lung", "middle_lobe_of_right_lung", "inferior_lobe_of_right_lung"],
        female: [],
      },
    ],
  },
  {
    id: "copd-emphysema",
    category: "respiratory",
    name: { fa: "بیماری انسدادی مزمن ریه (COPD و آمفیزم)", en: "Chronic Obstructive Pulmonary Disease & Emphysema" },
    summary: {
      fa: "تخریب دائمی دیواره‌های آلوئولی دیستال بدون فیبروز آشکار، همراه با التهاب و ترشح بیش از حد موکوس در راه‌های هوایی کوچک.",
      en: "Permanent destruction of alveolar walls distal to terminal bronchioles with loss of elastic recoil and airflow obstruction.",
    },
    effect: {
      fa: "به دام افتادن هوا در ریه‌ها (Air Trapping)، کاهش الاستیسیته برگشتی، تنگی نفس پیش‌رونده، قفسه سینه بشکه‌ای و هیپرکاپنی.",
      en: "Expiratory airflow limitation, dynamic hyperinflation (barrel chest), progressive exertional dyspnea, and hypercapnia.",
    },
    aliases: ["آمفیزم", "انسداد ریه", "برونشیت مزمن", "سی او پی دی", "emphysema", "copd", "bronchitis"],
    source: "Harrison's 21st Ed, Ch 286 / Robbins Ch 15",
    sites: [
      {
        fa: "نایژه‌ها و ریه",
        en: "Bronchi & Lung Lobes",
        male: ["left_main_bronchus", "right_main_bronchus", "superior_lobe_of_right_lung", "superior_lobe_of_left_lung"],
        female: [],
      },
    ],
  },
  {
    id: "asthma",
    category: "respiratory",
    name: { fa: "آسم برونشیال", en: "Bronchial Asthma" },
    summary: {
      fa: "بیماری التهابی مزمن مجاری هوایی همراه با بیش‌فعالی راه‌های تنفسی (Hyperresponsiveness) و اسپاسم متناوب عضلات صاف برونش.",
      en: "Chronic airway inflammatory disorder driven by eosinophils and mast cells, causing episodic bronchoconstriction and airway remodeling.",
    },
    effect: {
      fa: "حملات حاد خس‌خس سینه (Wheezing)، تنگی نفس، سرفه شبانه و تنگی منتشر و قابل برگشت راه‌های هوایی.",
      en: "Episodic wheezing, chest tightness, reversible airway obstruction, and excessive mucus plugging.",
    },
    aliases: ["آسم", "تنگی نفس", "اسپاسم نایژه", "asthma", "bronchospasm"],
    source: "Harrison's 21st Ed, Ch 287",
    sites: [
      {
        fa: "نایژه اصلی چپ",
        en: "Left main bronchus",
        male: ["left_main_bronchus"],
        female: [],
      },
      {
        fa: "نایژه اصلی راست",
        en: "Right main bronchus",
        male: ["right_main_bronchus"],
        female: [],
      },
      {
        fa: "نای (تراشه)",
        en: "Trachea",
        male: ["trachea"],
        female: [],
      },
    ],
  },
  {
    id: "pleural-effusion",
    category: "respiratory",
    name: { fa: "پلوریت و افیوژن پلورال (آب آوردن ریه)", en: "Pleuritis & Pleural Effusion" },
    summary: {
      fa: "تجمع غیرطبیعی مایع ترانسودا یا اگزودا در فضای میان لایه جداری و احشایی پلور ناشی از التهاب، نارسایی قلبی یا بدخیمی.",
      en: "Pathological accumulation of transudative or exudative fluid in the pleural cavity between visceral and parietal pleurae.",
    },
    effect: {
      fa: "کاهش حجم اتساع ریه (کمپرس ریه)، آتلکتازی فشاری، درد تیرکشنده پلورتیک هنگام تنفس و کاهش صداهای ریوی در سمع.",
      en: "Compressive atelectasis, reduced vital capacity, pleuritic chest friction rub, and dullness to percussion.",
    },
    aliases: ["پلوریت", "افیوژن", "آب آوردن ریه", "پرده جنب", "pleura", "pleural effusion"],
    source: "Cecil Textbook of Medicine 27th Ed, Ch 89",
    sites: [
      {
        fa: "پرده پلور (جنب)",
        en: "Pleura",
        male: ["pleura"],
        female: [],
      },
    ],
  },

  // ==========================================
  // GASTROINTESTINAL & HEPATOBILIARY (گوارش، کبد و لوزالمعده)
  // ==========================================
  {
    id: "appendicitis",
    category: "digestive",
    name: { fa: "آپاندیسیت حاد", en: "Acute Appendicitis" },
    summary: {
      fa: "التهاب و عفونت حاد مخاط و جدار آپاندیس ورمی‌فرم ناشی از انسداد لومن توسط فکالیت (سنگ مدفوعی)، هیپرپلازی لنفاوی یا تومور.",
      en: "Acute suppurative inflammation of the vermiform appendix lumen, initiated primarily by fecalith obstruction.",
    },
    effect: {
      fa: "ایسکمی دیواره، پرفوراسیون (سوراخ شدن)، پریتونیت عمومی مهلک و آبسه‌های متعدد داخل صفاقی در صورت عدم جراحی فوری.",
      en: "Transmural ischemia, wall gangrene, perforation into the peritoneal cavity, and life-threatening peritonitis.",
    },
    clinicalSigns: {
      fa: "درد دور ناف که به ناحیه ایلیاک راست (نقطه مک‌بورنی) منتقل می‌شود، تب و حساسیت بازگشتی (Rebound tenderness).",
      en: "Periumbilical pain migrating to the right lower quadrant (McBurney point), rebound tenderness, and anorexia.",
    },
    aliases: ["آپاندیس", "آپاندیسیت", "درد پهلو راست", "appendix", "appendicitis"],
    source: "Robbins & Cotran 10th Ed, Ch 17 / Harrison's Ch 330",
    sites: [
      {
        fa: "آپاندیس ورمی‌فرم",
        en: "Vermiform appendix",
        male: ["vermiform_appendix", "meso_appendix"],
        female: ["vermiform_appendix"],
      },
      {
        fa: "سکوم (روده کور)",
        en: "Caecum",
        male: ["caecum"],
        female: ["caecum"],
      },
    ],
  },
  {
    id: "cirrhosis",
    category: "digestive",
    name: { fa: "سیروز کبدی", en: "Cirrhosis" },
    summary: {
      fa: "مرحله نهایی بیماری‌های مزمن کبدی با تخریب معماری طبیعی لوبولار، تشکیل گره‌های بازسازی‌کننده (Nodules) و رسوب متراکم کلاژن.",
      en: "End-stage chronic liver pathology marked by diffuse parenchymal nodular architectural distortion and dense collagen bridging.",
    },
    effect: {
      fa: "افزایش فشار ورید پورت (Portal Hypertension)، آسیت شدید شکمی، واریس‌های مری و نارسایی کبد با زردی و آنسفالوپاتی.",
      en: "Portal hypertension, abdominal ascites, esophageal varices, hepatic encephalopathy, and jaundice.",
    },
    aliases: ["سیروز", "فیبروز کبد", "نارسایی کبد", "کبد چرب", "cirrhosis", "liver fibrosis"],
    source: "Harrison's 21st Ed, Ch 339 / Robbins Ch 18",
    sites: [
      {
        fa: "کبد",
        en: "Liver",
        male: ["liver"],
        female: ["bare_area_of_liver", "diaphragmatic_surface_of_liver"],
      },
    ],
  },
  {
    id: "gallstones",
    category: "digestive",
    name: { fa: "سنگ کیسهٔ صفرا", en: "Gallstones (Cholelithiasis & Acute Cholecystitis)" },
    summary: {
      fa: "تشکیل سنگ‌های کلسترولی یا پیگمانته در مجاری صفراوی و کیسه صفرا به دلیل فوق‌اشباع بودن صفرا و هیپوموتیلیتی کیسه صفرا.",
      en: "Formation of crystalline cholesterol or pigmented calculi in the gallbladder, causing cystic duct impaction and acute inflammation.",
    },
    effect: {
      fa: "کولیک صفراوی شدید، انسداد مجرای سیستیک، التهاب چرکی کیسه صفرا، زردی انسدادی و احتمال پانکراتیت صفراوی.",
      en: "Severe biliary colic, cystic duct blockage, chemical and bacterial cholecystitis, and obstructive jaundice.",
    },
    aliases: ["کیسه صفرا", "سنگ صفرا", "کله‌سیستیت", "یرقان", "gallbladder", "cholecystitis", "gallstones"],
    source: "Robbins & Cotran 10th Ed, Ch 18",
    sites: [
      {
        fa: "کیسهٔ صفرا",
        en: "Gallbladder",
        male: ["gallbladder"],
        female: ["gallbladder"],
      },
    ],
  },
  {
    id: "pancreatitis",
    category: "digestive",
    name: { fa: "پانکراتیت حاد و مزمن", en: "Pancreatitis" },
    summary: {
      fa: "خودتخریبی ناشی از فعال‌سازی نابجای آنزیم‌های گوارشی (تریپسینوژن به تریپسین) در داخل بافت پارانشیم لوزالمعده ناشی از الکل یا سنگ صفرا.",
      en: "Autodigestion of pancreatic parenchyma due to premature intrapancreatic activation of proenzymes into destructive trypsin.",
    },
    effect: {
      fa: "نکروز چربی آنزیمی، خونریزی شدید داخل نسجی، درد شدید کمربندی اپی‌گاستر با انتشار به پشت و خطر سندروم پاسخ التهابی فراگیر (SIRS).",
      en: "Enzymatic fat necrosis, interstitial hemorrhage, severe belt-like epigastric pain radiating to back, and shock.",
    },
    aliases: ["پانکراتیت", "التهاب لوزالمعده", "لوزالمعده", "pancreas", "pancreatitis"],
    source: "Robbins & Cotran 10th Ed, Ch 19 / Cecil Ch 133",
    sites: [
      {
        fa: "لوزالمعده (پانکراس)",
        en: "Pancreas",
        male: ["pancreas"],
        female: ["head_of_pancreas", "body_of_pancreas", "tail_of_pancreas"],
      },
    ],
  },
  {
    id: "gastric-ulcer",
    category: "digestive",
    name: { fa: "بیماری زخم پپتیک معده و دوازدهه", en: "Peptic Ulcer Disease (Gastric & Duodenal)" },
    summary: {
      fa: "ضایعه زخمی با نفوذ عمیق‌تر از لایه مخاطی (Muscularis Mucosae) در معده یا پیاز دوازدهه به علت عفونت با هلیکوباکتر پیلوری یا مصرف NSAIDها.",
      en: "Deep mucosal breach extending into muscularis mucosae caused by Helicobacter pylori colonization or NSAID toxicity.",
    },
    effect: {
      fa: "فرسایش عروق خونی جداری (خونریزی حاد گوارشی و ملنا)، سوءهاضمه، پرفوراسیون به حفره پریتونئال و درد سوزشی اپی‌گاستر.",
      en: "Vessel erosion causing severe upper GI bleeding, perforation into peritoneal cavity, and epigastric burning pain.",
    },
    aliases: ["زخم معده", "زخم اثنی عشر", "گاستریت", "peptic ulcer", "stomach ulcer"],
    source: "Harrison's 21st Ed, Ch 325",
    sites: [
      {
        fa: "معده",
        en: "Stomach",
        male: ["stomach", "mucosa_of_stomach"],
        female: [],
      },
      {
        fa: "دوازدهه",
        en: "Duodenum",
        male: [],
        female: ["superior_part_of_duodenum", "descending_part_of_duodenum"],
      },
    ],
  },
  {
    id: "crohns-and-colitis",
    category: "digestive",
    name: { fa: "بیماری‌های التهابی روده (کرون و کولیت اولسراتیو)", en: "Inflammatory Bowel Disease (Crohn's & Ulcerative Colitis)" },
    summary: {
      fa: "بیماری مزمن و عودکننده ناشی از پاسخ ایمنی نابجا به میکروبیوتای روده در افراد مستعد ژنتیکی، با درگیری پیوسته کولون یا ضایعات ناپیوسته روده باریک.",
      en: "Chronic relapsing immune-mediated disorder of the intestinal tract with mucosal friability, ulcers, and transmural fissures.",
    },
    effect: {
      fa: "اسهال خونی مزمن، فیستول، انسداد لومن روده به دلیل استریکچر، زخم‌های مخاطی و افزایش خطر آدنوکارسینوم روده بزرگ.",
      en: "Bloody diarrhea, intestinal fistulas, strictures causing bowel obstruction, and elevated risk of colorectal neoplasia.",
    },
    aliases: ["کرون", "کولیت", "التهاب روده", "آی بی دی", "ibd", "crohn", "colitis"],
    source: "Robbins & Cotran 10th Ed, Ch 17",
    sites: [
      {
        fa: "روده بزرگ (کولون)",
        en: "Colon & Rectum",
        male: [],
        female: ["ascending_colon", "descending_colon", "sigmoid_colon", "transverse_colon", "rectum"],
      },
      {
        fa: "روده باریک (ایلئوم)",
        en: "Terminal ileum",
        male: [],
        female: ["terminal_ileum", "ileum"],
      },
    ],
  },

  // ==========================================
  // RENAL & URINARY (کلیه و مجاری ادراری)
  // ==========================================
  {
    id: "kidney-stones",
    category: "renal",
    name: { fa: "سنگ کلیه و کولیک رنال (نفرولیتیاز)", en: "Nephrolithiasis & Renal Colic" },
    summary: {
      fa: "تشکیل کریستال‌های کلسیم اگزالات، اسید اوریک یا استروویت در سیستم کالیس‌ها و لگنچه کلیه در اثر اشباع یون‌های ادراری.",
      en: "Supersaturation and precipitation of urinary salts (calcium oxalate, uric acid, struvite) in the renal pelvicalyceal system.",
    },
    effect: {
      fa: "انسداد حاد حالب، هیدرونفروز، آسیب حاد ایسکمیک گلومرولار و درد فوق‌العاده شدید کرامپی پهلو با انتشار به کشاله ران.",
      en: "Ureteral obstruction, acute hydronephrosis, increased intraluminal pressure, and excruciating flank colic radiating to groin.",
    },
    aliases: ["سنگ کلیه", "درد پهلو", "کولیک کلیه", "نفرولیتیاز", "renal stones", "kidney stones", "calculi"],
    source: "Harrison's 21st Ed, Ch 319 / Cecil Ch 121",
    sites: [
      {
        fa: "کلیه چپ",
        en: "Left kidney",
        male: ["kidney_l"],
        female: ["fibrous_capsule_of_kidney_l", "hilum_of_kidney_l"],
      },
      {
        fa: "کلیه راست",
        en: "Right kidney",
        male: ["kidney_r"],
        female: ["fibrous_capsule_of_kidney_r", "hilum_of_kidney_r"],
      },
      {
        fa: "حالب‌ها",
        en: "Ureters",
        male: [],
        female: ["ureter_l", "ureter_r"],
      },
      {
        fa: "مثانه",
        en: "Urinary bladder",
        male: ["urinary_bladder"],
        female: ["trigone_of_bladder"],
      },
    ],
  },
  {
    id: "chronic-kidney-disease",
    category: "renal",
    name: { fa: "نارسایی مزمن کلیه (CKD)", en: "Chronic Kidney Disease & Glomerulosclerosis" },
    summary: {
      fa: "از دست رفتن پیش‌رونده و برگشت‌ناپذیر نفرون‌های عملکردی کلیه با اسکلروز گلومرولار و فیبروز بینابینی در زمینه دیابت یا فشار خون بالا.",
      en: "Irreversible decline in glomerular filtration rate (GFR) with diffuse glomerulosclerosis and interstitial fibrosis.",
    },
    effect: {
      fa: "احتباس سموم اورمیک، اسیدوز متابولیک، آنمی ناشی از کمبود اریتروپویتین، فشار خون بالا و نیاز به دیالیز یا پیوند کلیه.",
      en: "Uremic toxicity, fluid overload, severe metabolic acidosis, normocytic anemia, and end-stage renal disease.",
    },
    aliases: ["نارسایی کلیه", "دیالیز", "اورمی", "کلیه", "ckd", "renal failure"],
    source: "Harrison's 21st Ed, Ch 312",
    sites: [
      {
        fa: "کلیه‌ها (قشر و پارانشیم)",
        en: "Renal cortex & parenchyma",
        male: ["kidney_l", "kidney_r"],
        female: ["renal_cortex_l", "renal_cortex_r"],
      },
    ],
  },

  // ==========================================
  // NEUROLOGICAL & CNS (مغز و دستگاه عصبی)
  // ==========================================
  {
    id: "ischemic-stroke",
    category: "nervous",
    name: { fa: "سکته مغزی ایسکمیک (CVA)", en: "Acute Ischemic Stroke" },
    summary: {
      fa: "نقص ناگهانی جریان خون موضعی مغز ناشی از ترومبوز در جا یا آمبولی در شریان‌های اصلی مغزی (به‌ویژه MCA)، منتهی به نکروز دلمه‌ای (Liquefactive necrosis).",
      en: "Sudden focal vascular occlusion causing cerebral ischemia and liquefactive parenchymal necrosis.",
    },
    effect: {
      fa: "فلج نیمه بدن (همی‌پلژی)، از دست رفتن توانایی تکلم (آفازی)، کوری نیمه میدان دید و آسیب‌های ماندگار عصبی حرکتی.",
      en: "Contralateral hemiplegia, acute aphasia, visual field defects, and persistent neurological disability.",
    },
    clinicalSigns: {
      fa: "افتادگی یک‌طرفه صورت، ضعف شدید بازو و اختلال ناگهانی تکلم (معیار FAST).",
      en: "Facial droop, unilateral arm drift, slurred speech (FAST criteria).",
    },
    aliases: ["سکته مغزی", "فلج", "ایسکمی مغز", "stroke", "cva", "infarction"],
    source: "Harrison's 21st Ed, Ch 419 / Robbins Ch 28",
    sites: [
      {
        fa: "شریان مغزی میانی (MCA)",
        en: "Middle cerebral artery",
        male: ["middle_cerebral_artery_m1_segment_l"],
        female: [],
      },
      {
        fa: "شریان‌های مغزی قدامی",
        en: "Anterior cerebral arteries",
        male: ["anterior_cerebral_artery_l", "anterior_cerebral_artery_r"],
        female: [],
      },
      {
        fa: "جسم پینه‌ای و کورتکس",
        en: "Corpus callosum & cerebrum",
        male: ["corpus_callosum"],
        female: [],
      },
    ],
  },
  {
    id: "alzheimers-disease",
    category: "nervous",
    name: { fa: "بیماری آلزایمر و دمانس", en: "Alzheimer's Disease" },
    summary: {
      fa: "شایع‌ترین بیماری دژنراتیو مغز با تجمع پلاک‌های خارج سلولی آمیلوئید بتا و کلافه‌های نوروفیبریلاری پروتئین تائو در هیپوکامپ و کورتکس.",
      en: "Neurodegenerative disorder characterized by extracellular amyloid-beta plaques and hyperphosphorylated tau neurofibrillary tangles.",
    },
    effect: {
      fa: "آتروفی پیش‌رونده هیپوکامپ، از دست دادن شدید حافظه کوتاه‌مدت، زوال عملکردهای عالی شناختی و ناتوانی در خودفرمانی.",
      en: "Profound hippocampal atrophy, loss of recent episodic memory, spatial disorientation, and severe cognitive decline.",
    },
    aliases: ["آلزایمر", "دمانس", "زوال عقل", "فراموشی", "alzheimer", "dementia"],
    source: "Robbins & Cotran 10th Ed, Ch 28",
    sites: [
      {
        fa: "هیپوکامپ (چپ و راست)",
        en: "Hippocampus",
        male: ["hippocampus_l", "hippocampus_r"],
        female: [],
      },
    ],
  },
  {
    id: "parkinsons-disease",
    category: "nervous",
    name: { fa: "بیماری پارکینسون", en: "Parkinson's Disease" },
    summary: {
      fa: "تخریب انتخابی نورون‌های دوپامینرژیک در ماده سیاه (Substantia Nigra) در ساقه مغز و حضور اجسام لویی (Lewy Bodies حاوی آلفا-سینوکلئین).",
      en: "Selective degeneration of dopaminergic neurons in substantia nigra pars compacta with alpha-synuclein Lewy body inclusions.",
    },
    effect: {
      fa: "ترومور در حالت استراحت (Resting Tremor)، کندی حرکات (Bradykinesia)، سفتی عضلانی چرخدنده‌ای (Rigidity) و اختلال در تعادل و قامت.",
      en: "Pill-rolling resting tremor, profound bradykinesia, cogwheel rigidity, and postural instability.",
    },
    aliases: ["پارکینسون", "لرزش دست", "دوپامین", "ماده سیاه", "parkinson", "tremor"],
    source: "Harrison's 21st Ed, Ch 427",
    sites: [
      {
        fa: "مغز میانی و ساقه مغز",
        en: "Midbrain & Brainstem",
        male: ["midbrain_l", "midbrain_r", "base_of_peduncle_l", "base_of_peduncle_r"],
        female: [],
      },
    ],
  },

  // ==========================================
  // ENDOCRINE (غدد درون‌ریز)
  // ==========================================
  {
    id: "hashimotos-thyroiditis",
    category: "endocrine",
    name: { fa: "تیروئیدیت هاشیموتو و کم‌کاری تیروئید", en: "Hashimoto's Thyroiditis & Hypothyroidism" },
    summary: {
      fa: "بیماری خودایمنی با آنتی‌بادی علیه تیروپراکسیداز (TPO) و تیروگلوبولین که منجر به ارتشاح وسیع لنفوسیت‌ها و تخریب فولیکول‌های تیروئید می‌شود.",
      en: "Autoimmune destruction of thyroid follicular cells driven by anti-TPO and anti-thyroglobulin antibodies with germinal center formation.",
    },
    effect: {
      fa: "کاهش سطح هورمون‌های تیروئیدی (T3/T4)، کاهش متابولیسم پایه، خستگی مزمن، عدم تحمل سرما، افزایش وزن، یبوست و گواتر بدون درد.",
      en: "Hypometabolic state, weight gain, extreme cold intolerance, lethargy, bradycardia, and non-toxic goiter.",
    },
    aliases: ["تیروئید", "کم کاری تیروئید", "هاشیموتو", "گواتر", "thyroid", "hypothyroidism", "hashimoto"],
    source: "Robbins & Cotran 10th Ed, Ch 24 / Harrison's Ch 383",
    sites: [
      {
        fa: "غده تیروئید",
        en: "Thyroid gland",
        male: ["thyroid_gland"],
        female: [],
      },
    ],
  },

  // ==========================================
  // MUSCULOSKELETAL (اسکلتی - عضلانی)
  // ==========================================
  {
    id: "osteoarthritis-hip-knee",
    category: "skeletal",
    name: { fa: "آرتروز پیش‌رونده مفاصل (استئوآرتریت زانو و لگن)", en: "Osteoarthritis of Hip & Knee" },
    summary: {
      fa: "فرسایش مکانیکی و بیوشیمیایی غضروف مفصلی هیالن، تشکیل خارهای استخوانی (استئوفیت) و اسکلروز استخوان زیر غضروف در مفاصل تحمل‌کننده وزن.",
      en: "Progressive biomechanical degeneration of articular hyaline cartilage, subchondral eburnation, and osteophyte proliferation.",
    },
    effect: {
      fa: "درد مفصلی هنگام تحمل وزن و راه‌رفتن، خشکی صبحگاهی کوتاه، تغییر شکل زانو/لگن، کریپتاسیون صوتی و کاهش شدید دامنه حرکتی.",
      en: "Weight-bearing mechanical joint pain, limited range of motion, crepitus, and joint deformity.",
    },
    aliases: ["آرتروز", "ساییدگی مفصل", "درد زانو", "درد لگن", "استئوآرتریت", "osteoarthritis", "joint wear"],
    source: "Cecil Textbook of Medicine 27th Ed, Ch 241",
    sites: [
      {
        fa: "استخوان فمور (ران چپ و راست)",
        en: "Femur (left & right)",
        male: ["femur_l", "femur_r", "ligament_of_head_of_femur_l", "ligament_of_head_of_femur_r"],
        female: [],
      },
    ],
  },

  // ==========================================
  // REPRODUCTIVE (تناسلی زنان و مردان)
  // ==========================================
  {
    id: "benign-prostatic-hyperplasia",
    category: "reproductive",
    name: { fa: "هیپرپلازی خوش‌خیم پروستات (BPH)", en: "Benign Prostatic Hyperplasia (BPH)" },
    summary: {
      fa: "تکثیر گره‌ای استروما و بافت غددی ناحیه ترانزیشنال پروستات تحت تأثیر هورمون دی‌هیدروتستوسترون (DHT) در مردان مسن.",
      en: "Non-malignant proliferation of glandular epithelial and stromal tissues within the periurethral transition zone of the prostate.",
    },
    effect: {
      fa: "فشردگی پیشابراه پروستاتیک، تکرر ادرار شبانه (Nocturia)، کاهش فشار جهش ادرار، احتباس ادراری و مستعدسازی به عفونت‌های مثانه.",
      en: "Prostatic urethral compression, urinary hesitancy, weak stream, nocturia, and urinary retention.",
    },
    aliases: ["پروستات", "بزرگی پروستات", "بی پی اچ", "مشکل ادرار", "prostate", "bph"],
    source: "Robbins & Cotran 10th Ed, Ch 21",
    sites: [
      {
        fa: "غده پروستات",
        en: "Prostate gland",
        male: ["prostate"],
        female: [],
      },
    ],
  },
  {
    id: "ovarian-cysts-and-tumors",
    category: "reproductive",
    name: { fa: "کیست و تومورهای تخمدان", en: "Ovarian Cysts & Neoplasms" },
    summary: {
      fa: "تشکیل حفرات کیسه‌ای پر از مایع فولیکولی، لوتئال یا نئوپلاسم‌های سطحی اپیتلیال در بافت تخمدان.",
      en: "Fluid-filled functional retention cavities (follicular, luteal) or neoplastic proliferation within ovarian stroma.",
    },
    effect: {
      fa: "درد مبهم و مزمن لگنی، بی‌نظمی قاعدگی، خطر تورشن (پیچ‌خوردگی حاد تخمدان و ایسکمی انفارکتی) و پارگی ناگهانی همراه با هموپریتونئوم.",
      en: "Chronic pelvic dull ache, menstrual irregularities, high risk of acute ovarian torsion/ischemia, or rupture.",
    },
    aliases: ["کیست تخمدان", "تخمدان", "پیچ خوردگی تخمدان", "تومور تخمدان", "ovary", "ovarian cyst"],
    source: "Robbins & Cotran 10th Ed, Ch 22",
    sites: [
      {
        fa: "تخمدان‌ها",
        en: "Ovaries",
        male: [],
        female: ["ovary_l", "ovary_r", "suspensory_ligament_of_ovary_l", "suspensory_ligament_of_ovary_r"],
      },
    ],
  },
  {
    id: "uterine-fibroids",
    category: "reproductive",
    name: { fa: "فیبروم رحم (لیومیوم رحمی)", en: "Uterine Leiomyoma (Fibroids)" },
    summary: {
      fa: "شایع‌ترین تومور خوش‌خیم دستگاه تناسلی زنان متشکل از سلول‌های عضله صاف میومتر با رشد وابسته به استروژن و پروژسترون.",
      en: "Benign monoclonal smooth muscle neoplasms arising within the uterine myometrium, driven by estrogen and progesterone.",
    },
    effect: {
      fa: "خونریزی‌های شدید و طولانی‌مدت قاعدگی (منوراژی)، آنمی فقر آهن، احساس فشار و سنگینی لگنی، تکرر ادرار ناشی از فشار به مثانه.",
      en: "Severe menorrhagia, secondary iron-deficiency anemia, bulk pelvic pressure symptoms, and urinary frequency.",
    },
    aliases: ["فیبروم", "میوم", "رحم", "خونریزی رحم", "uterus", "fibroid", "leiomyoma"],
    source: "Harrison's 21st Ed, Ch 392",
    sites: [
      {
        fa: "جسم و گردن رحم",
        en: "Uterine body & cervix",
        male: [],
        female: ["body_of_uterus", "fundus_of_uterus", "cervix_of_uterus"],
      },
    ],
  },
  {
    id: "ectopic-pregnancy",
    category: "reproductive",
    name: { fa: "حاملگی نابجا (اکتوپیک لوله‌ای)", en: "Ectopic Tubal Pregnancy" },
    summary: {
      fa: "لانه‌گزینی بلاستوسیست در محلی خارج از حفره اندومتر رحم (در ۹۵٪ موارد در آمپول یا ایسم لوله‌های فالوپ).",
      en: "Implantation of the blastocyst outside the endometrial cavity, predominantly in the ampullary segment of fallopian tubes.",
    },
    effect: {
      fa: "فرسایش جدار نازک لوله رحمی توسط تروفوبلاست، پارگی حاد، خونریزی وسیع داخل صفاقی، شوک هیپوولمیک و تهدید جانی مادر.",
      en: "Tubal rupture, catastrophic intraperitoneal hemorrhage, hypovolemic hemorrhagic shock, and high maternal mortality.",
    },
    aliases: ["بارداری خارج رحمی", "لوله فالوپ", "اکتوپیک", "ectopic", "fallopian"],
    source: "Robbins & Cotran 10th Ed, Ch 22",
    sites: [
      {
        fa: "لوله‌های رحمی (فالوپ)",
        en: "Uterine (Fallopian) tubes",
        male: [],
        female: [
          "ampulla_of_uterine_tube_l",
          "ampulla_of_uterine_tube_r",
          "isthmus_of_uterine_tube_l",
          "isthmus_of_uterine_tube_r",
        ],
      },
    ],
  },
];

/**
 * Searches the disease catalog by normalized text match across name, summary, aliases, and sites.
 */
export function searchDiseases(query: string): Disease[] {
  const needle = normalizeMedicalSearchTerm(query);
  if (!needle) return diseases;

  return diseases.filter((d) => {
    const haystack = [
      d.name.fa,
      d.name.en,
      d.summary.fa,
      d.summary.en,
      d.effect.fa,
      d.effect.en,
      ...(d.aliases || []),
      ...d.sites.flatMap((s) => [s.fa, s.en]),
    ];

    return haystack.some((text) =>
      normalizeMedicalSearchTerm(text).includes(needle),
    );
  });
}

/**
 * Retrieves all diseases mapped to an anatomical structure ID for a specific gender model.
 */
export function diseasesForStructure(id: string, model: "male" | "female"): Disease[] {
  const cleanId = id.trim().toLowerCase();
  if (!cleanId) return [];

  return diseases.filter((d) =>
    d.sites.some((site) => site[model].some((mappedId) => mappedId.toLowerCase() === cleanId)),
  );
}
