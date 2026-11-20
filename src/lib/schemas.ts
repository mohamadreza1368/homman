import { z } from "zod";

/**
 * Protocol specification and Zod validation schemas for the HOOMAAN 3D IPC pipeline:
 * React Desktop Interface <-> Tauri Rust Core <-> Python Analysis Sidecar.
 *
 * Wire fields follow snake_case consistently across TypeScript, Rust serde, and Python Pydantic.
 */

export const PROTOCOL_VERSION = 2;

// ---------------------------------------------------------------------------
// Shared Primitives & Enums
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Structural Metadata Schemas
// ---------------------------------------------------------------------------

const textId = z.string().min(1);

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

// ---------------------------------------------------------------------------
// Viewport Command Union
// ---------------------------------------------------------------------------

const commandVariants = [
  z.object({
    action: z.literal("say"),
    text: z.string().refine((val) => [...val].length <= 4000, {
      message: "Text must contain at most 4000 characters.",
    }),
  }),
  z.object({
    action: z.literal("focus_organ"),
    organ_id: textId,
  }),
  z.object({
    action: z.literal("set_layer_visibility"),
    system: AnatomicalSystemSchema,
    visible: z.boolean(),
  }),
  z.object({
    action: z.literal("set_layer_opacity"),
    system: AnatomicalSystemSchema,
    opacity: z.number().min(0).max(1),
  }),
  z.object({
    action: z.literal("isolate_structures"),
    organ_ids: z.array(textId).min(1).max(64),
  }),
  z.object({
    action: z.literal("isolate_region"),
    organ_id: textId,
  }),
  z.object({
    action: z.literal("isolate_group"),
    group: textId,
  }),
  z.object({
    action: z.literal("add_supply"),
    kind: z.enum(["vascular", "neural"]),
  }),
  z.object({
    action: z.literal("apply_pathology_overlay"),
    organ_id: textId,
    pathology: textId,
    severity: z.number().min(0).max(1),
  }),
  z.object({
    action: z.literal("clear_pathology_overlays"),
  }),
  z.object({
    action: z.literal("highlight_pathway"),
    label: textId,
    organ_ids: z.array(textId).min(2).max(32),
    step_seconds: z.number().min(0.2).max(10),
    loop: z.boolean(),
  }),
  z.object({
    action: z.literal("clear_pathway"),
  }),
  z.object({
    action: z.literal("illuminate_structures"),
    organ_ids: z.array(textId).max(64),
  }),
  z.object({
    action: z.literal("set_cross_section"),
    plane: SectionPlaneSchema,
    position: z.number().min(-1).max(1),
  }),
  z.object({
    action: z.literal("scan_at_structure"),
    organ_id: textId,
    plane: ScannerPlaneSchema.nullable().optional(),
  }),
  z.object({
    action: z.literal("set_heart_rhythm"),
    rhythm: HeartRhythmIdSchema,
    sound: z.boolean().nullable().optional(),
  }),
  z.object({
    action: z.literal("reset_view"),
  }),
] as const;

export const SceneCommandSchema = z.discriminatedUnion("action", commandVariants);
export type SceneCommand = z.infer<typeof SceneCommandSchema>;
export type SceneCommandAction = SceneCommand["action"];

// ---------------------------------------------------------------------------
// Clinical Drill & Simulation Entities
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Telemetry & Outgoing Engine Events
// ---------------------------------------------------------------------------

export const TokenUsageSchema = z.object({
  input_tokens: z.number().int().nonnegative(),
  output_tokens: z.number().int().nonnegative(),
  cache_read_tokens: z.number().int().nonnegative().default(0),
});
export type TokenUsage = z.infer<typeof TokenUsageSchema>;

export const EngineErrorCodeSchema = z.enum([
  "missing_api_key",
  "invalid_api_key",
  "provider_error",
  "rate_limited",
  "service_unavailable",
  "guardrail_triggered",
  "invalid_request",
  "internal_error",
]);
export type EngineErrorCode = z.infer<typeof EngineErrorCodeSchema>;

const eventVariants = [
  z.object({
    type: z.literal("ready"),
    protocol_version: z.number().int(),
    engine_version: z.string(),
  }),
  z.object({
    type: z.literal("text_delta"),
    request_id: z.string(),
    text: z.string(),
  }),
  z.object({
    type: z.literal("tool_started"),
    request_id: z.string(),
    tool: z.string(),
  }),
  z.object({
    type: z.literal("scene_command"),
    request_id: z.string(),
    command: SceneCommandSchema,
  }),
  z.object({
    type: z.literal("models"),
    request_id: z.string(),
    provider: AiProviderSchema,
    models: z.array(ModelInfoSchema),
  }),
  z.object({
    type: z.literal("local_models"),
    request_id: z.string(),
    running: z.boolean(),
    models: z.array(LocalModelInfoSchema),
  }),
  z.object({
    type: z.literal("case_verdict"),
    request_id: z.string(),
    score: z.number().int().min(0).max(100),
    verdict: z.string().min(1).max(4000),
  }),
  z.object({
    type: z.literal("done"),
    request_id: z.string(),
    usage: TokenUsageSchema.nullable(),
    model: z.string().nullable().default(null),
  }),
  z.object({
    type: z.literal("error"),
    request_id: z.string().nullable(),
    code: EngineErrorCodeSchema,
    message: z.string(),
  }),
] as const;

export const EngineEventSchema = z.discriminatedUnion("type", eventVariants);
export type EngineEvent = z.infer<typeof EngineEventSchema>;
export type EngineEventType = EngineEvent["type"];

// ---------------------------------------------------------------------------
// Atlas Manifest Structures
// ---------------------------------------------------------------------------

export const ManifestOrganSchema = OrganMetaSchema.extend({
  mesh_file: textId,
  node: textId,
  qualifier: z.string().optional(),
  path: z.array(z.string()),
});

export const AnatomySystemSchema = z.object({
  system: AnatomicalSystemSchema,
  organ_count: z.number().int().nonnegative(),
  load_on_start: z.boolean(),
});
export type AnatomySystem = z.infer<typeof AnatomySystemSchema>;

export const AnatomyManifestSchema = z.object({
  version: z.number().int(),
  gender_model: GenderModelSchema,
  attribution: z.string(),
  credit: z.string().optional(),
  license: z.string(),
  source: z
    .object({
      version: z.string(),
      url: z.string(),
      metadata: z.string().optional(),
      license: z.string(),
      licenseUrl: z.string().optional(),
    })
    .optional(),
  systems: z.array(AnatomySystemSchema).min(1),
  organs: z.array(ManifestOrganSchema),
});
export type AnatomyManifest = z.infer<typeof AnatomyManifestSchema>;
export type ManifestOrgan = z.infer<typeof ManifestOrganSchema>;
