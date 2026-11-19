/**
 * Hoomaan 3D Viewer - Scan Tone & Shading Transforms
 */

import * as THREE from "three";

/** Residual saturation factor retained during desaturation scan mode. */
export const SCAN_SATURATION = 0.06;

export type BodyTone = "solid" | "scan" | "carbon";

export const CARBON_LIGHTNESS = 0.34;
export const CARBON_GRAPHITE = 0.3;
const GRAPHITE = new THREE.Color("#0b1016");

const tmpHsl = { h: 0, s: 0, l: 0 };

/** Computes shaded tissue color transformed by the active body rendering tone. */
export function scanColour(tissue: THREE.Color, tone: BodyTone = "scan"): THREE.Color {
  if (tone === "solid") return tissue.clone();

  const c = tissue.clone();
  c.getHSL(tmpHsl);

  if (tone === "scan") {
    c.setHSL(tmpHsl.h, tmpHsl.s * SCAN_SATURATION, tmpHsl.l);
    return c;
  }

  c.setHSL(tmpHsl.h, tmpHsl.s * SCAN_SATURATION, tmpHsl.l * CARBON_LIGHTNESS);
  return c.lerp(GRAPHITE, CARBON_GRAPHITE);
}

/** Cycles through available body tones: solid -> scan -> carbon -> solid. */
export function nextBodyTone(tone: BodyTone): BodyTone {
  return tone === "solid" ? "scan" : tone === "scan" ? "carbon" : "solid";
}

/** Determines whether an organ retains its full natural saturation in scan mode. */
export function keepsColour(state: {
  lit: boolean;
  selected: boolean;
  isolated: boolean;
}): boolean {
  return state.lit || state.selected || state.isolated;
}
