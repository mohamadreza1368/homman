import {
  AnatomyManifestSchema,
  type AnatomyManifest,
  type GenderModel,
  type ManifestOrgan,
} from "./schemas";

/** Base path for public anatomical asset meshes. */
const MESH_BASE_PATH = "/anatomy/";

/** URL references for gender-specific anatomical manifests. */
const MANIFEST_URLS: Record<GenderModel, string> = {
  male: "/anatomy/manifest.json",
  female: "/anatomy/manifest_female.json",
};

/**
 * Loads and validates the anatomical manifest for the specified body model.
 */
export async function loadManifest(
  gender: GenderModel,
  signal?: AbortSignal,
): Promise<AnatomyManifest> {
  const targetUrl = MANIFEST_URLS[gender];
  const response = await fetch(targetUrl, signal ? { signal } : {});
  if (!response.ok) {
    throw new Error(`Could not load the anatomy manifest (HTTP ${response.status}).`);
  }

  const raw = await response.json();
  const validation = AnatomyManifestSchema.safeParse(raw);
  if (!validation.success) {
    throw new Error(`The anatomy manifest is malformed: ${validation.error.message}`);
  }

  return validation.data;
}

/** Resolves the public asset URL for a specific mesh file. */
export function meshUrl(file: string): string {
  return `${MESH_BASE_PATH}${file}`;
}

/**
 * Returns a sorted, deduplicated array of mesh file paths required
 * to render the specified anatomical systems.
 */
export function meshFilesForSystems(
  manifest: AnatomyManifest,
  systems: ReadonlySet<string>,
): string[] {
  const collected = new Set<string>();
  for (const organ of manifest.organs) {
    if (systems.has(organ.system)) {
      collected.add(organ.mesh_file);
    }
  }
  return Array.from(collected).sort();
}

/** Filters and returns all organs defined within a specific mesh file. */
export function organsInFile(
  manifest: AnatomyManifest,
  file: string,
): ManifestOrgan[] {
  return manifest.organs.filter((organ) => organ.mesh_file === file);
}
