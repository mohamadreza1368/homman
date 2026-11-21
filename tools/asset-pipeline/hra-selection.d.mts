// Typings for Human Reference Atlas structure selection and metadata tables.

import type { AnatomicalSystem } from "../../src/lib/schemas";

export interface HraSource {
  version: string;
  url: string;
  metadata: string;
  license: string;
  licenseUrl: string;
}

export interface HraStructure {
  node: string;
  id: string;
  term: string;
  english?: string;
  qualifier?: string;
  side: "left" | "right" | null;
  path: string[];
}

export const SOURCE: HraSource;
export const NOT_IN_TA2: Record<string, string>;
export const OUT_OF_SCOPE: Record<string, string>;
export const KNOWN_SOURCE_ERRATA: Record<string, string>;
export const STRUCTURES: HraStructure[];
export const SYSTEM_OF: Map<string, AnatomicalSystem>;
