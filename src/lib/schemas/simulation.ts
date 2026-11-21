import { z } from "zod";
import {
  AiProviderSchema,
  GenderModelSchema,
  LanguageSchema,
  OrganContextSchema,
  OrganMetaSchema,
  SessionModeSchema,
  UserProfileSchema,
  textId,
} from "./primitives";

export const ChatTurnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(8000),
});
export type ChatTurn = z.infer<typeof ChatTurnSchema>;

export const CaseComplaintSchema = z.object({
  organ_id: textId,
  label: textId,
  symptom: textId,
  severity: z.number().int().min(1).max(10).nullable().optional(),
});
export type CaseComplaint = z.infer<typeof CaseComplaintSchema>;

export const CaseRecordUpdateSchema = z.object({
  visit_no: z.number().int().min(1),
  body: z.string().min(1).max(2000),
});
export type CaseRecordUpdate = z.infer<typeof CaseRecordUpdateSchema>;

export const CaseVisitSummarySchema = z.object({
  visit_no: z.number().int().min(1),
  score: z.number().int().min(0).max(100).nullable().optional(),
  verdict: z.string().min(1).max(2000).nullable().optional(),
});
export type CaseVisitSummary = z.infer<typeof CaseVisitSummarySchema>;

export const VirtualPatientSchema = z.object({
  title: textId,
  sex: GenderModelSchema,
  age_years: z.number().int().min(0).max(120).nullable().optional(),
  height_cm: z.number().int().min(30).max(250).nullable().optional(),
  weight_kg: z.number().int().min(1).max(300).nullable().optional(),
  findings: z.string().max(2000).default(""),
  ground_truth: z.string().max(2000).default(""),
  visit_no: z.number().int().min(1),
  complaints: z.array(CaseComplaintSchema).max(16).default([]),
  record_updates: z.array(CaseRecordUpdateSchema).max(32).default([]),
  earlier_visits: z.array(CaseVisitSummarySchema).max(32).default([]),
});
export type VirtualPatient = z.infer<typeof VirtualPatientSchema>;

export const ScannerContextSchema = z.object({
  level: textId.nullable().default(null),
  crossing: z.array(OrganContextSchema).max(16).default([]),
  total: z.number().int().nonnegative().default(0),
});
export type ScannerContext = z.infer<typeof ScannerContextSchema>;

export const HeartContextSchema = z.object({
  rhythm: z.string().min(1).max(60),
  rate: z.string().min(1).max(40),
  pattern: z.string().min(1).max(400),
  sound: z.boolean().default(false),
});
export type HeartContext = z.infer<typeof HeartContextSchema>;

export const BreathContextSchema = z.object({
  pattern: z.string().min(1).max(60),
  rate: z.string().min(1).max(40),
  what: z.string().min(1).max(400),
  heart: z.string().min(1).max(400).nullable().optional(),
});
export type BreathContext = z.infer<typeof BreathContextSchema>;

export const AgentRequestSchema = z.object({
  request_id: textId,
  query: z.string().min(1).max(8000),
  history: z.array(ChatTurnSchema).max(100),
  provider: AiProviderSchema,
  model: textId.optional(),
  profile: UserProfileSchema,
  language: LanguageSchema,
  gender_model: GenderModelSchema,
  mode: SessionModeSchema,
  selection: z.array(OrganContextSchema).max(64),
  available_organs: z.array(OrganMetaSchema),
  available_groups: z.array(textId).max(400).optional(),
  case: VirtualPatientSchema.optional(),
  scanner: ScannerContextSchema.optional(),
  heart: HeartContextSchema.optional(),
  breathing: BreathContextSchema.optional(),
});
export type AgentRequest = z.infer<typeof AgentRequestSchema>;

export const ListModelsRequestSchema = z.object({
  request_id: textId,
  provider: AiProviderSchema,
});
export type ListModelsRequest = z.infer<typeof ListModelsRequestSchema>;

export const LocalModelNameSchema = z
  .string()
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:/@-]{0,199}$/)
  .refine((val) => !val.includes("://") && !val.includes(".."), "not an Ollama model name");

export const LocalChatRequestSchema = z.object({
  request_id: textId,
  query: z.string().min(1).max(8000),
  history: z.array(ChatTurnSchema).max(100).default([]),
  model: LocalModelNameSchema,
  profile: UserProfileSchema,
  gender_model: GenderModelSchema.default("male"),
  selection: z.array(OrganContextSchema).max(64).default([]),
});
export type LocalChatRequest = z.input<typeof LocalChatRequestSchema>;

export const LocalModelsRequestSchema = z.object({
  request_id: textId,
});
export type LocalModelsRequest = z.infer<typeof LocalModelsRequestSchema>;

export const LocalModelInfoSchema = z.object({
  name: LocalModelNameSchema,
  parameter_size: z.string().nullable().optional(),
  size_bytes: z.number().int().nonnegative().nullable().optional(),
});
export type LocalModelInfo = z.infer<typeof LocalModelInfoSchema>;

export const ModelInfoSchema = z.object({
  id: textId,
  label: textId,
  description: z.string().nullable().optional(),
  recommended: z.boolean(),
});
export type ModelInfo = z.infer<typeof ModelInfoSchema>;
