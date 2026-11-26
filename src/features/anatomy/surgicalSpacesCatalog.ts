/**
 * Atlas of Surgical Triangles & Spaces (Gray's Surgical Anatomy)
 *
 * Implements authoritative surgical anatomical landmarks, boundaries,
 * neurovascular contents, and high-yield clinical pearls for operative
 * planning and clinical examination.
 */

export interface SurgicalSpace {
  id: string;
  nameFa: string;
  nameEn: string;
  eponymFa: string;
  eponymEn: string;
  region: "neck" | "thorax" | "abdomen" | "pelvis_groin" | "upper_limb" | "lower_limb";
  boundaries: {
    fa: string;
    en: string;
    superior?: { fa: string; en: string };
    inferior?: { fa: string; en: string };
    medial?: { fa: string; en: string };
    lateral?: { fa: string; en: string };
    anterior?: { fa: string; en: string };
    posterior?: { fa: string; en: string };
    floor?: { fa: string; en: string };
    roof?: { fa: string; en: string };
  };
  contents: {
    fa: string[];
    en: string[];
  };
  clinicalSignificance: {
    fa: string;
    en: string;
  };
  surgicalKeyPoint: {
    fa: string;
    en: string;
  };
  targetOrganId?: string;
  relatedOrganPatterns: RegExp[];
}

export const SURGICAL_SPACES_CATALOG: SurgicalSpace[] = [
  {
    id: "calots_triangle",
    nameFa: "مثلث کالوت (مثلث سیستوهپاتیک)",
    nameEn: "Calot's Triangle (Cystohepatic Triangle)",
    eponymFa: "مثلث کلسیانی کالوت (Jean-François Calot)",
    eponymEn: "Triangle of Calot / Cystohepatic Triangle",
    region: "abdomen",
    boundaries: {
      fa: "فوقانی: سطح تحتانی کبد؛ داخلی: مجرای مشترک کبدی (CHD)؛ تحتانی: مجرای سیستیک کیسه صفرا",
      en: "Superior: Inferior visceral surface of liver; Medial: Common hepatic duct; Inferior: Cystic duct",
      superior: { fa: "سطح تحتانی لوب راست کبد", en: "Inferior surface of liver (Segment V)" },
      inferior: { fa: "مجرای سیستیک کیسه صفرا", en: "Cystic duct" },
      medial: { fa: "مجرای هپاتیک مشترک (CHD)", en: "Common hepatic duct" },
    },
    contents: {
      fa: [
        "شریان سیستیک (Cystic Artery)",
        "غده لنفاوی کالوت (Lund's / Mascagni's Node)",
        "مجرای صفراوی فرعی لوشکا (در ۲۰٪ موارد)",
        "شریان هپاتیک راست نابجا (Aberrant Right Hepatic Artery)",
      ],
      en: [
        "Cystic artery",
        "Calot's lymph node (Node of Lund)",
        "Accessory ducts of Luschka (variant)",
        "Aberrant right hepatic artery (variant)",
      ],
    },
    clinicalSignificance: {
      fa: "دستیابی به نمای بحرانی ایمنی (Critical View of Safety - CVS) در جراحی لاپاروسکوپیک کوله‌سیستکتومی جهت پیشگیری قطعی از آسیب مرگبار به مجرای صفراوی اصلی (CBD).",
      en: "Establishing the Critical View of Safety (CVS) during laparoscopic cholecystectomy to prevent catastrophic bile duct injury.",
    },
    surgicalKeyPoint: {
      fa: "تا زمانی که مثلث از چربی پاکسازی نشده و تنها دو ساختار (شریان سیستیک و مجرای سیستیک) مستقیماً وارد کیسه صفرا نشده‌اند، هیچ کلیپسی نباید زده شود.",
      en: "No clip or division until both cystic artery and duct are seen entering the gallbladder directly and the lower third of the liver bed is cleared.",
    },
    targetOrganId: "gallbladder",
    relatedOrganPatterns: [/gallbladder/i, /hepatic_artery/i, /hepatic_duct/i, /cystic_artery/i, /liver/i],
  },
  {
    id: "femoral_triangle",
    nameFa: "مثلث رانی اسکارپا",
    nameEn: "Femoral Triangle (Scarpa's Triangle)",
    eponymFa: "مثلث اسکارپا (Antonio Scarpa)",
    eponymEn: "Scarpa's Triangle",
    region: "pelvis_groin",
    boundaries: {
      fa: "فوقانی: رباط اینگوینال (پوپارت)؛ لترال: عضله سارتوریوس؛ مدیکال: عضله ادکتور لونگوس؛ کف: عضلات پکتینئوس و ایلیوپسواس؛ سقف: فاشیا لاتا",
      en: "Superior: Inguinal ligament; Lateral: Medial border of sartorius; Medial: Medial border of adductor longus; Floor: Pectineus and iliopsoas; Roof: Fascia lata",
      superior: { fa: "رباط اینگوینال (پوپارت)", en: "Inguinal ligament" },
      lateral: { fa: "لبه داخلی عضله سارتوریوس", en: "Medial margin of sartorius muscle" },
      medial: { fa: "لبه داخلی عضله ادکتور لونگوس", en: "Medial margin of adductor longus" },
      floor: { fa: "عضله پکتینئوس و عضله ایلیوپسواس", en: "Pectineus and iliopsoas muscles" },
      roof: { fa: "فاشیا لاتا و غلاف کریبریفورم", en: "Fascia lata and cribriform fascia" },
    },
    contents: {
      fa: [
        "از لترال به مدیکال به ترتیب مخفف NAVEL:",
        "N: عصب فمورال (خارج غلاف فمورال)",
        "A: شریان فمورال و شاخه‌های عمقی آن",
        "V: ورید فمورال و پیوستگاه ورید صافن بزرگ",
        "E: فضای خالی کانال فمورال (Empty Space)",
        "L: لنف نودهای عمقی اینگوینال (گره کلوکت / روزنمولر)",
      ],
      en: [
        "From lateral to medial (NAVEL):",
        "N: Femoral nerve (outside femoral sheath)",
        "A: Femoral artery",
        "V: Femoral vein",
        "E: Empty space (femoral canal)",
        "L: Deep inguinal lymphatics (Cloquet's node)",
      ],
    },
    clinicalSignificance: {
      fa: "محل رخداد فتق فمورال (ورود به کانال فمورال از مدیکال ورید فمورال با خطر بالای خفگی/استرانگولاسیون)، کاتتریزاسیون شریانی و وریدی، و بیحسی بلوک عصب فمورال.",
      en: "Site of femoral hernia (high risk of strangulation in rigid femoral ring), vascular catheterization, and femoral nerve block.",
    },
    surgicalKeyPoint: {
      fa: "نبض شریان فمورال دقیقاً در نقطه میانی بین سمفیز پوبیس و خار خاصره قدامی فوقانی (ASIS) لمس می‌شود؛ ورید فمورال مدیکال به شریان قرار دارد.",
      en: "Femoral artery pulse is palpated at mid-inguinal point; femoral vein lies immediately medial to the artery.",
    },
    targetOrganId: "sartorius_muscle_l",
    relatedOrganPatterns: [/sartorius/i, /femoral_artery/i, /femoral_vein/i, /femoral_nerve/i, /pectineus/i, /adductor_longus/i],
  },
  {
    id: "hesselbachs_triangle",
    nameFa: "مثلث هسلباخ و مجرای اینگوینال",
    nameEn: "Hesselbach's Triangle & Inguinal Canal",
    eponymFa: "مثلث هسلباخ (Franz Kaspar Hesselbach)",
    eponymEn: "Inguinal Triangle of Hesselbach",
    region: "pelvis_groin",
    boundaries: {
      fa: "لترال: عروق اپی‌گاستریک تحتانی؛ مدیکال: لبه لترال عضله رکتوس ابدومینیس؛ تحتانی: رباط اینگوینال (پوپارت)؛ کف: فاشیا ترانسورسالیس",
      en: "Superolateral: Inferior epigastric vessels; Medial: Lateral border of rectus abdominis; Inferior: Inguinal ligament; Floor: Transversalis fascia",
      lateral: { fa: "عروق اپی‌گاستریک تحتانی (شریان و ورید)", en: "Inferior epigastric artery and vein" },
      medial: { fa: "لبه لترال غلاف رکتوس (Linea semilunaris)", en: "Lateral margin of rectus abdominis muscle" },
      inferior: { fa: "رباط اینگوینال", en: "Inguinal ligament" },
      floor: { fa: "فاشیا ترانسورسالیس و تاندون مشترک (Conjoint tendon)", en: "Transversalis fascia and conjoint tendon" },
    },
    contents: {
      fa: [
        "سوراخ مستقیم فتق اینگوینال (Direct Inguinal Hernia)",
        "طناب اسپرماتیک (در مردان) / رباط گرد رحم (در زنان) در مجرای مجاور",
        "عصب ایلیواینگوینال",
      ],
      en: [
        "Floor traversed by direct inguinal hernia",
        "Spermatic cord (males) / Round ligament (females) passing anteriorly",
        "Ilioinguinal nerve",
      ],
    },
    clinicalSignificance: {
      fa: "تمایز بالینی فتق مستقیم از غیرمستقیم: فتق مستقیم از کف مثلث هسلباخ (مدیکال عروق اپی‌گاستریک تحتانی) عبور می‌کند؛ فتق غیرمستقیم از حلقه عمقی (لترال عروق) وارد مجرا می‌شود.",
      en: "Direct vs indirect inguinal hernia differentiation: Direct occurs medial to inferior epigastric vessels through Hesselbach triangle floor; Indirect passes lateral to vessels via deep ring.",
    },
    surgicalKeyPoint: {
      fa: "در لاپاروسکوپی TAPP/TEP مراقب مثلث مرگ (Triangle of Doom - حاوی عروق ایلیاک خارجی) و مثلث درد (Triangle of Pain - حاوی اعصاب حسی فمورال و ژنیتوفمورال) باشید.",
      en: "During TAPP/TEP repairs, identify Triangle of Doom (external iliac vessels) and Triangle of Pain (femoral/lateral femoral cutaneous nerves) before tack placement.",
    },
    targetOrganId: "rectus_abdominis_muscle_l",
    relatedOrganPatterns: [/rectus_abdominis/i, /epigastric/i, /inguinal/i],
  },
  {
    id: "carotid_triangle",
    nameFa: "مثلث کاروتید گردن",
    nameEn: "Carotid Triangle",
    eponymFa: "مثلث کاروتید قدام گردن",
    eponymEn: "Carotid Triangle of Anterior Neck",
    region: "neck",
    boundaries: {
      fa: "خلفی: لبه قدامی عضله استرنوکلیدوماستوئید (SCM)؛ قدامی-فوقانی: بطن خلفی عضله دیگاستریک؛ قدامی-تحتانی: بطن فوقانی عضله اوموهیوئید",
      en: "Posterior: Anterior border of sternocleidomastoid (SCM); Anterosuperior: Posterior belly of digastric; Anteroinferior: Superior belly of omohyoid",
      lateral: { fa: "لبه قدامی عضله استرنوکلیدوماستوئید (SCM)", en: "Anterior border of SCM" },
      superior: { fa: "بطن خلفی دیگاستریک و استایلوهیوئید", en: "Posterior belly of digastric" },
      inferior: { fa: "بطن فوقانی عضله اوموهیوئید", en: "Superior belly of omohyoid" },
    },
    contents: {
      fa: [
        "دو شاخه شدن شریان کاروتید مشترک به کاروتید داخلی و خارجی",
        "سینوس و گلوموس کاروتید (گیرنده‌های فشار و شیمیایی)",
        "ورید ژوگولار داخلی (IJV)",
        "عصب واگ (CN X) درون غلاف کاروتید",
        "عصب هیپوگلوس (CN XII) عبور کننده از روی کاروتید",
        "قوس آنسا سرویکالیس (Ansa cervicalis)",
      ],
      en: [
        "Bifurcation of common carotid into internal and external carotid arteries",
        "Carotid sinus and carotid body",
        "Internal jugular vein (IJV)",
        "Vagus nerve (CN X)",
        "Hypoglossal nerve (CN XII)",
        "Ansa cervicalis loop",
      ],
    },
    clinicalSignificance: {
      fa: "محل جراحی اندارترکتومی کاروتید (CEA)، لمس نبض شریان کاروتید مشترک، و رویکرد جراحی به غلاف عروقی گردن.",
      en: "Site of carotid endarterectomy (CEA), carotid pulse palpation, and vascular approach for neck dissection.",
    },
    surgicalKeyPoint: {
      fa: "حین اندارترکتومی، عصب هیپوگلوس که از روی شاخه‌های کاروتید می‌گذرد باید با دقت شناسایی و محافظت شود تا از انحراف زبان جلوگیری شود.",
      en: "Hypoglossal nerve (CN XII) crosses superficial to both internal and external carotid arteries and must be preserved to prevent tongue deviation.",
    },
    targetOrganId: "left_common_carotid_artery",
    relatedOrganPatterns: [/carotid/i, /sternocleidomastoid/i, /internal_jugular/i, /digastric/i, /omohyoid/i, /vagus/i],
  },
  {
    id: "muscular_triangle",
    nameFa: "مثلث عضلانی قدام گردن",
    nameEn: "Muscular Triangle (Tracheal Triangle)",
    eponymFa: "مثلث تراکئال / اینفراهیوئید",
    eponymEn: "Muscular / Omotracheal Triangle",
    region: "neck",
    boundaries: {
      fa: "قدامی: خط وسط گردن از استخوان هیوئید تا بریدگی ژوگولار؛ خلفی-فوقانی: بطن فوقانی اوموهیوئید؛ خلفی-تحتانی: لبه قدامی استرنوکلیدوماستوئید",
      en: "Anterior: Anterior midline of neck; Posterosuperior: Superior belly of omohyoid; Posteroinferior: Anterior border of sternocleidomastoid",
      medial: { fa: "خط وسط قدامی گردن", en: "Anterior midline of neck" },
      superior: { fa: "بطن فوقانی عضله اوموهیوئید", en: "Superior belly of omohyoid" },
      inferior: { fa: "لبه قدامی تحتانی استرنوکلیدوماستوئید", en: "Lower anterior border of SCM" },
    },
    contents: {
      fa: [
        "عضلات اینفراهیوئید (استرنوتیروئید، استرنوهیوئید)",
        "غده تیروئید و غدد پاراتیروئید",
        "نای (تراشه) و حنجره",
        "مری سرویکال",
        "شریان تیروئید تحتانی و عصب راکرنت لاریینجیال",
      ],
      en: [
        "Infrahyoid strap muscles (sternohyoid, sternothyroid)",
        "Thyroid gland and parathyroid glands",
        "Larynx and trachea",
        "Cervical esophagus",
        "Inferior thyroid artery and recurrent laryngeal nerve",
      ],
    },
    clinicalSignificance: {
      fa: "مسیر اصلی جراحی تیروئیدکتومی، تراکئوستومی اورژانس/انتخابی، و کریکوتیروئیدوتومی سوزنی و جراحی.",
      en: "Primary surgical access for thyroidectomy, parathyroidectomy, tracheostomy, and cricothyroidotomy.",
    },
    surgicalKeyPoint: {
      fa: "عصب راکرنت لارنژیال (RLN) در ناودان بین نای و مری و در مجاورت شریان تیروئید تحتانی قرار دارد و آسیب آن به گرفتگی صدا یا انسداد حنجره می‌انجامد.",
      en: "Recurrent laryngeal nerve runs in tracheoesophageal groove intimately associated with inferior thyroid artery branches.",
    },
    targetOrganId: "thyroid_cartilage",
    relatedOrganPatterns: [/thyroid/i, /trachea/i, /sternohyoid/i, /omohyoid/i, /larynx/i],
  },
  {
    id: "popliteal_fossa",
    nameFa: "حفره پوپلیتئال زانو",
    nameEn: "Popliteal Fossa",
    eponymFa: "لوزی پوپلیتئال خلف زانو",
    eponymEn: "Popliteal Diamond",
    region: "lower_limb",
    boundaries: {
      fa: "فوقانی-لترال: تاندون بایسپس فموریس؛ فوقانی-مدیکال: عضلات سمی‌ممبرانوسوس و سمی‌تندینوسوس؛ تحتانی-لترال: سر لترال گاستروکنمیوس و پلانتاریس؛ تحتانی-مدیکال: سر مدیکال گاستروکنمیوس",
      en: "Superolateral: Biceps femoris; Superomedial: Semimembranosus and semitendinosus; Inferolateral: Lateral head of gastrocnemius; Inferomedial: Medial head of gastrocnemius",
      lateral: { fa: "تاندون عضله دو سر رانی (Biceps femoris)", en: "Biceps femoris tendon" },
      medial: { fa: "عضلات نیمه‌غشایی و نیمه‌وتری", en: "Semimembranosus and semitendinosus" },
      inferior: { fa: "سرهای مدیکال و لترال عضله دوقلو (Gastrocnemius)", en: "Medial and lateral heads of gastrocnemius" },
      floor: { fa: "سطح پوپلیتئال فمور و عضله پوپلیتئوس", en: "Popliteal surface of femur, oblique popliteal ligament, and popliteus" },
    },
    contents: {
      fa: [
        "از عمقی به سطحی: شریان پوپلیتئال (عمیق‌ترین ساختار، چسبیده به استخوان)",
        "ورید پوپلیتئال و انتهای ورید صافن کوچک",
        "عصب تیبیال (شاخه اصلی عصب سیاتیک)",
        "عصب پرونئال مشترک (حرکت در مجاورت لبه لترال)",
        "غدد لنفاوی پوپلیتئال",
      ],
      en: [
        "From deep to superficial: Popliteal artery (deepest, resting against bone)",
        "Popliteal vein and small saphenous vein termination",
        "Tibial nerve (central continuation)",
        "Common fibular (peroneal) nerve (lateral border)",
        "Popliteal lymph nodes",
      ],
    },
    clinicalSignificance: {
      fa: "محل آنوریسم شریان پوپلیتئال (شایع‌ترین آنوریسم شریانی محیطی)، کیست بیکر (Baker's Cyst) در بورس سمی‌ممبرانوسوس، و آسیب عصب پرونئال به علت شکستگی گردن فیبولا.",
      en: "Site of popliteal aneurysm (most common peripheral aneurysm), Baker's cyst, and examination of popliteal artery pulse.",
    },
    surgicalKeyPoint: {
      fa: "شریان پوپلیتئال عمیق‌ترین ساختار حفره است؛ نبض آن با خم کردن خفیف زانو و لمس عمیق دو دستی لمس می‌شود.",
      en: "Popliteal artery is the deepest neurovascular structure, lying directly against the popliteal surface of the femur.",
    },
    targetOrganId: "popliteal_artery_l",
    relatedOrganPatterns: [/popliteal/i, /biceps_femoris/i, /semimembranosus/i, /semitendinosus/i, /gastrocnemius/i, /tibial_nerve/i],
  },
  {
    id: "anatomical_snuffbox",
    nameFa: "انفیه‌دان آناتومیک مچ دست",
    nameEn: "Anatomical Snuffbox (Radial Fossa)",
    eponymFa: "انفیه‌دان رادیال مچ دست",
    eponymEn: "Anatomical Snuffbox",
    region: "upper_limb",
    boundaries: {
      fa: "مدیکال: تاندون بازکننده دراز شست (EPL)؛ لترال: تاندون‌های بازکننده کوتاه شست (EPB) و دورکننده دراز شست (APL)؛ کف: استخوان اسکافوئید و تراپزیوم",
      en: "Medial: Extensor pollicis longus (EPL); Lateral: Extensor pollicis brevis (EPB) and abductor pollicis longus (APL); Floor: Scaphoid and trapezium bones",
      medial: { fa: "تاندون اکستنسور پولیسیس لونگوس (EPL)", en: "Extensor pollicis longus tendon" },
      lateral: { fa: "تاندون‌های اکستنسور پولیسیس برویس (EPB) و ابدکتور پولیسیس لونگوس (APL)", en: "EPB and APL tendons" },
      floor: { fa: "استخوان‌های اسکافوئید و تراپزیوم مچ دست", en: "Scaphoid and trapezium carpal bones" },
    },
    contents: {
      fa: [
        "شریان رادیال (عبور کننده از کف انفیه‌دان)",
        "شاخه‌های حسی سطحی عصب رادیال",
        "مبدأ ورید سفالیک مچ دست",
      ],
      en: [
        "Radial artery crossing floor",
        "Superficial branch of radial nerve",
        "Origin of cephalic vein",
      ],
    },
    clinicalSignificance: {
      fa: "تندرنس نقطه‌ای حین لمس کف انفیه‌دان نشانگر تشخیصی شکستگی استخوان اسکافوئید (شایع‌ترین شکستگی کارپال) با خطر بالای نکروز آواسکولار (AVN) قطب پروگزیمال است.",
      en: "Point tenderness in the floor indicates scaphoid fracture with high risk of avascular necrosis (AVN) of the proximal pole.",
    },
    surgicalKeyPoint: {
      fa: "خونرسانی استخوان اسکافوئید رتروگراد است؛ شکستگی کمر اسکافوئید قطب پروگزیمال را فاقد خونرسانی کرده و نیازمند فیکساسیون پیچی دقیق است.",
      en: "Retrograde blood supply of scaphoid predisposes proximal pole to nonunion and avascular necrosis upon waist fracture.",
    },
    targetOrganId: "scaphoid_bone_l",
    relatedOrganPatterns: [/extensor_pollicis/i, /abductor_pollicis/i, /radial_artery/i, /scaphoid/i, /trapezium/i],
  },
  {
    id: "carpal_tunnel",
    nameFa: "تونل کارپال مچ دست",
    nameEn: "Carpal Tunnel",
    eponymFa: "کانال مچی دست",
    eponymEn: "Carpal Canal",
    region: "upper_limb",
    boundaries: {
      fa: "قدامی (سقف): رتیناکولوم فلکسور (رباط عرضی مچ دست)؛ خلفی-طرفی (کف و دیواره‌ها): قوس مقعر استخوان‌های هشت‌گانه کارپال",
      en: "Anterior (Roof): Flexor retinaculum (transverse carpal ligament); Posterior/Lateral/Medial (Floor): Concave carpal arch",
      roof: { fa: "رباط عرضی مچ دست (Flexor retinaculum)", en: "Transverse carpal ligament (flexor retinaculum)" },
      floor: { fa: "قوس استخوان‌های کارپال (اسکافوئید، پیزیفورم، تراپزیوم، هامات)", en: "Carpal sulcus formed by scaphoid, trapezium, pisiform, and hook of hamate" },
    },
    contents: {
      fa: [
        "عصب مدین (Median Nerve) - تنها ساختار عصبی تونل",
        "۴ تاندون عضله فلکسور دیژیتوروم سوپرفیشیالیس (FDS)",
        "۴ تاندون عضله فلکسور دیژیتوروم پروفوندوس (FDP)",
        "۱ تاندون عضله فلکسور پولیسیس لونگوس (FPL)",
        "غلاف سینوویال تاندون‌ها",
      ],
      en: [
        "Median nerve (sole nervous structure)",
        "4 tendons of flexor digitorum superficialis (FDS)",
        "4 tendons of flexor digitorum profundus (FDP)",
        "1 tendon of flexor pollicis longus (FPL)",
        "Tenosynovial sheaths",
      ],
    },
    clinicalSignificance: {
      fa: "سندرم تونل کارپال (CTS) ناشی از فشردگی عصب مدین با گزگز و درد انگشتان شست، اشاره و میانی، آتروفی تنار، و مثبت شدن تست‌های فالن (Phalen) و تینل (Tinel).",
      en: "Carpal tunnel syndrome (CTS) from median nerve compression, leading to paresthesias in radial 3.5 digits, thenar atrophy, and positive Phalen/Tinel tests.",
    },
    surgicalKeyPoint: {
      fa: "حین جراحی آزادسازی تونل کارپال (CTR)، برش رباط باید به سمت لبه اولنار هدایت شود تا از آسیب به شاخه حرکتی راکرنت تنار عصب مدین محافظت گردد.",
      en: "In carpal tunnel release, divide transverse carpal ligament along its ulnar border to protect the recurrent motor branch to the thenar muscles.",
    },
    targetOrganId: "scaphoid_bone_l",
    relatedOrganPatterns: [/median_nerve/i, /flexor_digitorum/i, /flexor_pollicis/i, /carpal/i, /trapezium/i, /hamate/i],
  },
  {
    id: "cubital_fossa",
    nameFa: "حفره کوبیتال قدام آرنج",
    nameEn: "Cubital Fossa",
    eponymFa: "حفره مفصل آرنج",
    eponymEn: "Antecubital Fossa",
    region: "upper_limb",
    boundaries: {
      fa: "فوقانی: خط فرضی بین اپی‌کندیل‌های داخلی و خارجی بازو؛ لترال: عضله براکیورادیالیس؛ مدیکال: عضله پرونئیتور ترس؛ کف: عضلات براکیالیس و سوپیناتور",
      en: "Superior: Imaginary interepicondylar line; Lateral: Brachioradialis; Medial: Pronator teres; Floor: Brachialis and supinator muscles",
      superior: { fa: "خط افقی میان اپی‌کندیل‌های هومروس", en: "Line connecting medial and lateral epicondyles" },
      lateral: { fa: "لبه مدیکال عضله براکیورادیالیس", en: "Brachioradialis muscle" },
      medial: { fa: "لبه لترال عضله پروناتور ترس", en: "Pronator teres muscle" },
      floor: { fa: "عضله براکیالیس و عضله سوپیناتور", en: "Brachialis and supinator" },
    },
    contents: {
      fa: [
        "از لترال به مدیکال (مخفف TAN):",
        "T: تاندون بایسپس براکیال (Biceps Tendon)",
        "A: شریان براکیال و دو شاخه شدن به رادیال و اولنار",
        "N: عصب مدین (Median Nerve)",
        "ورید مدین کوبیتال در لایه زیرجلدی سطحی (روی آپونوروز بایسیپیتال)",
      ],
      en: [
        "From lateral to medial (TAN):",
        "T: Tendon of biceps brachii",
        "A: Brachial artery (dividing into radial and ulnar arteries)",
        "N: Median nerve",
        "Median cubital vein superficially over bicipital aponeurosis",
      ],
    },
    clinicalSignificance: {
      fa: "شایع‌ترین محل رگ‌گیری و خون‌گیری بالینی (ورید مدین کوبیتال) و سمع فشار خون شریانی با گوشی پزشکی روی شریان براکیال مدیکال به تاندون.",
      en: "Standard site for venipuncture (median cubital vein) and blood pressure auscultation over the brachial artery.",
    },
    surgicalKeyPoint: {
      fa: "آپونوروز بایسیپیتال محافظی کلیدی بین ورید سطحی مدین کوبیتال و شریان عمقی براکیال ایجاد می‌کند و مانع ورود اشتباه سوزن به شریان می‌شود.",
      en: "Bicipital aponeurosis acts as a natural protective shield separating the superficial median cubital vein from the underlying brachial artery.",
    },
    targetOrganId: "brachial_artery_l",
    relatedOrganPatterns: [/brachial_artery/i, /biceps_brachii/i, /pronator_teres/i, /brachioradialis/i, /median_nerve/i],
  },
  {
    id: "foramen_of_winslow",
    nameFa: "سوراخ وینسلو (سوراخ اپیپلوئیک)",
    nameEn: "Epiploic Foramen of Winslow",
    eponymFa: "سوراخ اپیپلوئیک وینسلو (Jacob B. Winslow)",
    eponymEn: "Foramen of Winslow / Omental Foramen",
    region: "abdomen",
    boundaries: {
      fa: "قدامی: رباط هپاتودئودنال (حاوی تریاد پورتال)؛ خلفی: ورید اجوف تحتانی (IVC)؛ فوقانی: لوب کودیت کبد؛ تحتانی: قسمت اول دئودنوم",
      en: "Anterior: Hepatoduodenal ligament (portal triad); Posterior: Inferior vena cava (IVC); Superior: Caudate lobe of liver; Inferior: First part of duodenum",
      anterior: { fa: "رباط هپاتودئودنال (تریاد پورت: ورید پورت، شریان هپاتیک مخصوص، مجرای صفراوی)", en: "Free edge of lesser omentum containing portal triad" },
      posterior: { fa: "ورید اجوف تحتانی (IVC) و پریتوئن جداری", en: "Inferior vena cava" },
      superior: { fa: "لوب کودیت (دُمدار) کبد", en: "Caudate lobe of liver" },
      inferior: { fa: "قسمت اول دئودنوم و شریان هپاتیک", en: "First part of duodenum" },
    },
    contents: {
      fa: [
        "تنها مدخل طبیعی ارتباطی بین کیسه بزرگ پریتوئن (Greater Sac) و بورس امانتال (Lesser Sac)",
        "تریاد پورتال در جدار قدامی آن عبور می‌کند",
      ],
      en: [
        "Only natural communication between greater peritoneal sac and lesser sac (omental bursa)",
        "Portal triad lies directly in its anterior margin",
      ],
    },
    clinicalSignificance: {
      fa: "محل انجام مانور پرینگل (Pringle Maneuver) با کلمپ انگشتی یا عروقی لبه قدامی جهت کنترل خونریزی‌های مرگبار پارانشیم کبد حین تروما یا رزکسیون کبدی.",
      en: "Site for Pringle maneuver (cross-clamping hepatoduodenal ligament) to control torrential hepatic inflow hemorrhage during liver trauma or resection.",
    },
    surgicalKeyPoint: {
      fa: "در مانور پرینگل، در صورت تداوم خونریزی شدید کبدی، باید به خونریزی رتروگراد از وریدهای هپاتیک یا IVC رتروهپاتیک مشکوک شد.",
      en: "If bleeding continues during Pringle clamping, suspect hepatic vein injury or retrohepatic IVC laceration.",
    },
    targetOrganId: "proper_hepatic_artery",
    relatedOrganPatterns: [/hepatic_portal_vein/i, /inferior_vena_cava/i, /proper_hepatic/i, /caudate_lobe/i, /duodenum/i],
  },
];

/**
 * Resolves a surgical space by its unique ID.
 */
export function getSurgicalSpace(spaceId: string): SurgicalSpace | undefined {
  return SURGICAL_SPACES_CATALOG.find((s) => s.id === spaceId);
}

/**
 * Resolves matching organ IDs for a given surgical space based on its patterns.
 */
export function resolveSurgicalSpaceOrgans(space: SurgicalSpace, availableOrganIds: string[]): string[] {
  return availableOrganIds.filter((id) => space.relatedOrganPatterns.some((pattern) => pattern.test(id)));
}
