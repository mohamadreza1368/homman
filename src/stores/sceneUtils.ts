import type { ManifestOrgan } from "@/lib/schemas";
import { SUPPLY_SYSTEM, type SupplyKind } from "@/features/viewer/supply";
import { applySceneCommand } from "./sceneCommandHandlers";
import type { SceneViewState, VisibilityState } from "./sceneStoreTypes";

export function organLaterality(
  organ: Pick<ManifestOrgan, "organ_id" | "node" | "name_en">,
): "left" | "right" | "midline" {
  const id = organ.organ_id;
  if (
    /(?:_l|_el|_ol|_left)$/i.test(id) ||
    /\.l$/i.test(organ.node) ||
    organSide(organ) === "left"
  ) {
    return "left";
  }
  if (
    /(?:_r|_er|_or|_right)$/i.test(id) ||
    /\.r$/i.test(organ.node) ||
    organSide(organ) === "right"
  ) {
    return "right";
  }
  return "midline";
}

/**
 * Categorizes an organ into surgical dissection depth tiers:
 * Tier 1 (Superficial): Integumentary, superficial fascia, superficial bursae, and superficial muscles.
 * Tier 2 (Intermediate): Intermediate musculature, intermediate tendons, and peripheral vessels/nerves.
 * Tier 3 (Deep): Skeletal system, joints, articular cartilage, deep viscera, and deep axial neurovascular core.
 */
export function organDepthTier(organ: ManifestOrgan): number {
  if (organ.system === "integumentary" || organ.system === "regional") return 1;

  // Cardiovascular vessels are neurovascular structures (Tier 2/3)
  if (organ.system === "cardiovascular") {
    // Only cutaneous superficial veins (like saphenous/cephalic) are Tier 2, all arteries and deep veins are Tier 3
    const isCutaneous = /saphenous|cephalic|basilic|superficial_vein/i.test(organ.organ_id);
    return isCutaneous ? 2 : 3;
  }

  const id = organ.organ_id.toLowerCase();
  const pathStr = (organ.path || []).join(" ").toLowerCase();

  // Superficial bursae and fascia
  if (
    pathStr.includes("bursae") ||
    pathStr.includes("fascia") ||
    pathStr.includes("superficial") ||
    id.includes("fascia") ||
    id.includes("bursa")
  ) {
    return 1;
  }

  // Major superficial muscles covering deeper anatomy (Netter & Gray's Surgical Anatomy)
  if (
    /platysma|trapezius|latissimus_dorsi|pectoralis_major|rectus_abdominis|gluteus_maximus|deltoid|gastrocnemius|epicranius|sternocleidomastoid|external_oblique/.test(
      id,
    )
  ) {
    return 1;
  }

  // Muscular system generally is Tier 2 (intermediate)
  if (organ.system === "muscular") {
    return 2;
  }

  // Deep structures: skeletal, articular, viscera, deep neurovascular
  return 3;
}

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

  // Prevent z-fighting between overlapping whole-organ envelopes and their segmental sub-meshes
  // (Liver vs 8 Couinaud segments, and Pleura vs 5 Lung lobes)
  const isWholeSystemOrFullView =
    state.isolatedOrganIds === null || state.isolatedOrganIds.length > 8;
  if (isWholeSystemOrFullView) {
    if (organ.organ_id === "liver" && state.liverSegmentsMode) {
      return false;
    }
    if (organ.organ_id.includes("_segment_of_liver_") && !state.liverSegmentsMode) {
      return false;
    }
    if (organ.organ_id === "pleura") {
      return false;
    }
  }

  // Dissection depth & Netter-style half-dissection
  const depth = state.dissectionDepth ?? 0;
  const half = state.halfDissection ?? "off";

  if (depth > 0 || half !== "off") {
    const organSide = organLaterality(organ);
    const tier = organDepthTier(organ);

    // If half-dissection is active:
    // "right": only right side is dissected deeply (left and midline stay intact)
    // "left": only left side is dissected deeply (right and midline stay intact)
    const isSubjectToDissection =
      half === "off" ||
      (half === "right" && organSide === "right") ||
      (half === "left" && organSide === "left");

    if (isSubjectToDissection) {
      const effectiveDepth = depth > 0 ? depth : 2;
      if (effectiveDepth >= 1 && tier === 1) return false;
      if (effectiveDepth >= 2 && tier === 2) return false;
      if (effectiveDepth >= 3 && tier < 3) return false;
    }
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
