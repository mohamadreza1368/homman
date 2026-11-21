import type { ManifestOrgan } from "@/lib/schemas";
import { SUPPLY_SYSTEM, type SupplyKind } from "@/features/viewer/supply";
import { applySceneCommand } from "./sceneCommandHandlers";
import type { SceneViewState, VisibilityState } from "./sceneStoreTypes";

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
  return Array.from(new Set([organId, ...regionMembersByNode(organs, root.node)]));
}

export function regionMembersByNode(
  organs: Record<string, ManifestOrgan>,
  node: string,
): string[] {
  const matchingIds: string[] = [];
  for (const organ of Object.values(organs)) {
    if (organ.path.includes(node) || organ.node === node) {
      matchingIds.push(organ.organ_id);
    }
  }
  return matchingIds;
}

export function groupNames(organs: ManifestOrgan[]): string[] {
  const frequencies = new Map<string, number>();
  for (const o of organs) {
    for (const seg of o.path) {
      frequencies.set(seg, (frequencies.get(seg) ?? 0) + 1);
    }
  }
  const result: string[] = [];
  for (const [node, count] of frequencies) {
    if (count > 1) {
      result.push(node);
    }
  }
  return result.sort();
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
  const matched = LATERALITY_SUFFIX.exec(organ.name_en);
  return matched ? (matched[1]!.toLowerCase() as "left" | "right") : null;
}

export function organLabel(organ: ManifestOrgan): string {
  const parts = [organ.ta2_latin, organSide(organ), organ.qualifier];
  return parts.filter(Boolean).join(" · ");
}

export function organSubtitle(organ: ManifestOrgan): string {
  return organ.name_en;
}
