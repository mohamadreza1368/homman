import { create } from "zustand";

import type { AnatomicalSystem, ManifestOrgan } from "@/lib/schemas";
import {
  applySingleSelection,
  applyAdditiveSelection,
  enterIsolation,
  getNextTransparencyStep,
} from "@/features/viewer/selectionEngine";
import { sameStack } from "@/features/viewer/depthStack";
import { tissueFamily } from "@/features/viewer/palette";
import { MAX_EXPLODE, nextExplodeStop } from "@/features/viewer/explode";
import { nextBodyTone } from "@/features/viewer/scan";
import { resolvePedicleMembers } from "@/features/viewer/pedicleCatalog";
import { getSurgicalSpace, resolveSurgicalSpaceOrgans } from "@/features/anatomy/surgicalSpacesCatalog";
import { enrichManifestWithSupplementaryOrgans } from "@/features/anatomy/supplementaryOrgans";
import { startHeartRhythm } from "./heartStore";
import {
  GLASS_OPACITY,
  initialViewState,
  type SceneStore,
} from "./sceneStoreTypes";
import { applySceneCommand } from "./sceneCommandHandlers";

export const XRAY_OPACITY = 0.16;
import {
  isolateGroupIn,
  regionMembers,
  supplyRequestIn,
} from "./sceneUtils";

export * from "./sceneStoreTypes";
export * from "./sceneCommandHandlers";
export * from "./sceneUtils";

/**
 * Core 3D anatomical scene and viewport state management for HOOMAAN.
 * Single source of truth for R3F rendering, anatomical layer visibility,
 * structure selection, pathology overlays, dissection levels, and camera operations.
 */
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
  selectionHitPoints: {},
  background: "dark",
  lightingPreset: "studio",

  setManifest: (rawManifest) => {
    const manifest =
      get().genderModel === "male"
        ? enrichManifestWithSupplementaryOrgans(rawManifest)
        : rawManifest;
    const organMap: Record<string, ManifestOrgan> = {};
    const connSet = new Set<string>();
    for (const item of manifest.organs) {
      organMap[item.organ_id] = item;
      if (tissueFamily(item).id === "connective") {
        connSet.add(item.organ_id);
      }
    }
    const unstarted = manifest.systems
      .filter((s) => !s.load_on_start)
      .map((s) => s.system)
      .sort();

    set({
      manifest,
      organs: organMap,
      connectiveIds: connSet,
      hiddenSystems: unstarted,
    });
  },

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

  selectFromViewport: (organId, additive = false, hitPoint) => {
    get().selectOrgan(organId, additive, hitPoint);
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

  restoreView: (pref) =>
    set((state) => ({
      hiddenSystems: pref.hiddenSystems ? [...pref.hiddenSystems].sort() : state.hiddenSystems,
      systemOpacity: pref.systemOpacity ?? state.systemOpacity,
      eyeTracking: pref.eyeTracking ?? state.eyeTracking,
      depthProbeVisible: pref.depthProbeVisible ?? state.depthProbeVisible,
      labelsVisible: pref.labelsVisible ?? state.labelsVisible,
      hideConnective: pref.hideConnective ?? state.hideConnective,
      background: pref.background ?? state.background,
    })),

  selectOrgan: (organId, additive = false, hitPoint) =>
    set((state) => {
      const currentSelection = new Set(state.selectedOrganIds);
      const nextSelection = additive
        ? (organId ? applyAdditiveSelection(currentSelection, organId) : currentSelection)
        : applySingleSelection(organId);

      const nextHitPoints = additive ? { ...(state.selectionHitPoints ?? {}) } : {};
      if (organId && hitPoint) {
        nextHitPoints[organId] = hitPoint;
      }

      return {
        selectedOrganIds: Array.from(nextSelection),
        selectionHitPoints: nextHitPoints,
      };
    }),

  selectMany: (organIds) =>
    set((state) => ({
      selectedOrganIds: organIds.filter((id) => id in state.organs),
    })),

  addToSelection: (organIds) =>
    set((state) => {
      let active = new Set(state.selectedOrganIds);
      for (const id of organIds) {
        if (id in state.organs) active = applyAdditiveSelection(active, id);
      }
      return { selectedOrganIds: Array.from(active) };
    }),

  clearSelection: () => set({ selectedOrganIds: [], pinnedStack: null }),
  setCaseMarks: (marks) => set({ caseMarks: marks }),

  isolateSelection: () =>
    set((state) => {
      if (state.selectedOrganIds.length === 0) return state;
      const isolatedSet = enterIsolation(state.selectedOrganIds);
      return { isolatedOrganIds: Array.from(isolatedSet) };
    }),

  hideSelection: () =>
    set((state) => {
      if (state.selectedOrganIds.length === 0) return state;
      const setIds = new Set([...state.hiddenOrganIds, ...state.selectedOrganIds]);
      return {
        hiddenOrganIds: Array.from(setIds),
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
        const filteredSystems = state.hiddenSystems.filter((sys) => sys !== "cardiovascular");
        return filteredSystems.length === state.hiddenSystems.length
          ? state
          : { hiddenSystems: filteredSystems };
      }
      return applySceneCommand(state, command);
    }),

  toggleSystem: (system) =>
    set((state) => {
      const active = new Set(state.hiddenSystems);
      if (active.has(system)) {
        active.delete(system);
      } else {
        active.add(system);
      }
      return { hiddenSystems: Array.from(active).sort() };
    }),

  soloSystem: (system) =>
    set((state) => {
      const allSystems = state.manifest?.systems.map((s) => s.system) ?? [];
      const alreadySolo =
        !state.hiddenSystems.includes(system) && state.hiddenSystems.length === allSystems.length - 1;

      return {
        hiddenSystems: alreadySolo ? [] : allSystems.filter((s) => s !== system).sort(),
        isolatedOrganIds: null,
      };
    }),

  cycleSystemOpacity: (system) =>
    set((state) => {
      const nextMap = { ...state.systemOpacity };
      const current = nextMap[system] ?? 1.0;
      const nextOpacity = getNextTransparencyStep(current);
      if (nextOpacity >= 1.0) {
        delete nextMap[system];
      } else {
        nextMap[system] = nextOpacity;
      }
      return { systemOpacity: nextMap };
    }),

  xraySystem: (system) =>
    set((state) => {
      const allSystems = state.manifest?.systems.map((s) => s.system) ?? [];
      const isAlreadyXray =
        state.systemOpacity[system] === undefined &&
        allSystems.every((s) => s === system || state.systemOpacity[s] !== undefined);

      if (isAlreadyXray || allSystems.length === 0) {
        return { systemOpacity: {} };
      }

      const xrayMap: Partial<Record<AnatomicalSystem, number>> = {};
      for (const s of allSystems) {
        if (s !== system) {
          xrayMap[s] = XRAY_OPACITY;
        }
      }
      return { systemOpacity: xrayMap };
    }),

  clearGhosting: () => set({ systemOpacity: {} }),

  glassBody: () =>
    set((state) => {
      const allSystems = state.manifest?.systems.map((s) => s.system) ?? [];
      const isAlreadyGlass =
        allSystems.length > 0 && allSystems.every((s) => state.systemOpacity[s] === GLASS_OPACITY);
      if (isAlreadyGlass) {
        return { systemOpacity: {} };
      }

      const glassMap: Partial<Record<AnatomicalSystem, number>> = {};
      for (const s of allSystems) {
        glassMap[s] = GLASS_OPACITY;
      }
      return { systemOpacity: glassMap };
    }),

  setExplode: (factor) =>
    set({
      explode: Number.isFinite(factor) ? Math.min(Math.max(factor, 0), MAX_EXPLODE) : 0,
    }),

  cycleExplode: () => set((state) => ({ explode: nextExplodeStop(state.explode) })),

  setHalfDissection: (mode) => set({ halfDissection: mode }),

  cycleHalfDissection: () =>
    set((state) => {
      const next =
        state.halfDissection === "off"
          ? "right"
          : state.halfDissection === "right"
            ? "left"
            : "off";
      return { halfDissection: next };
    }),

  setDissectionDepth: (depth) =>
    set({
      dissectionDepth: Math.max(0, Math.min(3, Math.round(depth))),
    }),

  cycleDissectionDepth: () =>
    set((state) => ({
      dissectionDepth: (state.dissectionDepth + 1) % 4,
    })),

  isolatePedicle: (organId) =>
    set((state) => {
      const members = resolvePedicleMembers(organId, state.organs);
      return {
        ...applySceneCommand(state, { action: "focus_organ", organ_id: organId }),
        isolatedOrganIds: members,
        selectedOrganIds: [organId],
      };
    }),

  isolateSurgicalSpace: (spaceId) =>
    set((state) => {
      const space = getSurgicalSpace(spaceId);
      if (!space) return {};
      const organIds = Object.keys(state.organs);
      const members = resolveSurgicalSpaceOrgans(space, organIds);
      const neededSystems = new Set(
        members.map((id) => state.organs[id]?.system).filter(Boolean),
      );
      const target =
        (space.targetOrganId && state.organs[space.targetOrganId] ? space.targetOrganId : undefined) ??
        members[0];
      const base = target ? applySceneCommand(state, { action: "focus_organ", organ_id: target }) : {};
      return {
        ...base,
        hiddenSystems: state.hiddenSystems.filter((s) => !neededSystems.has(s)),
        isolatedOrganIds: members.length > 0 ? members : null,
        selectedOrganIds: target ? [target] : state.selectedOrganIds,
      };
    }),

  toggleConductionSystem: () =>
    set((state) => ({ conductionSystemVisible: !state.conductionSystemVisible })),

  toggleEcgLeads: () =>
    set((state) => ({ ecgLeadsVisible: !state.ecgLeadsVisible })),

  toggleClinicalProcedures: () =>
    set((state) => ({ clinicalProceduresVisible: !state.clinicalProceduresVisible })),

  toggleLiverSegmentsMode: () =>
    set((state) => ({ liverSegmentsMode: !state.liverSegmentsMode })),

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
        isolatedOrganIds: Array.from(merged),
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
