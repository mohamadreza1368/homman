import { z } from "zod";
import {
  AnatomicalSystemSchema,
  GenderModelSchema,
  OrganMetaSchema,
  textId,
} from "./primitives";

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
