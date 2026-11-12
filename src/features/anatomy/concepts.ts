import type { GenderModel } from "@/lib/schemas";

export interface AnatomyConcept {
  id: string;
  name: { fa: string; en: string };
  description: { fa: string; en: string };
  source: string;
  models: Record<GenderModel, string[]>;
}

/** Stable Homman identifiers and explicit mesh mappings; omissions are not matches. */
export const anatomyConcepts: AnatomyConcept[] = [
  { id: "homman:liver", name: { fa: "کبد", en: "Liver" }, description: { fa: "کبد در پردازش مواد مغذی، تولید صفرا و حذف برخی مواد از خون نقش دارد.", en: "The liver processes nutrients, produces bile and removes substances from blood." }, source: "https://medlineplus.gov/liverdiseases.html", models: { male: ["liver"], female: [] } },
  { id: "homman:gallbladder", name: { fa: "کیسهٔ صفرا", en: "Gallbladder" }, description: { fa: "کیسهٔ صفرا مایع صفرا را ذخیره می‌کند و در زمان گوارش آن را به مسیر روده می‌فرستد.", en: "The gallbladder stores bile and releases it into the digestive tract." }, source: "https://www.niddk.nih.gov/health-information/digestive-diseases/gallstones/definition-facts", models: { male: ["gallbladder"], female: ["gallbladder"] } },
  { id: "homman:kidney-left", name: { fa: "کلیهٔ چپ", en: "Left kidney" }, description: { fa: "کلیه‌ها خون را پالایش می‌کنند و مواد زائد و آب اضافی را به ادرار تبدیل می‌کنند.", en: "The kidneys filter blood and remove waste and excess water as urine." }, source: "https://www.niddk.nih.gov/health-information/kidney-disease/kidneys-how-they-work", models: { male: ["kidney_l"], female: [] } },
  { id: "homman:kidney-right", name: { fa: "کلیهٔ راست", en: "Right kidney" }, description: { fa: "کلیه‌ها خون را پالایش می‌کنند و مواد زائد و آب اضافی را به ادرار تبدیل می‌کنند.", en: "The kidneys filter blood and remove waste and excess water as urine." }, source: "https://www.niddk.nih.gov/health-information/kidney-disease/kidneys-how-they-work", models: { male: ["kidney_r"], female: [] } },
  { id: "homman:right-atrium", name: { fa: "دهلیز راست", en: "Right atrium" }, description: { fa: "دهلیز راست خون بازگشته از بدن را دریافت می‌کند و آن را به بطن راست می‌فرستد.", en: "The right atrium receives blood returning from the body and sends it to the right ventricle." }, source: "https://www.nhlbi.nih.gov/health/heart/blood-flow", models: { male: ["right_atrium"], female: [] } },
  { id: "homman:right-ventricle", name: { fa: "بطن راست", en: "Right ventricle" }, description: { fa: "بطن راست خون را به سمت ریه‌ها پمپ می‌کند.", en: "The right ventricle pumps blood toward the lungs." }, source: "https://www.nhlbi.nih.gov/health/heart/blood-flow", models: { male: ["right_ventricle"], female: [] } },
  { id: "homman:pulmonary-trunk", name: { fa: "تنهٔ ریوی", en: "Pulmonary trunk" }, description: { fa: "تنهٔ ریوی بخشی از مسیر انتقال خون از بطن راست به سمت ریه‌ها است.", en: "The pulmonary trunk is part of the route carrying blood from the right ventricle toward the lungs." }, source: "https://www.nhlbi.nih.gov/health/heart/blood-flow", models: { male: ["pulmonary_trunk"], female: [] } },
  { id: "homman:left-atrium", name: { fa: "دهلیز چپ", en: "Left atrium" }, description: { fa: "دهلیز چپ خون بازگشته از ریه‌ها را دریافت می‌کند و به بطن چپ می‌فرستد.", en: "The left atrium receives blood returning from the lungs and sends it to the left ventricle." }, source: "https://www.nhlbi.nih.gov/health/heart/blood-flow", models: { male: ["left_atrium"], female: [] } },
  { id: "homman:left-ventricle", name: { fa: "بطن چپ", en: "Left ventricle" }, description: { fa: "بطن چپ خون را از طریق آئورت به سمت بدن پمپ می‌کند.", en: "The left ventricle pumps blood through the aorta to the body." }, source: "https://www.nhlbi.nih.gov/health/heart/blood-flow", models: { male: ["left_ventricle"], female: [] } },
  { id: "homman:ascending-aorta", name: { fa: "آئورت صعودی", en: "Ascending aorta" }, description: { fa: "آئورت صعودی بخش ابتدایی آئورت است که از بطن چپ خارج می‌شود.", en: "The ascending aorta is the initial part of the aorta leaving the left ventricle." }, source: "https://www.nhlbi.nih.gov/health/heart/blood-flow", models: { male: ["ascending_aorta"], female: [] } },
];

export function conceptForStructure(model: GenderModel, organId: string): AnatomyConcept | undefined {
  return anatomyConcepts.find((concept) => concept.models[model].includes(organId));
}
