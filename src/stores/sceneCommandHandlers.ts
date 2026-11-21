import type { SceneCommand } from "@/lib/schemas";
import { initialViewState, type SceneViewState } from "./sceneStoreTypes";

export function ensureOrgansVisible(
  current: SceneViewState,
  ids: readonly string[],
): Partial<SceneViewState> {
  const patch: Partial<SceneViewState> = {};
  const idSet = new Set(ids);

  const prunedHidden = current.hiddenOrganIds.filter((hId) => !idSet.has(hId));
  if (prunedHidden.length !== current.hiddenOrganIds.length) {
    patch.hiddenOrganIds = prunedHidden;
  }

  if (current.isolatedOrganIds !== null) {
    const isoSet = new Set(current.isolatedOrganIds);
    let changed = false;
    for (const item of ids) {
      if (!isoSet.has(item)) {
        isoSet.add(item);
        changed = true;
      }
    }
    if (changed) {
      patch.isolatedOrganIds = Array.from(isoSet);
    }
  }

  return patch;
}

type CommandReducer<K extends SceneCommand["action"]> = (
  state: SceneViewState,
  cmd: Extract<SceneCommand, { action: K }>,
) => SceneViewState;

const HANDLERS: { [K in SceneCommand["action"]]: CommandReducer<K> } = {
  say: (state) => state,

  focus_organ: (state, cmd) => ({
    ...state,
    ...ensureOrgansVisible(state, [cmd.organ_id]),
    selectedOrganIds: [cmd.organ_id],
    focusRequest: {
      organId: cmd.organ_id,
      seq: (state.focusRequest?.seq ?? 0) + 1,
    },
  }),

  set_layer_visibility: (state, cmd) => {
    const set = new Set(state.hiddenSystems);
    if (cmd.visible) {
      set.delete(cmd.system);
    } else {
      set.add(cmd.system);
    }
    return { ...state, hiddenSystems: Array.from(set).sort() };
  },

  set_layer_opacity: (state, cmd) => {
    const op = { ...state.systemOpacity };
    if (cmd.opacity >= 1) {
      delete op[cmd.system];
    } else {
      op[cmd.system] = cmd.opacity;
    }
    return { ...state, systemOpacity: op };
  },

  isolate_structures: (state, cmd) => ({
    ...state,
    isolatedOrganIds: [...cmd.organ_ids],
  }),

  isolate_group: (state) => state,
  add_supply: (state) => state,

  isolate_region: (state, cmd) => ({
    ...state,
    isolatedOrganIds: [cmd.organ_id],
    selectedOrganIds: [cmd.organ_id],
    focusRequest: {
      organId: cmd.organ_id,
      seq: (state.focusRequest?.seq ?? 0) + 1,
    },
  }),

  apply_pathology_overlay: (state, cmd) => ({
    ...state,
    pathologyOverlays: {
      ...state.pathologyOverlays,
      [cmd.organ_id]: {
        pathology: cmd.pathology,
        severity: cmd.severity,
      },
    },
  }),

  clear_pathology_overlays: (state) => ({
    ...state,
    pathologyOverlays: {},
  }),

  highlight_pathway: (state, cmd) => ({
    ...state,
    pathway: {
      label: cmd.label,
      organIds: [...cmd.organ_ids],
      stepSeconds: cmd.step_seconds,
      loop: cmd.loop,
      seq: (state.pathway?.seq ?? 0) + 1,
    },
  }),

  clear_pathway: (state) => ({
    ...state,
    pathway: null,
  }),

  illuminate_structures: (state, cmd) => {
    const list = [...cmd.organ_ids];
    return {
      ...state,
      ...ensureOrgansVisible(state, list),
      illuminated: list,
    };
  },

  set_cross_section: (state, cmd) => ({
    ...state,
    crossSection: { plane: cmd.plane, position: cmd.position },
  }),

  set_heart_rhythm: (state) => state,

  scan_at_structure: (state, cmd) => ({
    ...state,
    ...ensureOrgansVisible(state, [cmd.organ_id]),
    scanRequest: {
      organId: cmd.organ_id,
      seq: (state.scanRequest?.seq ?? 0) + 1,
      ...(cmd.plane ? { plane: cmd.plane } : {}),
    },
  }),

  reset_view: (state) => ({
    ...initialViewState,
    selectedOrganIds: state.selectedOrganIds,
    systemOpacity: state.systemOpacity,
    bodyTone: state.bodyTone,
  }),
};

/**
 * Pure reducer applying an incoming scene command to viewport state.
 */
export function applySceneCommand(
  state: SceneViewState,
  command: SceneCommand,
): SceneViewState {
  const handler = HANDLERS[command.action] as CommandReducer<any>;
  return handler ? handler(state, command) : state;
}
