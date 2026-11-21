import type { AnatomicalSystem } from "@/lib/schemas";

export interface ClinicalDrillPromptItem {
  label: string;
  labelFa: string;
  system: AnatomicalSystem;
  prompt: string;
  promptFa: string;
}

/** Quick-start prompts for clinical case training, filtered by available anatomical systems. */
export const CLINICAL_DRILL_PROMPTS: ClinicalDrillPromptItem[] = [
  {
    label: "Cardiac emergency",
    labelFa: "اورژانس قلبی",
    system: "cardiovascular",
    prompt: "Start a case drill: an acute cardiovascular emergency.",
    promptFa: "یک تمرین بالینی شروع کن: اورژانس حاد قلبی-عروقی.",
  },
  {
    label: "Respiratory",
    labelFa: "تنفسی",
    system: "respiratory",
    prompt: "Start a case drill: a patient in respiratory distress.",
    promptFa: "یک تمرین بالینی شروع کن: بیمار با دیسترس تنفسی.",
  },
  {
    label: "Neurological",
    labelFa: "عصبی",
    system: "nervous",
    prompt: "Start a case drill: an acute neurological deficit.",
    promptFa: "یک تمرین بالینی شروع کن: نقص عصبی حاد.",
  },
  {
    label: "Abdominal",
    labelFa: "شکمی",
    system: "digestive",
    prompt: "Start a case drill: acute abdominal pain.",
    promptFa: "یک تمرین بالینی شروع کن: درد حاد شکم.",
  },
];
