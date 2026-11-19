import { create } from "zustand";

import type {
  AnatomicalSystem,
  AnatomyManifest,
  GenderModel,
  ManifestOrgan,
  SceneCommand,
  SectionPlane,
} from "@/lib/schemas";
import type { BackgroundMode } from "@/features/viewer/background";
import type { LightingPresetId } from "@/features/viewer/lighting";
import type { AnatomicalView } from "@/features/viewer/cameraViews";
import { sameStack } from "@/features/viewer/depthStack";
import { tissueFamily } from "@/features/viewer/palette";
import { MAX_EXPLODE, nextExplodeStop } from "@/features/viewer/explode";
import { nextBodyTone, type BodyTone } from "@/features/viewer/scan";
import { SUPPLY_SYSTEM, type SupplyKind } from "@/features/viewer/supply";
import { startHeartRhythm } from "./heartStore";
import type { ViewPreferences } from "./viewPreferences";

/**
 * Core 3D anatomical scene and viewport state management for HOOMAAN.
 *
 * Serves as the single source of truth for R3F rendering, anatomical layer visibility,
 * structure selection, pathology overlays, dissection levels, and camera operations.
 */
export interface PathologyOverlay {
  pathology: string;
  severity: number;
}

export interface CrossSection {
  plane: SectionPlane;
  position: number;
}

export const GHOST_STOPS = [1, 0.28, 0.12] as const;
export const XRAY_OPACITY = 0.16;
export const GLASS_OPACITY = 0.1;
export const GHOST_CLICK_THROUGH = 0.5;

export interface FocusRequest {
  organId: string;
  seq: number;
}

export interface ScanRequest {
  organId: string;
  seq: number;
  plane?: "axial" | "coronal";
}

export type ViewpointRequest =
  | { kind: "fit"; seq: number }
  | { kind: "orient"; view: AnatomicalView; seq: number }
  | { kind: "dolly"; factor: number; seq: number }
  | { kind: "scan"; seq: number };

export interface PathwayRequest {
  label: string;
  organIds: string[];
  stepSeconds: number;
  loop: boolean;
  seq: number;
}

function revealing(state: SceneViewState, organIds: string[]): Partial<SceneViewState> {
  const diff: Partial<SceneViewState> = {};

  const remainingHidden = state.hiddenOrganIds.filter((id) => !organIds.includes(id));
  if (remainingHidden.length !== state.hiddenOrganIds.length) {
    diff.hiddenOrganIds = remainingHidden;
  }

  if (state.isolatedOrganIds !== null) {
    const active = new Set(state.isolatedOrganIds);
    const initialSize = active.size;
    for (const organId of organIds) {
      active.add(organId);
    }
    if (active.size !== initialSize) {
      diff.isolatedOrganIds = [...active];
    }
  }

  return diff;
}

export interface SceneViewState {
  selectedOrganIds: string[];
  hiddenOrganIds: string[];
  hiddenSystems: AnatomicalSystem[];
  systemOpacity: Partial<Record<AnatomicalSystem, number>>;
  isolatedOrganIds: string[] | null;
  pathologyOverlays: Record<string, PathologyOverlay>;
  caseMarks: Record<string, PathologyOverlay>;
  crossSection: CrossSection | null;
  focusRequest: FocusRequest | null;
  scanRequest: ScanRequest | null;
  viewpoint: ViewpointRequest | null;
  pathway: PathwayRequest | null;
  illuminated: string[];
  supplyRequest: { kind: SupplyKind; seq: number } | null;
  supplyResult: { kind: SupplyKind; added: number } | null;
  explode: number;
  bodyTone: BodyTone;
}

export const initialViewState: SceneViewState = {
  selectedOrganIds: [],
  hiddenOrganIds: [],
  hiddenSystems: [],
  systemOpacity: {},
  isolatedOrganIds: null,
  pathologyOverlays: {},
  caseMarks: {},
  crossSection: null,
  focusRequest: null,
  scanRequest: null,
  viewpoint: null,
  pathway: null,
  explode: 0,
  bodyTone: "solid",
  supplyRequest: null,
  supplyResult: null,
  illuminated: [],
};

/**
 * Pure reducer applying an incoming scene command to viewport state.
 */
export function applySceneCommand(
  state: SceneViewState,
  command: SceneCommand,
): SceneViewState {
  switch (command.action) {
    case "say":
      return state;

    case "focus_organ":
      return {
        ...state,
        ...revealing(state, [command.organ_id]),
        selectedOrganIds: [command.organ_id],
        focusRequest: {
          organId: command.organ_id,
          seq: (state.focusRequest?.seq ?? 0) + 1,
        },
      };

    case "set_layer_visibility": {
      const activeHidden = new Set(state.hiddenSystems);
      if (command.visible) {
        activeHidden.delete(command.system);
      } else {
        activeHidden.add(command.system);
      }
      return { ...state, hiddenSystems: [...activeHidden].sort() };
    }

    case "set_layer_opacity": {
      const opacityMap = { ...state.systemOpacity };
      if (command.opacity >= 1) {
        delete opacityMap[command.system];
      } else {
        opacityMap[command.system] = command.opacity;
      }
      return { ...state, systemOpacity: opacityMap };
    }

    case "isolate_structures":
      return { ...state, isolatedOrganIds: [...command.organ_ids] };

    case "isolate_group":
    case "add_supply":
      return state;

    case "isolate_region":
      return {
        ...state,
        isolatedOrganIds: [command.organ_id],
        selectedOrganIds: [command.organ_id],
        focusRequest: {
          organId: command.organ_id,
          seq: (state.focusRequest?.seq ?? 0) + 1,
        },
      };

    case "apply_pathology_overlay":
      return {
        ...state,
        pathologyOverlays: {
          ...state.pathologyOverlays,
          [command.organ_id]: {
            pathology: command.pathology,
            severity: command.severity,
          },
        },
      };

    case "clear_pathology_overlays":
      return { ...state, pathologyOverlays: {} };

    case "highlight_pathway":
      return {
        ...state,
        pathway: {
          label: command.label,
          organIds: [...command.organ_ids],
          stepSeconds: command.step_seconds,
          loop: command.loop,
          seq: (state.pathway?.seq ?? 0) + 1,
        },
      };

    case "clear_pathway":
      return { ...state, pathway: null };

    case "illuminate_structures": {
      const targets = [...command.organ_ids];
      return { ...state, ...revealing(state, targets), illuminated: targets };
    }

    case "set_cross_section":
      return {
        ...state,
        crossSection: { plane: command.plane, position: command.position },
      };

    case "set_heart_rhythm":
      return state;

    case "scan_at_structure":
      return {
        ...state,
        ...revealing(state, [command.organ_id]),
        scanRequest: {
          organId: command.organ_id,
          seq: (state.scanRequest?.seq ?? 0) + 1,
          ...(command.plane ? { plane: command.plane } : {}),
        },
      };

    case "reset_view":
      return {
        ...initialViewState,
        selectedOrganIds: state.selectedOrganIds,
        systemOpacity: state.systemOpacity,
        bodyTone: state.bodyTone,
      };
  }
}

interface SceneStore extends SceneViewState {
  genderModel: GenderModel;
  manifest: AnatomyManifest | null;
  organs: Record<string, ManifestOrgan>;
  hoveredOrganId: string | null;
  eyeTracking: boolean;
  labelsVisible: boolean;
  hideConnective: boolean;
  connectiveIds: Set<string>;
  background: BackgroundMode;
  lightingPreset: LightingPresetId;
  depthProbeVisible: boolean;
  depthStack: string[];
  pinnedStack: string[] | null;
  focusBadge: { organId: string; index: number } | null;

  setManifest: (manifest: AnatomyManifest) => void;
  setGenderModel: (gender: GenderModel) => void;
  setHovered: (organId: string | null) => void;
  setDepthStack: (organIds: string[]) => void;
  clearDepthStack: () => void;
  pinDepthStack: () => void;
  unpinDepthStack: () => void;
  selectFromViewport: (organId: string | null, additive?: boolean) => void;
  dismissDepthStack: () => void;
  setEyeTracking: (enabled: boolean) => void;
  setDepthProbeVisible: (visible: boolean) => void;
  setLabelsVisible: (visible: boolean) => void;
  setHideConnective: (hidden: boolean) => void;
  cycleBodyTone: () => void;
  setBackground: (mode: BackgroundMode) => void;
  setLightingPreset: (preset: LightingPresetId) => void;
  restoreView: (preferences: Partial<ViewPreferences>) => void;
  selectOrgan: (organId: string | null, additive?: boolean) => void;
  selectMany: (organIds: string[]) => void;
  addToSelection: (organIds: string[]) => void;
  clearSelection: () => void;
  setCaseMarks: (marks: Record<string, PathologyOverlay>) => void;
  isolateSelection: () => void;
  hideSelection: () => void;
  unhideAll: () => void;
  applyCommand: (command: SceneCommand) => void;
  focusReference: (organId: string, index: number) => void;
  toggleSystem: (system: AnatomicalSystem) => void;
  soloSystem: (system: AnatomicalSystem) => void;
  cycleSystemOpacity: (system: AnatomicalSystem) => void;
  xraySystem: (system: AnatomicalSystem) => void;
  clearGhosting: () => void;
  glassBody: () => void;
  fitView: () => void;
  orientView: (view: AnatomicalView) => void;
  scanView: () => void;
  dollyView: (factor: number) => void;
  setExplode: (factor: number) => void;
  cycleExplode: () => void;
  showAllSystems: () => void;
  clearPathway: () => void;
  clearIsolation: () => void;
  dropFromIsolation: (organId: string) => void;
  requestSupply: (kind: SupplyKind) => void;
  resolveSupply: (organIds: string[]) => void;
  cancelSupply: () => void;
  studyOrgan: (organId: string, additive?: boolean) => void;
  studyRegion: (organId: string) => void;
  studyGroup: (node: string) => void;
  resetView: () => void;
}

export const useSceneStore = create<SceneStore>()((set, get) => ({
  ...initialViewState,
  genderModel: "male",
  manifest: null,
  organs: {},
  hoveredOrganId: null,
  depthStack: [],
  pinnedStack: null,
  eyeTracking: true,
  depthProbeVisible: true,
  labelsVisible: false,
  hideConnective: false,
  connectiveIds: new Set<string>(),
  focusBadge: null,
  background: "dark",
  lightingPreset: "studio",

  setManifest: (manifest) =>
    set({
      manifest,
      organs: Object.fromEntries(manifest.organs.map((organ) => [organ.organ_id, organ])),
      connectiveIds: new Set(
        manifest.organs
          .filter((organ) => tissueFamily(organ).id === "connective")
          .map((organ) => organ.organ_id),
      ),
      hiddenSystems: manifest.systems
        .filter((entry) => !entry.load_on_start)
        .map((entry) => entry.system)
        .sort(),
    }),

  setGenderModel: (gender) =>
    set((state) =>
      state.genderModel === gender
        ? state
        : {
            ...initialViewState,
            genderModel: gender,
            manifest: null,
            organs: {},
            hoveredOrganId: null,
            depthStack: [],
            pinnedStack: null,
          },
    ),

  setHovered: (organId) => set({ hoveredOrganId: organId }),

  setDepthStack: (organIds) =>
    set((state) =>
      sameStack(state.depthStack, organIds) ? state : { depthStack: organIds },
    ),

  clearDepthStack: () =>
    set((state) => (state.depthStack.length === 0 ? state : { depthStack: [] })),

  pinDepthStack: () =>
    set((state) =>
      state.depthStack.length > 0 ? { pinnedStack: state.depthStack } : state,
    ),

  unpinDepthStack: () =>
    set((state) => (state.pinnedStack === null ? state : { pinnedStack: null })),

  dismissDepthStack: () => set({ depthStack: [], pinnedStack: null }),

  selectFromViewport: (organId, additive = false) => {
    get().selectOrgan(organId, additive);
    if (organId !== null) {
      get().pinDepthStack();
    }
  },

  setEyeTracking: (enabled) => set({ eyeTracking: enabled }),
  setDepthProbeVisible: (visible) => set({ depthProbeVisible: visible }),
  setLabelsVisible: (visible) => set({ labelsVisible: visible }),
  setHideConnective: (hidden) => set({ hideConnective: hidden }),
  cycleBodyTone: () => set((state) => ({ bodyTone: nextBodyTone(state.bodyTone) })),
  setBackground: (mode) => set({ background: mode }),
  setLightingPreset: (preset) => set({ lightingPreset: preset }),

  restoreView: (preferences) =>
    set((state) => ({
      hiddenSystems: preferences.hiddenSystems
        ? [...preferences.hiddenSystems].sort()
        : state.hiddenSystems,
      systemOpacity: preferences.systemOpacity ?? state.systemOpacity,
      eyeTracking: preferences.eyeTracking ?? state.eyeTracking,
      depthProbeVisible: preferences.depthProbeVisible ?? state.depthProbeVisible,
      labelsVisible: preferences.labelsVisible ?? state.labelsVisible,
      hideConnective: preferences.hideConnective ?? state.hideConnective,
      background: preferences.background ?? state.background,
    })),

  selectOrgan: (organId, additive = false) =>
    set((state) => {
      if (organId === null) return { selectedOrganIds: [] };
      if (!additive) return { selectedOrganIds: [organId] };
      return state.selectedOrganIds.includes(organId)
        ? { selectedOrganIds: state.selectedOrganIds.filter((id) => id !== organId) }
        : { selectedOrganIds: [...state.selectedOrganIds, organId] };
    }),

  selectMany: (organIds) =>
    set((state) => ({
      selectedOrganIds: organIds.filter((id) => id in state.organs),
    })),

  addToSelection: (organIds) =>
    set((state) => {
      const merged = new Set(state.selectedOrganIds);
      for (const id of organIds) {
        if (id in state.organs) merged.add(id);
      }
      return { selectedOrganIds: [...merged] };
    }),

  clearSelection: () => set({ selectedOrganIds: [], pinnedStack: null }),
  setCaseMarks: (marks) => set({ caseMarks: marks }),

  isolateSelection: () =>
    set((state) =>
      state.selectedOrganIds.length === 0
        ? state
        : { isolatedOrganIds: [...state.selectedOrganIds] },
    ),

  hideSelection: () =>
    set((state) => {
      if (state.selectedOrganIds.length === 0) return state;
      const hidden = new Set([...state.hiddenOrganIds, ...state.selectedOrganIds]);
      return {
        hiddenOrganIds: [...hidden],
        selectedOrganIds: [],
      };
    }),

  unhideAll: () => set({ hiddenOrganIds: [] }),

  focusReference: (organId, index) =>
    set((state) => ({
      ...applySceneCommand(state, { action: "focus_organ", organ_id: organId }),
      focusBadge: { organId, index },
    })),

  applyCommand: (command) =>
    set((state) => {
      if (command.action === "isolate_group") {
        return isolateGroupIn(state, command.group) ?? state;
      }
      if (command.action === "add_supply") {
        return supplyRequestIn(state, command.kind);
      }
      if (command.action === "set_heart_rhythm") {
        startHeartRhythm(command.rhythm, command.sound ?? null);
        const hiddenSystems = state.hiddenSystems.filter((sys) => sys !== "cardiovascular");
        return hiddenSystems.length === state.hiddenSystems.length ? state : { hiddenSystems };
      }
      return applySceneCommand(state, command);
    }),

  toggleSystem: (system) =>
    set((state) => {
      const hidden = new Set(state.hiddenSystems);
      if (hidden.has(system)) hidden.delete(system);
      else hidden.add(system);
      return { hiddenSystems: [...hidden].sort() };
    }),

  soloSystem: (system) =>
    set((state) => {
      const all = state.manifest?.systems.map((s) => s.system) ?? [];
      const isSolo =
        !state.hiddenSystems.includes(system) && state.hiddenSystems.length === all.length - 1;

      return {
        hiddenSystems: isSolo ? [] : all.filter((s) => s !== system).sort(),
        isolatedOrganIds: null,
      };
    }),

  cycleSystemOpacity: (system) =>
    set((state) => {
      const nextMap = { ...state.systemOpacity };
      const currentVal = nextMap[system] ?? 1;
      const idx = GHOST_STOPS.findIndex((v) => Math.abs(v - currentVal) < 0.01);
      const chosenStop = GHOST_STOPS[(idx + 1) % GHOST_STOPS.length]!;
      if (chosenStop >= 1) delete nextMap[system];
      else nextMap[system] = chosenStop;
      return { systemOpacity: nextMap };
    }),

  xraySystem: (system) =>
    set((state) => {
      const all = state.manifest?.systems.map((s) => s.system) ?? [];
      const isAlreadyXray =
        state.systemOpacity[system] === undefined &&
        all.every((s) => s === system || state.systemOpacity[s] !== undefined);

      if (isAlreadyXray || all.length === 0) return { systemOpacity: {} };

      const xrayMap: Partial<Record<AnatomicalSystem, number>> = {};
      for (const s of all) {
        if (s !== system) xrayMap[s] = XRAY_OPACITY;
      }
      return { systemOpacity: xrayMap };
    }),

  clearGhosting: () => set({ systemOpacity: {} }),

  glassBody: () =>
    set((state) => {
      const all = state.manifest?.systems.map((s) => s.system) ?? [];
      const isAlreadyGlass =
        all.length > 0 && all.every((s) => state.systemOpacity[s] === GLASS_OPACITY);
      if (isAlreadyGlass) return { systemOpacity: {} };

      const glassMap: Partial<Record<AnatomicalSystem, number>> = {};
      for (const s of all) glassMap[s] = GLASS_OPACITY;
      return { systemOpacity: glassMap };
    }),

  setExplode: (factor) =>
    set({
      explode: Number.isFinite(factor) ? Math.min(Math.max(factor, 0), MAX_EXPLODE) : 0,
    }),

  cycleExplode: () => set((state) => ({ explode: nextExplodeStop(state.explode) })),

  fitView: () =>
    set((state) => ({ viewpoint: { kind: "fit", seq: (state.viewpoint?.seq ?? 0) + 1 } })),

  orientView: (view) =>
    set((state) => ({
      viewpoint: { kind: "orient", view, seq: (state.viewpoint?.seq ?? 0) + 1 },
    })),

  scanView: () =>
    set((state) => ({ viewpoint: { kind: "scan", seq: (state.viewpoint?.seq ?? 0) + 1 } })),

  dollyView: (factor) =>
    set((state) => ({
      viewpoint: { kind: "dolly", factor, seq: (state.viewpoint?.seq ?? 0) + 1 },
    })),

  clearPathway: () => set({ pathway: null }),

  showAllSystems: () =>
    set({ hiddenSystems: [], isolatedOrganIds: null, hiddenOrganIds: [], systemOpacity: {} }),

  studyRegion: (organId) =>
    set((state) => {
      const members = regionMembers(state.organs, organId);
      return {
        ...applySceneCommand(state, { action: "focus_organ", organ_id: organId }),
        isolatedOrganIds: members,
      };
    }),

  studyGroup: (node) => set((state) => isolateGroupIn(state, node) ?? state),

  clearIsolation: () =>
    set({
      isolatedOrganIds: null,
      hiddenOrganIds: [],
      supplyRequest: null,
      supplyResult: null,
    }),

  requestSupply: (kind) => set((state) => supplyRequestIn(state, kind)),

  resolveSupply: (organIds) =>
    set((state) => {
      const kind = state.supplyRequest?.kind;
      if (!kind || state.isolatedOrganIds === null) {
        return { supplyRequest: null };
      }
      const merged = new Set(state.isolatedOrganIds);
      for (const id of organIds) merged.add(id);
      return {
        isolatedOrganIds: [...merged],
        supplyRequest: null,
        supplyResult: { kind, added: merged.size - state.isolatedOrganIds.length },
      };
    }),

  cancelSupply: () => set({ supplyRequest: null }),

  dropFromIsolation: (organId) =>
    set((state) => {
      if (state.isolatedOrganIds === null) return state;
      const remaining = state.isolatedOrganIds.filter((id) => id !== organId);
      return { isolatedOrganIds: remaining.length === 0 ? null : remaining };
    }),

  studyOrgan: (organId, additive = false) =>
    set((state) => {
      const current = state.isolatedOrganIds ?? [];
      const updated = additive
        ? current.includes(organId)
          ? current.filter((id) => id !== organId)
          : [...current, organId]
        : [organId];

      if (updated.length === 0) {
        return { ...state, isolatedOrganIds: null };
      }

      return {
        ...applySceneCommand(state, { action: "focus_organ", organ_id: organId }),
        isolatedOrganIds: updated,
      };
    }),

  resetView: () =>
    set((state) => ({
      ...applySceneCommand(state, { action: "reset_view" }),
      systemOpacity: {},
      bodyTone: "solid",
    })),
}));

export type VisibilityState = Pick<
  SceneStore,
  "hiddenSystems" | "isolatedOrganIds" | "hiddenOrganIds" | "hideConnective" | "connectiveIds"
>;

export function isOrganVisible(
  state: VisibilityState,
  organ: ManifestOrgan,
): boolean {
  if (state.hiddenSystems.includes(organ.system)) return false;
  if (state.hiddenOrganIds.includes(organ.organ_id)) return false;
  if (state.hideConnective && state.connectiveIds.has(organ.organ_id)) return false;
  if (state.isolatedOrganIds !== null && !state.isolatedOrganIds.includes(organ.organ_id)) {
    return false;
  }
  return true;
}

export function organOpacity(
  state: Pick<SceneViewState, "systemOpacity">,
  organ: ManifestOrgan,
): number {
  return state.systemOpacity[organ.system] ?? 1;
}

export function regionMembers(
  organs: Record<string, ManifestOrgan>,
  organId: string,
): string[] {
  const root = organs[organId];
  if (!root) return [organId];
  return [...new Set<string>([organId, ...regionMembersByNode(organs, root.node)])];
}

export function regionMembersByNode(
  organs: Record<string, ManifestOrgan>,
  node: string,
): string[] {
  const members: string[] = [];
  for (const organ of Object.values(organs)) {
    if (organ.path.includes(node) || organ.node === node) {
      members.push(organ.organ_id);
    }
  }
  return members;
}

export function groupNames(organs: ManifestOrgan[]): string[] {
  const tallies = new Map<string, number>();
  for (const organ of organs) {
    for (const node of organ.path) {
      tallies.set(node, (tallies.get(node) ?? 0) + 1);
    }
  }
  return [...tallies]
    .filter(([, count]) => count > 1)
    .map(([node]) => node)
    .sort();
}

export function supplyRequestIn<T extends SceneViewState>(
  state: T,
  kind: SupplyKind,
): T | Partial<SceneViewState> {
  if (state.isolatedOrganIds === null) return state;
  const targetSystem = SUPPLY_SYSTEM[kind];
  return {
    hiddenSystems: state.hiddenSystems.filter((entry) => entry !== targetSystem),
    supplyRequest: { kind, seq: (state.supplyRequest?.seq ?? 0) + 1 },
    supplyResult: null,
  };
}

export function isolateGroupIn(
  state: SceneViewState & { organs: Record<string, ManifestOrgan> },
  node: string,
): Partial<SceneViewState> | null {
  const members = regionMembersByNode(state.organs, node);
  if (members.length === 0) return null;
  return {
    ...applySceneCommand(state, { action: "focus_organ", organ_id: members[0]! }),
    isolatedOrganIds: members,
  };
}

const LATERALITY_SUFFIX = /\s\((left|right)\)$/i;

export function organSide(organ: Pick<ManifestOrgan, "name_en">): "left" | "right" | null {
  const match = LATERALITY_SUFFIX.exec(organ.name_en);
  return match ? (match[1]!.toLowerCase() as "left" | "right") : null;
}

export function organLabel(organ: ManifestOrgan): string {
  return [organ.ta2_latin, organSide(organ), organ.qualifier]
    .filter(Boolean)
    .join(" · ");
}

export function organSubtitle(organ: ManifestOrgan): string {
  return organ.name_en;
}
