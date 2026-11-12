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
];

export function conceptForStructure(model: GenderModel, organId: string): AnatomyConcept | undefined {
  return anatomyConcepts.find((concept) => concept.models[model].includes(organId));
}
