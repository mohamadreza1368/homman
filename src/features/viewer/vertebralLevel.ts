/**
 * Hoomaan 3D Viewer - Vertebral Spinal Level Identification
 */

import type * as THREE from "three";

/**
 * Parses vertebral bone or intervertebral disc identifier into standard clinical notation (e.g. C1, T8, L4–L5).
 */
export function vertebralLevel(organId: string): string | null {
  if (organId === "atlas_c1") return "C1";
  if (organId === "axis_c2") return "C2";
  if (organId === "sacrum") return "S";
  if (organId === "coccyx") return "Co";

  const disc = /^intervertebral_disc_([ctls])(\d{1,2})_([ctls])(\d{1,2})$/.exec(organId);
  if (disc) {
    return `${disc[1]!.toUpperCase()}${disc[2]}–${disc[3]!.toUpperCase()}${disc[4]}`;
  }

  const bone = /^vertebra_([ctl])(\d{1,2})$/.exec(organId);
  if (bone) {
    return `${bone[1]!.toUpperCase()}${bone[2]}`;
  }

  return null;
}

/**
 * Resolves the closest spinal vertebral level at a given height y coordinate.
 */
export function levelAt(boxes: Map<string, THREE.Box3>, at: number): string | null {
  let closestLevel: string | null = null;
  let minDistance = Number.POSITIVE_INFINITY;

  for (const [id, box] of boxes) {
    const level = vertebralLevel(id);
    if (!level) continue;
    if (at < box.min.y || at > box.max.y) continue;

    const centerY = (box.min.y + box.max.y) / 2;
    const dist = Math.abs(at - centerY);
    if (dist < minDistance) {
      minDistance = dist;
      closestLevel = level;
    }
  }

  return closestLevel;
}

/** Global observable reference reflecting active plane vertebral position. */
export const CURRENT_LEVEL: { value: string | null } = { value: null };
