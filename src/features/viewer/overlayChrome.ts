/**
 * The look of the small controls that sit over the viewport.
 *
 * Modern spatial computing glassmorphic HUD styling.
 */

/** The ground every overlay control stands on: border, fill and text colour. */
export const OVERLAY_GROUND = "border border-teal-500/30 bg-slate-900/90 text-slate-300 backdrop-blur-xl ring-1 ring-white/10 shadow-xl";

/** A small monospaced chip: a folded panel, a hint marker, a closed view. */
export const OVERLAY_CHIP = `rounded-lg ${OVERLAY_GROUND} px-2 py-0.5 font-mono text-[9px]`;

/** What a chip that does something looks like under the pointer. */
export const OVERLAY_CHIP_ACTION = "hover:border-teal-400 hover:text-teal-200 transition";

/** A mode switch that is off. */
export const OVERLAY_SWITCH_OFF =
  "border-slate-700/80 bg-slate-900/90 text-slate-300 hover:border-teal-500/50 hover:text-teal-200 backdrop-blur-xl ring-1 ring-white/10 shadow-lg";

/**
 * A mode switch that is on: a dark ground tinted with the mode's own hue.
 */
export const OVERLAY_SWITCH_ON = {
  cyan: "border-cyan-400/80 bg-cyan-950/90 text-cyan-200 shadow-cyan-950/50 shadow-lg ring-1 ring-cyan-400/40 backdrop-blur-xl",
  sky: "border-sky-400/80 bg-sky-950/90 text-sky-200 shadow-sky-950/50 shadow-lg ring-1 ring-sky-400/40 backdrop-blur-xl",
  rose: "border-rose-400/80 bg-rose-950/90 text-rose-200 shadow-rose-950/50 shadow-lg ring-1 ring-rose-400/40 backdrop-blur-xl",
} as const;
