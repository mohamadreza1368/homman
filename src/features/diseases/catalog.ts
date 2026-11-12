/** Curated links are explicit: similar names or partial meshes are not equivalence. */
export interface Disease {
  id: string;
  name: { fa: string; en: string };
  summary: { fa: string; en: string };
  effect: { fa: string; en: string };
  aliases: string[];
  source: string;
  sites: { fa: string; en: string; male: string[]; female: string[] }[];
}

export const diseases: Disease[] = [
  {
    id: "cirrhosis", name: { fa: "سیروز کبدی", en: "Cirrhosis" },
    summary: { fa: "در سیروز، بافت آسیب‌دیدهٔ کبد به‌تدریج با بافت اسکار جایگزین می‌شود.", en: "In cirrhosis, scar tissue replaces damaged liver tissue." },
    effect: { fa: "بافت اسکار می‌تواند عملکرد طبیعی کبد را مختل کند.", en: "Scar tissue can impair normal liver function." },
    aliases: ["سیروز", "کبد", "liver", "hepatic"], source: "https://medlineplus.gov/cirrhosis.html",
    sites: [{ fa: "کبد", en: "Liver", male: ["liver"], female: [] }],
  },
  {
    id: "kidney-stones", name: { fa: "سنگ کلیه", en: "Kidney stones" },
    summary: { fa: "سنگ کلیه رسوب سختی است که می‌تواند در یک یا هر دو کلیه تشکیل شود.", en: "Kidney stones are hard deposits that can form in one or both kidneys." },
    effect: { fa: "سنگ ممکن است در مسیر ادرار حرکت کند و گاهی جریان ادرار را مسدود کند.", en: "A stone can travel through the urinary tract and may block urine flow." },
    aliases: ["کلیه", "سنگ", "renal", "nephrolithiasis"], source: "https://medlineplus.gov/genetics/condition/kidney-stones/",
    sites: [
      { fa: "کلیهٔ چپ", en: "Left kidney", male: ["kidney_l"], female: [] },
      { fa: "کلیهٔ راست", en: "Right kidney", male: ["kidney_r"], female: [] },
    ],
  },
  {
    id: "hepatitis", name: { fa: "هپاتیت", en: "Hepatitis" },
    summary: { fa: "هپاتیت به التهاب کبد گفته می‌شود و می‌تواند علت‌های متفاوتی داشته باشد.", en: "Hepatitis is inflammation of the liver and can have different causes." },
    effect: { fa: "التهاب می‌تواند به سلول‌های کبد آسیب بزند و عملکرد آن را مختل کند.", en: "Inflammation can damage liver cells and affect liver function." },
    aliases: ["کبد", "التهاب کبد", "liver"], source: "https://medlineplus.gov/hepatitis.html",
    sites: [{ fa: "کبد", en: "Liver", male: ["liver"], female: [] }],
  },
  {
    id: "gallstones", name: { fa: "سنگ کیسهٔ صفرا", en: "Gallstones" },
    summary: { fa: "سنگ‌های صفرا رسوبات جامدی هستند که می‌توانند در کیسهٔ صفرا تشکیل شوند.", en: "Gallstones are solid deposits that can form in the gallbladder." },
    effect: { fa: "سنگ ممکن است مجاری صفراوی را مسدود کند و باعث التهاب یا درد شود.", en: "A stone can block bile ducts and cause pain or inflammation." },
    aliases: ["صفرا", "سنگ صفرا", "gallbladder", "cholelithiasis"], source: "https://medlineplus.gov/gallstones.html",
    sites: [{ fa: "کیسهٔ صفرا", en: "Gallbladder", male: ["gallbladder"], female: ["gallbladder"] }],
  },
  {
    id: "pancreatitis", name: { fa: "التهاب لوزالمعده", en: "Pancreatitis" },
    summary: { fa: "پانکراتیت التهاب لوزالمعده است و می‌تواند حاد یا مزمن باشد.", en: "Pancreatitis is inflammation of the pancreas and can be acute or chronic." },
    effect: { fa: "التهاب می‌تواند به بافت لوزالمعده آسیب بزند و بر عملکرد آن تأثیر بگذارد.", en: "Inflammation can damage pancreatic tissue and affect its function." },
    aliases: ["پانکراتیت", "پانکراس", "لوزالمعده", "pancreas"], source: "https://medlineplus.gov/pancreatitis.html",
    sites: [{ fa: "لوزالمعده", en: "Pancreas", male: ["pancreas"], female: [] }],
  },
  {
    id: "gastritis", name: { fa: "التهاب معده", en: "Gastritis" },
    summary: { fa: "گاستریت التهاب پوشش داخلی معده است.", en: "Gastritis is inflammation of the stomach lining." },
    effect: { fa: "پوشش داخلی معده ملتهب می‌شود و ممکن است آسیب ببیند.", en: "The stomach lining becomes inflamed and may be damaged." },
    aliases: ["گاستریت", "معده", "stomach"], source: "https://medlineplus.gov/gastritis.html",
    sites: [{ fa: "معده", en: "Stomach", male: ["stomach"], female: [] }],
  },
  {
    id: "gastric-ulcer", name: { fa: "زخم معده", en: "Gastric ulcer" },
    summary: { fa: "زخم معده یک زخم باز در پوشش داخلی معده است.", en: "A gastric ulcer is an open sore in the stomach lining." },
    effect: { fa: "زخم بخشی از پوشش معده را درگیر می‌کند؛ محل دقیق در افراد متفاوت است.", en: "The sore affects part of the stomach lining; its exact location varies." },
    aliases: ["زخم", "معده", "stomach ulcer", "peptic ulcer"], source: "https://medlineplus.gov/ency/article/000206.htm",
    sites: [{ fa: "معده", en: "Stomach", male: ["stomach"], female: [] }],
  },
  {
    id: "asthma", name: { fa: "آسم", en: "Asthma" },
    summary: { fa: "آسم بیماری مزمنی است که راه‌های هوایی ریه را درگیر می‌کند.", en: "Asthma is a chronic disease affecting the airways of the lungs." },
    effect: { fa: "راه‌های هوایی می‌توانند ملتهب و باریک شوند و عبور هوا دشوار شود.", en: "Airways can become inflamed and narrow, making breathing harder." },
    aliases: ["ریه", "نایژه", "راه هوایی", "bronchus", "airway"], source: "https://medlineplus.gov/asthma.html",
    sites: [
      { fa: "نایژهٔ اصلی چپ", en: "Left main bronchus", male: ["left_main_bronchus"], female: [] },
      { fa: "نایژهٔ اصلی راست", en: "Right main bronchus", male: ["right_main_bronchus"], female: [] },
    ],
  },
];

export function searchDiseases(query: string): Disease[] {
  const needle = query.trim().toLocaleLowerCase().replace(/[يى]/g, "ی").replace(/ك/g, "ک");
  if (!needle) return diseases;
  return diseases.filter((d) => [d.name.fa, d.name.en, ...d.aliases, ...d.sites.flatMap((s) => [s.fa, s.en])]
    .some((text) => text.toLocaleLowerCase().replace(/[يى]/g, "ی").replace(/ك/g, "ک").includes(needle)));
}

export function diseasesForStructure(id: string, model: "male" | "female"): Disease[] {
  return diseases.filter((d) => d.sites.some((site) => site[model].includes(id)));
}
