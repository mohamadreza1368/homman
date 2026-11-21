import { z } from "zod";
import {
  AnatomicalSystemSchema,
  HeartRhythmIdSchema,
  ScannerPlaneSchema,
  SectionPlaneSchema,
  textId,
} from "./primitives";

export const commandVariants = [
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
