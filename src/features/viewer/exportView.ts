import { APP_VERSION_LABEL } from "@/lib/appVersion";
import { saveViewImage } from "@/lib/studyDb";
import type { AnatomyManifest } from "@/lib/schemas";
import { useSceneStore } from "@/stores/sceneStore";
import { backgroundTheme, type BackgroundTheme } from "./background";
import { layoutLabels, type LabelAnchor } from "./labelLayout";
import { labelTargets } from "./LabelOverlay";
import { getViewerHandle, projectToScreen } from "./viewerBridge";
import { captureView } from "./captureView";

const BANNER_FOOTER_PX = 46;

export const DISCLAIMER = `HOOMAAN ${APP_VERSION_LABEL} — educational use only. Not a medical device.`;

function formatSpdxTag(licenseTag: string): string {
  return licenseTag
    .replace(/^CC-/, "CC ")
    .replace(/-(\d)/, " $1")
    .replace(/-/g, "-");
}

export function attributionLine(
  manifestData: Pick<AnatomyManifest, "credit" | "attribution" | "license"> | null
): string {
  if (!manifestData) return "";
  const { credit, attribution, license } = manifestData;
  if (!credit) {
    return `Anatomy: ${attribution}`;
  }
  return `Anatomy: ${credit} — ${formatSpdxTag(license)}`;
}

export async function exportViewImage(): Promise<string | null> {
  const viewerRef = getViewerHandle();
  if (!viewerRef) {
    throw new Error("The viewer is not ready yet.");
  }

  const { gl, centres } = viewerRef;
  const domCanvas = gl.domElement;
  const renderWidth = domCanvas.width;
  const renderHeight = domCanvas.height;

  const targetCanvas = document.createElement("canvas");
  targetCanvas.width = renderWidth;
  targetCanvas.height = renderHeight + BANNER_FOOTER_PX;

  const ctx2d = targetCanvas.getContext("2d");
  if (!ctx2d) {
    throw new Error("Could not prepare the image.");
  }

  const activeTheme = backgroundTheme(useSceneStore.getState().background);
  ctx2d.fillStyle = activeTheme.canvas;
  ctx2d.fillRect(0, 0, targetCanvas.width, targetCanvas.height);

  captureView(viewerRef, (cam) => {
    ctx2d.drawImage(domCanvas, 0, 0);
    renderAnatomicalLabels(ctx2d, renderWidth, renderHeight, centres, cam, activeTheme);
  });

  renderFooterBanner(
    ctx2d,
    renderWidth,
    renderHeight,
    activeTheme,
    attributionLine(useSceneStore.getState().manifest)
  );

  const encodedBlob = await new Promise<Blob | null>((resolve) =>
    targetCanvas.toBlob(resolve, "image/png")
  );
  if (!encodedBlob) {
    throw new Error("Could not encode the image.");
  }

  const byteBuffer = new Uint8Array(await encodedBlob.arrayBuffer());
  return saveViewImage(toBase64String(byteBuffer));
}

function renderAnatomicalLabels(
  ctx: CanvasRenderingContext2D,
  viewW: number,
  viewH: number,
  centres: Map<string, { x: number; y: number; z: number }>,
  cam: Parameters<typeof projectToScreen>[1],
  theme: BackgroundTheme
): void {
  const sceneState = useSceneStore.getState();
  const targetStructures = labelTargets(
    sceneState.organs,
    sceneState.selectedOrganIds,
    sceneState.isolatedOrganIds,
    sceneState.labelsVisible
  );
  if (targetStructures.length === 0) return;

  const displayScale = Math.max(viewW / 1000, 1);
  const pxFontSize = Math.round(13 * displayScale);
  const pxLineHeight = Math.round(22 * displayScale);
  const pxMargin = Math.round(14 * displayScale);

  const anchorCoordinates: LabelAnchor[] = [];
  for (let i = 0; i < targetStructures.length; i++) {
    const item = targetStructures[i]!;
    const spatialCoord = centres.get(item.id);
    if (!spatialCoord) {
      anchorCoordinates.push({ ...item, x: NaN, y: NaN });
      continue;
    }
    const screenCoord = projectToScreen(spatialCoord as never, cam, viewW, viewH);
    anchorCoordinates.push({
      ...item,
      x: screenCoord.x,
      y: screenCoord.y,
      behind: screenCoord.behind,
    });
  }

  ctx.font = `italic ${pxFontSize}px system-ui, "Segoe UI", sans-serif`;

  const positionedItems = layoutLabels(anchorCoordinates, {
    width: viewW,
    height: viewH,
    lineHeight: pxLineHeight,
    margin: pxMargin,
    padding: Math.round(18 * displayScale),
    gap: Math.round(70 * displayScale),
    measure: (txt) => ctx.measureText(txt).width + Math.round(18 * displayScale),
  });

  ctx.textBaseline = "middle";

  for (let idx = 0; idx < positionedItems.length; idx++) {
    const anchor = positionedItems[idx]!;
    ctx.strokeStyle = theme.leader;
    ctx.lineWidth = Math.max(displayScale, 1);
    ctx.beginPath();
    ctx.moveTo(anchor.x, anchor.y);
    ctx.lineTo(anchor.labelX, anchor.labelY);
    ctx.stroke();

    ctx.textAlign = anchor.side === "left" ? "right" : "left";
    const textMetricWidth = ctx.measureText(anchor.text).width;
    const chipOriginX =
      anchor.side === "left"
        ? anchor.labelX - textMetricWidth - 4 * displayScale
        : anchor.labelX - 4 * displayScale;

    ctx.fillStyle = theme.chip;
    ctx.fillRect(
      chipOriginX,
      anchor.labelY - pxFontSize * 0.85,
      textMetricWidth + 8 * displayScale,
      pxFontSize * 1.7
    );
    ctx.fillStyle = theme.ink;
    ctx.fillText(anchor.text, anchor.labelX, anchor.labelY);
  }
}

function renderFooterBanner(
  ctx: CanvasRenderingContext2D,
  viewW: number,
  viewH: number,
  theme: BackgroundTheme,
  citation: string
): void {
  const displayScale = Math.max(viewW / 1000, 1);
  ctx.fillStyle = theme.canvas;
  ctx.fillRect(0, viewH, viewW, BANNER_FOOTER_PX);

  ctx.strokeStyle = "rgba(148, 163, 184, 0.25)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, viewH + 0.5);
  ctx.lineTo(viewW, viewH + 0.5);
  ctx.stroke();

  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.font = `${Math.round(11 * displayScale)}px system-ui, "Segoe UI", sans-serif`;
  ctx.fillStyle = theme.footerInk;
  ctx.fillText(DISCLAIMER, 12 * displayScale, viewH + BANNER_FOOTER_PX * 0.36);
  ctx.fillStyle = theme.footerSubtle;
  ctx.fillText(citation, 12 * displayScale, viewH + BANNER_FOOTER_PX * 0.72);
}

function toBase64String(dataBuffer: Uint8Array): string {
  const BLOCK_SIZE = 0x8000;
  const stringChunks: string[] = [];
  for (let cursor = 0; cursor < dataBuffer.length; cursor += BLOCK_SIZE) {
    const slice = dataBuffer.subarray(cursor, cursor + BLOCK_SIZE);
    stringChunks.push(String.fromCharCode(...slice));
  }
  return btoa(stringChunks.join(""));
}

export const encodeImageBytes = toBase64String;
export const IMAGE_FOOTER = { DISCLAIMER };
