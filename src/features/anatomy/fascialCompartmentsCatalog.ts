/**
 * Fascial Compartments & Fasciotomy Atlas (Moore & Gray's)
 */

export interface FascialCompartment {
  id: string;
  regionFa: string;
  regionEn: string;
  nameFa: string;
  nameEn: string;
  nerveAtRiskFa: string;
  nerveAtRiskEn: string;
  arteryFa: string;
  arteryEn: string;
  fasciotomyPearlFa: string;
  fasciotomyPearlEn: string;
  organPatterns: RegExp[];
}

export const FASCIAL_COMPARTMENTS_CATALOG: FascialCompartment[] = [
  {
    id: "leg_anterior_compartment",
    regionFa: "ساق پا",
    regionEn: "Lower Leg",
    nameFa: "کمپارتمان قدامی ساق پا (شایع‌ترین محل سندرم کمپارتمان)",
    nameEn: "Anterior Compartment of Leg (Most Common Compartment Syndrome)",
    nerveAtRiskFa: "عصب پرونئال عمقی (Deep Fibular Nerve) — بی‌حسی بین انگشت ۱ و ۲ پا + افتادگی پا",
    nerveAtRiskEn: "Deep fibular (peroneal) nerve — 1st webspace numbness + foot drop",
    arteryFa: "شریان تیبیال قدامی (ادامه به شریان دورسالیس پدیس)",
    arteryEn: "Anterior tibial artery (continues as dorsalis pedis)",
    fasciotomyPearlFa: "فاسیوتومی دوبرشی (Two-incision four-compartment): برش قدامی-خارجی برای باز کردن همزمان کمپارتمان قدامی و لترال.",
    fasciotomyPearlEn: "Decompressed via anterolateral incision in two-incision four-compartment fasciotomy.",
    organPatterns: [/tibialis_anterior/i, /extensor_hallucis_longus/i, /extensor_digitorum_longus/i, /anterior_tibial_artery/i],
  },
  {
    id: "leg_lateral_compartment",
    regionFa: "ساق پا",
    regionEn: "Lower Leg",
    nameFa: "کمپارتمان جانبی (لترال) ساق پا",
    nameEn: "Lateral Compartment of Leg",
    nerveAtRiskFa: "عصب پرونئال سطحی (Superficial Fibular Nerve) — بی‌حسی پشت پا و ضعف ایورژن",
    nerveAtRiskEn: "Superficial fibular nerve — dorsum of foot sensory loss + weak eversion",
    arteryFa: "شاخه‌های پرفوراتور شریان فیبولار (پرونئال)",
    arteryEn: "Perforating branches of fibular (peroneal) artery",
    fasciotomyPearlFa: "هنگام برش فاشیای سپتوم بین‌عضلانی قدامی، مراقب خروج عصب پرونئال سطحی در یک‌سوم دیستال باشید.",
    fasciotomyPearlEn: "Protect superficial fibular nerve piercing crural fascia in distal third during decompression.",
    organPatterns: [/fibularis_longus|peroneus_longus/i, /fibularis_brevis|peroneus_brevis/i],
  },
  {
    id: "leg_posterior_compartment",
    regionFa: "ساق پا",
    regionEn: "Lower Leg",
    nameFa: "کمپارتمان خلفی سطحی و عمقی ساق پا",
    nameEn: "Superficial & Deep Posterior Compartments of Leg",
    nerveAtRiskFa: "عصب تیبیال (Tibial Nerve) — بی‌حسی کف پا و ضعف پلانتارفلکشن",
    nerveAtRiskEn: "Tibial nerve — plantar sensory loss + weak plantarflexion",
    arteryFa: "شریان تیبیال خلفی و شریان فیبولار",
    arteryEn: "Posterior tibial and fibular arteries",
    fasciotomyPearlFa: "آزادسازی از طریق برش پوسترمدیکال (۲ سانتی‌متر خلف لبهٔ داخلی تیبیا) با حفظ ورید صافن بزرگ.",
    fasciotomyPearlEn: "Decompressed via posteromedial incision 2 cm posterior to tibial border, sparing great saphenous vein.",
    organPatterns: [/gastrocnemius/i, /soleus/i, /tibialis_posterior/i, /posterior_tibial_artery/i],
  },
  {
    id: "forearm_volar_compartment",
    regionFa: "ساعد",
    regionEn: "Forearm",
    nameFa: "کمپارتمان قدامی (ولار / فلکسور) ساعد",
    nameEn: "Anterior (Volar / Flexor) Compartment of Forearm",
    nerveAtRiskFa: "اعصاب مدین و اولنار — خطر کنتراکچر ایسکمیک فولکمان (Volkmann's Contracture)",
    nerveAtRiskEn: "Median & Ulnar nerves — high risk of Volkmann's ischemic contracture",
    arteryFa: "شریان‌های رادیال، اولنار و بین‌استخوانی قدامی",
    arteryEn: "Radial, ulnar, and anterior interosseous arteries",
    fasciotomyPearlFa: "در شکستگی سوپراکندیلار کودکان؛ درد شدید حین اکستنشن غیرفعال انگشتان نشانهٔ اورژانسی است.",
    fasciotomyPearlEn: "Pain on passive finger extension after supracondylar fracture mandates urgent volar Henry fasciotomy.",
    organPatterns: [/flexor_digitorum/i, /pronator_teres/i, /flexor_carpi/i, /median_nerve/i],
  },
];
