/**
 * Hoomaan 3D Viewer - Viewport Composite Image Exporter & Attribution
 */

import { APP_VERSION_LABEL } from "@/lib/appVersion";
import { saveViewImage } from "@/lib/studyDb";
import type { AnatomyManifest } from "@/lib/schemas";
import { useSceneStore } from "@/stores/sceneStore";
import { backgroundTheme, type BackgroundTheme } from "./background";
import { layoutLabels, type LabelAnchor } from "./labelLayout";
import { labelTargets } from "./LabelOverlay";
import { getViewerHandle, projectToScreen } from "./viewerBridge";
import { captureView } from "./captureView";

const FOOTER_HEIGHT = 46;

export const DISCLAIMER = `HOOMAAN ${APP_VERSION_LABEL} — educational use only. Not a medical device.`;

function readableLicence(spdx: string): string {
  return spdx.replace(/^CC-/, "CC ").replace(/-(\d)/, " $1").replace(/-/g, "-");
}

/** Formats required anatomical copyright attribution and license statement. */
export function attributionLine(
  manifest: Pick<AnatomyManifest, "credit" | "attribution" | "license"> | null,
): string {
  if (!manifest) return "";
  if (!manifest.credit) return `Anatomy: ${manifest.attribution}`;
  return `Anatomy: ${manifest.credit} — ${readableLicence(manifest.license)}`;
}

/**
 * Captures currently active 3D view, overlays high-res anatomical callouts, and persists image.
 */
export async function exportViewImage(): Promise<string | null> {
  const handle = getViewerHandle();
  if (!handle) throw new Error("The viewer is not ready yet.");

  const { gl, centres } = handle;
  const source = gl.domElement;

  const width = source.width;
  const height = source.height;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height + FOOTER_HEIGHT;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not prepare the image.");

  const theme = backgroundTheme(useSceneStore.getState().background);
  ctx.fillStyle = theme.canvas;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  captureView(handle, (camera) => {
    ctx.drawImage(source, 0, 0);
    drawLabels(ctx, width, height, centres, camera, theme);
  });

  drawFooter(
    ctx,
    width,
    height,
    theme,
    attributionLine(useSceneStore.getState().manifest),
  );

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  if (!blob) throw new Error("Could not encode the image.");

  const bytes = new Uint8Array(await blob.arrayBuffer());
  return saveViewImage(toBase64(bytes));
}

function drawLabels(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  centres: Map<string, { x: number; y: number; z: number }>,
  camera: Parameters<typeof projectToScreen>[1],
  theme: BackgroundTheme,
): void {
  const state = useSceneStore.getState();
  const targets = labelTargets(
    state.organs,
    state.selectedOrganIds,
    state.isolatedOrganIds,
    state.labelsVisible,
  );
  if (targets.length === 0) return;

  const scale = Math.max(width / 1000, 1);
  const fontSize = Math.round(13 * scale);
  const lineHeight = Math.round(22 * scale);
  const margin = Math.round(14 * scale);

  const anchors: LabelAnchor[] = targets.map((target) => {
    const centre = centres.get(target.id);
    if (!centre) return { ...target, x: NaN, y: NaN };
    const point = projectToScreen(centre as never, camera, width, height);
    return { ...target, x: point.x, y: point.y, behind: point.behind };
  });

  ctx.font = `italic ${fontSize}px system-ui, "Segoe UI", sans-serif`;

  const placed = layoutLabels(anchors, {
    width,
    height,
    lineHeight,
    margin,
    padding: Math.round(18 * scale),
    gap: Math.round(70 * scale),
    measure: (text) => ctx.measureText(text).width + Math.round(18 * scale),
  });
  ctx.textBaseline = "middle";

  for (const label of placed) {
    ctx.strokeStyle = theme.leader;
    ctx.lineWidth = Math.max(scale, 1);
    ctx.beginPath();
    ctx.moveTo(label.x, label.y);
    ctx.lineTo(label.labelX, label.labelY);
    ctx.stroke();

    ctx.textAlign = label.side === "left" ? "right" : "left";
    const textWidth = ctx.measureText(label.text).width;
    const boxX =
      label.side === "left" ? label.labelX - textWidth - 4 * scale : label.labelX - 4 * scale;

    ctx.fillStyle = theme.chip;
    ctx.fillRect(
      boxX,
      label.labelY - fontSize * 0.85,
      textWidth + 8 * scale,
      fontSize * 1.7,
    );
    ctx.fillStyle = theme.ink;
    ctx.fillText(label.text, label.labelX, label.labelY);
  }
}

function drawFooter(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  theme: BackgroundTheme,
  attribution: string,
): void {
  const scale = Math.max(width / 1000, 1);
  ctx.fillStyle = theme.canvas;
  ctx.fillRect(0, height, width, FOOTER_HEIGHT);
  ctx.strokeStyle = "rgba(148, 163, 184, 0.25)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, height + 0.5);
  ctx.lineTo(width, height + 0.5);
  ctx.stroke();

  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.font = `${Math.round(11 * scale)}px system-ui, "Segoe UI", sans-serif`;
  ctx.fillStyle = theme.footerInk;
  ctx.fillText(DISCLAIMER, 12 * scale, height + FOOTER_HEIGHT * 0.36);
  ctx.fillStyle = theme.footerSubtle;
  ctx.fillText(attribution, 12 * scale, height + FOOTER_HEIGHT * 0.72);
}

function toBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000;
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + CHUNK));
  }
  return btoa(binary);
}

export const encodeImageBytes = toBase64;
export const IMAGE_FOOTER = { DISCLAIMER };
