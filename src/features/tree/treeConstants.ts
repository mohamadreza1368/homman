import type { SectionPlane } from "@/lib/schemas";

export const PERSIAN_SYSTEM_NAMES: Record<string, string> = {
  articular: "مفاصل",
  cardiovascular: "قلب و عروق",
  digestive: "گوارش",
  endocrine: "غدد",
  lymphatic: "لنفاوی",
  muscular: "عضلات",
  nervous: "عصبی",
  regional: "سطح بدن",
  renal: "ادراری",
  reproductive: "تولیدمثل",
  respiratory: "تنفسی",
  skeletal: "اسکلت",
  integumentary: "پوست",
  visceral: "احشا",
};

export const SECTION_PLANES_LIST: SectionPlane[] = ["axial", "coronal", "sagittal"];

/**
 * Checks whether an anatomical system folder is currently expanded in the tree view.
 */
export function systemIsOpen(
  expandedMap: Record<string, boolean>,
  systemName: string,
): boolean {
  return expandedMap[systemName] === true;
}
