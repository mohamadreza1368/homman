export type BackgroundMode = "dark" | "light";

export interface BackgroundTheme {
  canvas: string;
  ambient: number;
  leader: string;
  chip: string;
  ink: string;
  footerInk: string;
  footerSubtle: string;
}

const DARK_SCHEME: BackgroundTheme = {
  canvas: "#0b1220",
  ambient: 0.34,
  leader: "rgba(125, 211, 252, 0.65)",
  chip: "rgba(2, 6, 23, 0.75)",
  ink: "#e0f2fe",
  footerInk: "#94a3b8",
  footerSubtle: "#64748b",
};

const LIGHT_SCHEME: BackgroundTheme = {
  canvas: "#dae2ec",
  ambient: 0.46,
  leader: "rgba(30, 64, 120, 0.55)",
  chip: "rgba(255, 255, 255, 0.82)",
  ink: "#15304f",
  footerInk: "#334155",
  footerSubtle: "#64748b",
};

export const BACKGROUNDS: Record<BackgroundMode, BackgroundTheme> = Object.freeze({
  dark: DARK_SCHEME,
  light: LIGHT_SCHEME,
});

export function backgroundTheme(mode: BackgroundMode): BackgroundTheme {
  return mode === "light" ? LIGHT_SCHEME : DARK_SCHEME;
}
