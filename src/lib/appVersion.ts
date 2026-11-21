declare const __APP_VERSION__: string;

/**
 * Semantic version of Hoomaan application injected at build time via Vite define.
 */
export const APP_VERSION: string =
  typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "0.7.0";

/** Human-readable version tag formatted for HUD display and documentation headers. */
export const APP_VERSION_LABEL = `v${APP_VERSION}`;
