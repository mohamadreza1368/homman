import { z } from "zod";

export const PROTOCOL_VERSION = 2;

export const LanguageSchema = z.enum(["auto", "fa", "en", "bg", "es"]);
export type Language = z.infer<typeof LanguageSchema>;

export const UserProfileSchema = z.enum(["layperson", "student", "clinician"]);
export type UserProfile = z.infer<typeof UserProfileSchema>;

export const GenderModelSchema = z.enum(["male", "female"]);
export type GenderModel = z.infer<typeof GenderModelSchema>;

export const AiProviderSchema = z.enum(["anthropic", "openai", "google"]);
export type AiProvider = z.infer<typeof AiProviderSchema>;

export const SessionModeSchema = z.enum(["tutor", "case", "review"]);
export type SessionMode = z.infer<typeof SessionModeSchema>;

export type FiledMode = Exclude<SessionMode, "review">;

export const AnatomicalSystemSchema = z.enum([
  "cardiovascular",
  "respiratory",
  "renal",
  "digestive",
  "nervous",
  "endocrine",
  "lymphatic",
  "skeletal",
  "muscular",
  "articular",
  "reproductive",
  "integumentary",
  "regional",
]);
export type AnatomicalSystem = z.infer<typeof AnatomicalSystemSchema>;

export const SectionPlaneSchema = z.enum(["axial", "coronal", "sagittal"]);
export type SectionPlane = z.infer<typeof SectionPlaneSchema>;

export const HeartRhythmIdSchema = z.enum([
  "normal",
  "sinus_tachycardia",
  "sinus_bradycardia",
  "av_block_1",
  "mobitz_1",
  "mobitz_2",
  "av_block_3",
  "atrial_fibrillation",
  "atrial_flutter",
  "premature_ventricular",
  "ventricular_tachycardia",
  "ventricular_fibrillation",
  "asystole",
  "aortic_stenosis",
  "mitral_regurgitation",
  "aortic_regurgitation",
  "mitral_stenosis",
  "third_heart_sound",
  "fourth_heart_sound",
]);
export type HeartRhythmId = z.infer<typeof HeartRhythmIdSchema>;

export const ScannerPlaneSchema = z.enum(["axial", "coronal"]);
export type ScannerPlane = z.infer<typeof ScannerPlaneSchema>;

export const textId = z.string().min(1);

export const OrganMetaSchema = z.object({
  organ_id: textId,
  ta2_latin: textId,
  name_en: textId,
  system: AnatomicalSystemSchema,
});
export type OrganMeta = z.infer<typeof OrganMetaSchema>;

export const OrganContextSchema = z.object({
  organ_id: textId,
  ta2_latin: textId,
  name_en: textId,
  system: AnatomicalSystemSchema,
});
export type OrganContext = z.infer<typeof OrganContextSchema>;
