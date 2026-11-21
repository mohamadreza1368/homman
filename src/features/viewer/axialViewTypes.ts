export type WindowPreset = "natural" | "soft" | "bone" | "lung" | "invert";

export const WINDOW_FILTERS: Record<WindowPreset, string> = {
  natural: "none",
  soft: "grayscale(1) contrast(140%) brightness(95%)",
  bone: "grayscale(1) contrast(220%) brightness(130%)",
  lung: "grayscale(1) contrast(120%) brightness(150%)",
  invert: "invert(1) grayscale(1) contrast(130%)",
};

export interface WindowPresetOption {
  id: WindowPreset;
  labelEn: string;
  labelFa: string;
}

export const WINDOW_PRESET_OPTIONS: readonly WindowPresetOption[] = [
  { id: "natural", labelEn: "Natural", labelFa: "طبیعی" },
  { id: "soft", labelEn: "Soft Tissue", labelFa: "بافت نرم" },
  { id: "bone", labelEn: "Bone", labelFa: "استخوان" },
  { id: "lung", labelEn: "Lung", labelFa: "ریه" },
  { id: "invert", labelEn: "Invert X-ray", labelFa: "نگاتیو" },
] as const;
