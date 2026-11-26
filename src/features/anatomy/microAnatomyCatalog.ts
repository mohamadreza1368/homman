/**
 * Micro-Anatomy & Histology Catalog (Junqueira's Basic Histology & Netter)
 *
 * Provides cellular & functional micro-architecture for organs whose
 * microscopic subunits (nephron, hepatic lobule, alveolar-capillary unit,
 * gastric gland, blood-brain barrier & meninges) cannot be resolved at
 * macro whole-body mesh scale.
 */

export interface MicroAnatomyLayer {
  nameFa: string;
  nameEn: string;
  roleFa: string;
  roleEn: string;
  colorHex: string;
}

export interface MicroAnatomyProfile {
  id: string;
  pattern: RegExp;
  titleFa: string;
  titleEn: string;
  unitNameFa: string;
  unitNameEn: string;
  summaryFa: string;
  summaryEn: string;
  layers: MicroAnatomyLayer[];
}

export const MICRO_ANATOMY_CATALOG: MicroAnatomyProfile[] = [
  {
    id: "renal_nephron",
    pattern: /kidney|renal/i,
    titleFa: "میکروآناتومی کلیه: نفرون (Nephron)",
    titleEn: "Renal Micro-Anatomy: The Nephron",
    unitNameFa: "حدود ۱ میلیون نفرون در هر کلیه",
    unitNameEn: "~1 Million Functional Nephrons per Kidney",
    summaryFa:
      "واحد سازنده و تصفیه‌کنندهٔ ادرار شامل کلافک گلومرولی (فیلتراسیون پلاسما)، لولهٔ پیچیدهٔ نزدیک (بازجذب ۶۵٪ آب و الکترولیت‌ها)، قوس هنله (تغلیظ ادرار) و مجرای جمع‌کننده.",
    summaryEn:
      "Functional filtration unit comprising renal corpuscle (glomerulus + Bowman's capsule), proximal convoluted tubule, loop of Henle, distal tubule, and collecting duct.",
    layers: [
      {
        nameFa: "کپسول بومن و پودوسیت‌ها (سد فیلتراسیون)",
        nameEn: "Glomerulus & Podocytes (Filtration Barrier)",
        roleFa: "تصفیهٔ پلاسما با عبور آب و املاح کوچک و ممانعت از دفع پروتئین‌هایی مانند آلبومین.",
        roleEn: "Ultrafiltration across fenestrated endothelium, GBM, and podocyte slit diaphragms.",
        colorHex: "#f43f5e",
      },
      {
        nameFa: "لولهٔ پیچیدهٔ نزدیک (PCT)",
        nameEn: "Proximal Convoluted Tubule (PCT)",
        roleFa: "بازجذب ۱۰۰٪ گلوکز و آمینواسیدها و ۶۵٪ سدیم و آب به کمک پرزهای میکروویلی.",
        roleEn: "Reabsorbs ~65% filtered Na+/water and 100% glucose/amino acids via brush border.",
        colorHex: "#f59e0b",
      },
      {
        nameFa: "قوس هنله و دستگاه ژوگستاگلومرولار (JGA)",
        nameEn: "Loop of Henle & JGA",
        roleFa: "ایجاد گرادیان اسمزی مدولاری (تکثیر جریان متقابل) و تنظیم فشار خون از طریق رنین.",
        roleEn: "Countercurrent multiplier establishing medullary osmotic gradient; macula densa regulates GFR.",
        colorHex: "#eab308",
      },
      {
        nameFa: "لولهٔ پیچیدهٔ دور و مجرای جمع‌کننده",
        nameEn: "DCT & Collecting Duct",
        roleFa: "تنظیم نهایی پتاسیم، اسید-باز و بازجذب آب تحت کنترل آلدوسترون و هورمون ADH (آکواپورین-۲).",
        roleEn: "Fine-tuning of K+, H+, and water reabsorption regulated by Aldosterone and ADH.",
        colorHex: "#38bdf8",
      },
    ],
  },
  {
    id: "hepatic_lobule",
    pattern: /liver|segment_of_liver/i,
    titleFa: "میکروآناتومی کبد: لوبول کلاسیک کبدی",
    titleEn: "Hepatic Micro-Anatomy: Classic Hepatic Lobule",
    unitNameFa: "ساختار شش‌ضلعی با تریاد پورتال و ورید مرکزی",
    unitNameEn: "Hexagonal Lobule with Portal Triads & Central Vein",
    summaryFa:
      "جریان خون از تریاد پورتال در گوشه‌ها (شریان هپاتیک + ورید پورت) از میان سینوزوئیدهای کبدی و هپاتوسیت‌ها به سمت ورید مرکزی حرکت می‌کند، در حالی که صفرا در جهت معکوس به مجرای صفراوی می‌رود.",
    summaryEn:
      "Blood flows centripetally from corner portal triads through sinusoids to the central vein, while bile flows centrifugally through canaliculi toward bile ductules.",
    layers: [
      {
        nameFa: "تریاد پورتال (شریان، ورید پورت، مجرای صفراوی)",
        nameEn: "Portal Triad (Zone 1 Periportal)",
        roleFa: "بیشترین اکسیژن‌رسانی (حساس‌ترین ناحیه به مسمومیت‌های اکسیداتیو، مقاوم‌تر در برابر ایسکمی).",
        roleEn: "Highest oxygenation; site of gluconeogenesis and urea synthesis.",
        colorHex: "#10b981",
      },
      {
        nameFa: "صفحات هپاتوسیت و کانالیکول‌های صفراوی",
        nameEn: "Hepatocyte Plates & Canaliculi",
        roleFa: "متابولیسم داروها (CYP450)، سنتز آلبومین و فاکتورهای انعقادی و ترشح صفرا.",
        roleEn: "Xenobiotic detoxification, plasma protein synthesis, glycogen storage, and bile secretion.",
        colorHex: "#a16207",
      },
      {
        nameFa: "سینوزوئیدها، سلول‌های کوپفر و فضای دیسه (Disse)",
        nameEn: "Sinusoids, Kupffer & Stellate (Ito) Cells",
        roleFa: "ماکروفاژهای کوپفر باکتری‌ها را پاکسازی می‌کنند و سلول‌های ستاره‌ای ایتو ویتامین A را ذخیره می‌کنند (عامل فیبروز در سیروز).",
        roleEn: "Kupffer macrophages clear pathogens; hepatic stellate cells store vitamin A and mediate fibrosis.",
        colorHex: "#dc2626",
      },
      {
        nameFa: "ورید مرکزی (Zone 3 Centrilobular)",
        nameEn: "Central Vein (Zone 3)",
        roleFa: "کمترین اکسیژن و بیشترین آسیب‌پذیری در نکروز ایسکمیک (Shock Liver) و مسمومیت استامینوفن.",
        roleEn: "Lowest oxygenation; highest susceptibility to ischemic necrosis and acetaminophen toxicity.",
        colorHex: "#3b82f6",
      },
    ],
  },
  {
    id: "alveolar_unit",
    pattern: /lung|bronch/i,
    titleFa: "میکروآناتومی ریه: واحد آلوئولی-مویرگی",
    titleEn: "Pulmonary Micro-Anatomy: Alveolar-Capillary Unit",
    unitNameFa: "حدود ۳۰۰ تا ۵۰۰ میلیون آلوئول (~۷۰ مترمربع سطح تبادل)",
    unitNameEn: "~300-500 Million Alveoli (~70 m² Gas Exchange Area)",
    summaryFa:
      "سد خونی-هوایی با ضخامت حدود ۰٫۵ میکرومتر اجازهٔ انتشار سریع اکسیژن و دی‌اکسید کربن را می‌دهد.",
    summaryEn:
      "Ultra-thin (~0.5 µm) blood-air barrier enabling rapid passive diffusion of O2 and CO2.",
    layers: [
      {
        nameFa: "پنوموسیت‌های تیپ I (سنگفرشی)",
        nameEn: "Type I Pneumocytes (Squamous)",
        roleFa: "۹۵٪ سطح آلوئول را پوشانده و دیوارهٔ اصلی تبادل گازها را می‌سازند.",
        roleEn: "Cover ~95% of alveolar surface area, forming the primary gas diffusion membrane.",
        colorHex: "#38bdf8",
      },
      {
        nameFa: "پنوموسیت‌های تیپ II (ترشح سورفاکتانت)",
        nameEn: "Type II Pneumocytes (Surfactant)",
        roleFa: "تولید سورفاکتانت (دی‌پالمیتوئیل لسیتین) برای کاهش کشش سطحی و پیشگیری از کلاپس آلوئول، و بازسازی تیپ I.",
        roleEn: "Secrete pulmonary surfactant to reduce surface tension and prevent atelectasis; act as stem cells.",
        colorHex: "#10b981",
      },
      {
        nameFa: "ماکروفاژهای آلوئولی (Dust Cells)",
        nameEn: "Alveolar Macrophages",
        roleFa: "بلع ذرات گردوغبار و باکتری‌ها در فضای تنفسی.",
        roleEn: "Phagocytose inhaled particulates and pathogens; clear debris.",
        colorHex: "#a855f7",
      },
    ],
  },
  {
    id: "gastric_gland",
    pattern: /stomach|mucosa_of_stomach/i,
    titleFa: "میکروآناتومی معده: غدد فوندیک و چین‌های مخاطی",
    titleEn: "Gastric Micro-Anatomy: Gastric Gland & Rugae",
    unitNameFa: "اپیتلیوم استوانه‌ای ساده + غدد معدی",
    unitNameEn: "Simple Columnar Mucosa & Oxyntic Glands",
    summaryFa:
      "پنجرهٔ برش روی مش بیرونی معده برای نمایش چین‌های مخاطی (`Rugae`) است که از ۴ نوع سلول ترشحی کلیدی تشکیل شده‌اند.",
    summaryEn:
      "The anatomical window on the stomach wall exposes internal gastric rugae lined by specialized secretory cells.",
    layers: [
      {
        nameFa: "سلول‌های مخاطی سطحی و گردنی (Mucous Cells)",
        nameEn: "Surface & Neck Mucous Cells",
        roleFa: "ترشح لایهٔ غلیظ موکوس قلیایی حاوی بی‌کربنات جهت محافظت از دیواره در برابر اسید معده.",
        roleEn: "Secrete bicarbonate-rich mucus barrier protecting mucosa from acid autodigestion.",
        colorHex: "#fbbf24",
      },
      {
        nameFa: "سلول‌های جداری (Parietal / Oxyntic Cells)",
        nameEn: "Parietal Cells",
        roleFa: "ترشح اسید کلریدریک (HCl با pH 1-2) و فاکتور داخلی (Intrinsic Factor) ضروری برای جذب ویتامین B12.",
        roleEn: "Secrete HCl (pH 1-2) via H+/K+ ATPase and Intrinsic Factor required for B12 absorption.",
        colorHex: "#ef4444",
      },
      {
        nameFa: "سلول‌های اصلی (Chief / Zymogenic Cells)",
        nameEn: "Chief Cells",
        roleFa: "ترشح پپسینوژن (پیش‌ساز آنزیم هضم‌کنندهٔ پروتئین پپسین) و لیپاز معدی.",
        roleEn: "Secrete pepsinogen (activated by HCl into pepsin) and gastric lipase.",
        colorHex: "#3b82f6",
      },
      {
        nameFa: "سلول‌های انترواندوکرین (G & ECL Cells)",
        nameEn: "G Cells & Enterochromaffin-like Cells",
        roleFa: "ترشح گاسترین و هیستامین برای تحریک قدرتمند ترشح اسید از سلول‌های جداری.",
        roleEn: "Secrete gastrin and histamine to drive acid secretion.",
        colorHex: "#8b5cf6",
      },
    ],
  },
  {
    id: "meninges_bbb",
    pattern: /brain|cerebr|dura|falx|tentorium|spinal_cord/i,
    titleFa: "میکروآناتومی مننژ و سد خونی-مغزی (BBB)",
    titleEn: "Meningeal Layers & Blood-Brain Barrier",
    unitNameFa: "سه لایهٔ محافظتی مننژ + سد آستروسیتی",
    unitNameEn: "Tri-Layer Meninges & Neurovascular Unit",
    summaryFa:
      "پردهٔ مننژ شامل سخت‌شامه (Dura)، عنکبوتیه (Arachnoid) و نرم‌شامه (Pia) همراه با فضای زیرعنکبوتیه حاوی مایع مغزی-نخاعی (CSF) است.",
    summaryEn:
      "Three protective membranes (Dura, Arachnoid, Pia mater) enclosing the CSF-filled subarachnoid space and tight-junction BBB.",
    layers: [
      {
        nameFa: "سخت‌شامه (Dura Mater - لایه پریوستئال و مننژیال)",
        nameEn: "Dura Mater (Pachymeninx)",
        roleFa: "ضخیم‌ترین لایهٔ فیبری؛ تشکیل‌دهندهٔ داس مغزی (Falx)، چادرینه مخچه (Tentorium) و سینوس‌های وریدی.",
        roleEn: "Tough fibrous outer membrane forming falx cerebri, tentorium cerebelli, and dural venous sinuses.",
        colorHex: "#64748b",
      },
      {
        nameFa: "عنکبوتیه (Arachnoid) و فضای ساب‌آراکنوئید",
        nameEn: "Arachnoid Mater & Subarachnoid Space",
        roleFa: "حامل مایع مغزی-نخاعی (CSF) و شریان‌های بزرگ مغزی؛ پرزهای آراکنوئید CSF را به خون بازجذب می‌کنند.",
        roleEn: "Contains CSF and major cerebral vessels; arachnoid granulations reabsorb CSF into superior sagittal sinus.",
        colorHex: "#38bdf8",
      },
      {
        nameFa: "نرم‌شامه (Pia Mater) و زوائد آستروسیت (BBB)",
        nameEn: "Pia Mater & Blood-Brain Barrier",
        roleFa: "چسبیده به سطح مغز؛ اتصالات محکم اندوتلیال (Tight Junctions) و پایک‌های آستروسیتی ورود سموم را مسدود می‌کنند.",
        roleEn: "Delicate vascular layer intimately investing gyri; astrocyte foot processes reinforce tight-junction BBB.",
        colorHex: "#10b981",
      },
    ],
  },
];

export function getMicroAnatomyProfile(organId: string): MicroAnatomyProfile | undefined {
  return MICRO_ANATOMY_CATALOG.find((p) => p.pattern.test(organId));
}
