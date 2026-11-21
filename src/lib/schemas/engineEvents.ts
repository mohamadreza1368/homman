import { z } from "zod";
import { AiProviderSchema } from "./primitives";
import { SceneCommandSchema } from "./sceneCommands";
import { LocalModelInfoSchema, ModelInfoSchema } from "./simulation";

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

export const eventVariants = [
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
