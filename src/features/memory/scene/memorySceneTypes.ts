import * as THREE from "three";
import type { MemoryKind } from "../memories";
import type { BrainStructure } from "./brainLoader";
import type { Adapter } from "./quality";

export type LabPhase = "boot" | "deploy" | "materialize" | "mapping" | "live";

export interface GraphicsStatus {
  adapter: Adapter;
  level: number;
  eased: boolean;
  lost: boolean;
}

export interface SceneMemory {
  key: string;
  kind: MemoryKind;
}

export interface MemorySceneOptions {
  meshUrl: string;
  structures: readonly BrainStructure[];
  dracoPath: string;
  memories: readonly SceneMemory[];
  reducedMotion?: boolean;
  onHover?: (key: string | null) => void;
  onSelect?: (key: string | null) => void;
  onPhase?: (phase: LabPhase, mapped: number) => void;
  onError?: (error: unknown) => void;
  onGraphics?: (status: GraphicsStatus) => void;
}

export interface FocusMargins {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface SceneLayer {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  rect(): { left: number; top: number; width: number; height: number } | null;
  update(now: number, aspect: number, pixelRatio: number, particles: number): void;
}

export interface MemoryScene {
  select(key: string | null): void;
  erase(key: string): void;
  restore(key: string): void;
  screenPosition(key: string): { x: number; y: number } | null;
  skipIntro(): void;
  setFocus(margins: FocusMargins): void;
  addLayer(layer: SceneLayer): () => void;
  setFilm(on: boolean): void;
  dispose(): void;
}

export const STAGES = { boot: 1.1, deploy: 2.4, materialize: 1.4 } as const;
export const DURATION_PER_MEMORY_SEC = 0.22;
export const MIN_MAPPING_SEC = 3.0;
export const MAX_MAPPING_SEC = 12.0;
export const PICK_HIT_PROXIMITY_PX = 18;
export const ERASE_TRANSITION_SEC = 1.6;
export const BURST_PARTICLE_COUNT = 240;
export const TARGET_FRAME_RADIUS = 1.4;
export const THREAD_SUBDIVISIONS = 14;

export const PALETTE: Record<MemoryKind, THREE.Color> = {
  session: new THREE.Color("#56e1ff"),
  case: new THREE.Color("#ffb347"),
  note: new THREE.Color("#c29bff"),
};

export const easeCubic = (v: number): number => {
  const c = Math.min(1, Math.max(0, v));
  return c * c * (3 - 2 * c);
};
