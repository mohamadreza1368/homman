import { useEffect, useRef, useState } from "react";

import { useInterfaceLanguage } from "@/stores/interfaceLanguage";
import { organLabel, useSceneStore } from "@/stores/sceneStore";
import { useScanStore } from "@/stores/scanStore";

import {
  AXIAL_CANVAS,
  formatDistance,
  measureCm,
  onLevel,
  panWindow,
  pointInSection,
  pointOnScreen,
  sectionFileName,
  sectionImage,
  RETAKE_INTERVAL_MS,
  restoreSlice,
  SECTION_VIEW,
  SECTION_WINDOW,
  slicePlane,
  SLICE_PIXELS,
  TORCH,
  torchDirection,
  wantSection,
  wheelPixels,
  wheelSteps,
  WHEEL_SETTLE_MS,
  zoomWindow,
} from "./axialSlice";
import type { SectionMeasure, SliceWindow } from "./axialSlice";
import { SECTION_STEP_CM, stepFraction } from "./scanBand";
import { AXIAL_PROBE } from "./AxialProbe";
import { saveViewImage } from "@/lib/studyDb";
import { CURRENT_CROSSING } from "./scanCrossing";
import { CURRENT_LEVEL } from "./vertebralLevel";
import { tissueColour } from "./palette";

/**
 * HOOMAAN Axial & Cross-Section Viewer Component.
 * Displays real-time offscreen cross-sectional canvas representations with
 * interactive magnification windowing, caliper distance measurement tools,
 * radiological density presets, and slice capture capabilities.
 */

function SliceTable({ compact }: { compact: boolean }) {
  const organMap = useSceneStore((s) => s.organs);
  const { organIds, total } = CURRENT_CROSSING.value;
  if (organIds.length === 0) return null;
  const remainingCount = Math.max(0, total - organIds.length);

  return (
    <ul className={compact ? "mt-1 space-y-0.5" : "space-y-1"}>
      {organIds.map((organId) => {
        const organ = organMap[organId];
        return (
          <li key={organId} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-block h-2 w-2 shrink-0 rounded-sm"
              style={{
                backgroundColor: organ
                  ? `#${tissueColour(organ).getHexString()}`
                  : "#475569",
              }}
            />
            <span
              className={`truncate italic ${
                compact ? "text-[9px] text-cyan-100/80" : "text-[11px] text-cyan-100"
              }`}
            >
              {organ ? organLabel(organ) : organId}
            </span>
          </li>
        );
      })}
      {remainingCount > 0 && (
        <li className={compact ? "text-[9px] text-slate-500" : "text-[11px] text-slate-500"}>
          and {remainingCount} more
        </li>
      )}
    </ul>
  );
}

type WindowPreset = "natural" | "soft" | "bone" | "lung" | "invert";

const WINDOW_FILTERS: Record<WindowPreset, string> = {
  natural: "none",
  soft: "grayscale(1) contrast(140%) brightness(95%)",
  bone: "grayscale(1) contrast(220%) brightness(130%)",
  lung: "grayscale(1) contrast(120%) brightness(150%)",
  invert: "invert(1) grayscale(1) contrast(130%)",
};

export function AxialView() {
  const isPersian = useInterfaceLanguage((s) => s.language === "fa");
  const [windowPreset, setWindowPreset] = useState<WindowPreset>("natural");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isScanEnabled = useScanStore((s) => s.enabled);
  const isAxialActive = useScanStore((s) => s.axial);
  const sectionCount = useScanStore((s) => s.sections);
  const isScannerHeld = useScanStore((s) => s.held);
  const isCutMode = useScanStore((s) => s.cut);
  const isTorchActive = useScanStore((s) => s.torch);

  useScanStore((s) => s.detail);
  const currentPlane = useScanStore((s) => s.plane);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [activeWindow, setActiveWindow] = useState<SliceWindow | null>(null);
  const lastDragPos = useRef<{ x: number; y: number } | null>(null);

  const [isMeasuringMode, setIsMeasuringMode] = useState(false);
  const [recordedMeasures, setRecordedMeasures] = useState<SectionMeasure[]>([]);
  const [activeDraftMeasure, setActiveDraftMeasure] = useState<SectionMeasure | null>(null);
  const currentDraftRef = useRef<SectionMeasure | null>(null);

  const [isSavingImage, setIsSavingImage] = useState(false);
  const [saveStatusMessage, setSaveStatusMessage] = useState<string | null>(null);

  const frameContainerRef = useRef<HTMLDivElement>(null);
  const [computedFrameWidth, setComputedFrameWidth] = useState(0);
  const [isSteppedNavigation, setIsSteppedNavigation] = useState(false);

  const carriedWheelDelta = useRef(0);
  const settleTimerRef = useRef<number | null>(null);
  const lastRetakeTimestamp = useRef(0);
  const trailingRetakeTimer = useRef<number | null>(null);

  const scheduleSliceRetake = () => {
    const now = performance.now();
    const elapsed = now - lastRetakeTimestamp.current;
    if (trailingRetakeTimer.current !== null) window.clearTimeout(trailingRetakeTimer.current);

    if (elapsed >= RETAKE_INTERVAL_MS) {
      lastRetakeTimestamp.current = now;
      wantSection();
      return;
    }

    trailingRetakeTimer.current = window.setTimeout(() => {
      trailingRetakeTimer.current = null;
      lastRetakeTimestamp.current = performance.now();
      wantSection();
    }, RETAKE_INTERVAL_MS - elapsed);
  };

  const updateTorchPosition = (rect: DOMRect, clientX: number, clientY: number) => {
    if (!isTorchActive || rect.width <= 0 || rect.height <= 0) return;
    const u = (clientX - rect.left - rect.width / 2) / (rect.width / 2);
    const v = (clientY - rect.top - rect.height / 2) / (rect.height / 2);
    TORCH.value = torchDirection(u, v, AXIAL_PROBE.basis, slicePlane(AXIAL_PROBE.plane));
    scheduleSliceRetake();
  };

  const applyWindowChange = (nextWindow: SliceWindow | null, immediate = false) => {
    SECTION_VIEW.value = nextWindow;
    setActiveWindow(nextWindow);

    if (immediate) {
      if (trailingRetakeTimer.current !== null) {
        window.clearTimeout(trailingRetakeTimer.current);
      }
      trailingRetakeTimer.current = null;
      lastRetakeTimestamp.current = performance.now();
      wantSection();
      return;
    }
    scheduleSliceRetake();
  };

  const getCurrentWindow = (): SliceWindow => activeWindow ?? AXIAL_PROBE.base;

  const performZoom = (factor: number, u = 0, v = 0) => {
    if (AXIAL_PROBE.base.half <= 0) return;
    applyWindowChange(zoomWindow(getCurrentWindow(), AXIAL_PROBE.base, factor, AXIAL_PROBE.basis, u, v));
  };

  useEffect(() => {
    if (isTorchActive || TORCH.value === null) return;
    TORCH.value = null;
    wantSection();
  }, [isTorchActive]);

  const processWheelInput = (deltaY: number) => {
    const fractionPerStep = stepFraction();
    if (fractionPerStep === 0) return;

    const { steps, carry } = wheelSteps(carriedWheelDelta.current, deltaY);
    carriedWheelDelta.current = carry;
    if (steps === 0) return;

    useScanStore.getState().step(-steps * fractionPerStep);
    setIsSteppedNavigation(true);

    if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current);
    settleTimerRef.current = window.setTimeout(() => {
      settleTimerRef.current = null;
      wantSection();
    }, WHEEL_SETTLE_MS);
  };

  useEffect(() => {
    return () => {
      if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current);
      if (trailingRetakeTimer.current !== null) window.clearTimeout(trailingRetakeTimer.current);
    };
  }, []);

  useEffect(() => {
    if (isScannerHeld) setIsSteppedNavigation(false);
  }, [isScannerHeld]);

  useEffect(() => {
    setActiveWindow(null);
    setIsSteppedNavigation(false);
  }, [currentPlane]);

  useEffect(() => {
    const el = frameContainerRef.current;
    if (!el) return;
    const updateSize = () => setComputedFrameWidth(el.clientWidth);
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(el);
    return () => observer.disconnect();
  }, [isFullScreen]);

  useEffect(() => {
    AXIAL_CANVAS.value = canvasRef.current;
    if (canvasRef.current) restoreSlice(canvasRef.current);
    return () => {
      AXIAL_CANVAS.value = null;
    };
  }, [isScanEnabled, isAxialActive, isFullScreen, sectionCount]);

  useEffect(() => {
    if (!isFullScreen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const currentLevelMeasures = recordedMeasures.filter((m) =>
        onLevel(m, AXIAL_PROBE.at, AXIAL_PROBE.plane),
      );
      const lastLine = currentLevelMeasures[currentLevelMeasures.length - 1];
      if (lastLine) {
        setRecordedMeasures((prev) => prev.filter((m) => m !== lastLine));
        return;
      }
      setIsFullScreen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullScreen, recordedMeasures]);

  useEffect(() => {
    if (!isScanEnabled || !isAxialActive) setIsFullScreen(false);
  }, [isScanEnabled, isAxialActive]);

  useEffect(() => {
    setRecordedMeasures([]);
    setActiveDraftMeasure(null);
    currentDraftRef.current = null;
    if (SECTION_VIEW.value === null) return;
    SECTION_VIEW.value = null;
    setActiveWindow(null);
    wantSection();
  }, [isFullScreen]);

  if (!isScanEnabled || !isAxialActive) return null;

  const physicalSpanCm = AXIAL_PROBE.frameCm;
  const activeMeasures = recordedMeasures.filter((m) =>
    onLevel(m, AXIAL_PROBE.at, AXIAL_PROBE.plane),
  );
  const currentLevelLabel = CURRENT_LEVEL.value;
  const isFrontalView = AXIAL_PROBE.plane === "front";
  const viewTypeName = isFrontalView ? "Front" : "Axial";
  const spatialDomainName = isFrontalView ? "depth" : "level";

  const descriptionSummary =
    `${isFrontalView ? "Superior" : "Anterior"} at the top, the patient's left on the right${
      physicalSpanCm > 0 ? ` · ${physicalSpanCm.toFixed(0)} cm across` : ""
    }. ` +
    (isCutMode
      ? `The body opened at this plane: you are seeing the surfaces ${
          isFrontalView ? "behind" : "below"
        } the cut, so there is depth behind what is at this ${spatialDomainName}.`
      : `Only what lies at this ${spatialDomainName}, and the cut surfaces are open — an outline rather than a filled section.`) +
    (isFrontalView ? " Depth is measured from the most anterior point of the body." : "") +
    " Drawn solid whatever the viewport shows. Not a radiograph.";

  if (isFullScreen) {
    return (
      <div className="pointer-events-auto fixed inset-0 z-40 flex items-center justify-center gap-6 bg-slate-950/95 p-4">
        <div
          ref={frameContainerRef}
          className="relative shrink-0 overflow-hidden rounded bg-black"
          onWheel={(e) => {
            if (e.ctrlKey || e.metaKey) {
              const rect = e.currentTarget.getBoundingClientRect();
              performZoom(
                e.deltaY < 0 ? 1.15 : 1 / 1.15,
                (e.clientX - rect.left - rect.width / 2) / (rect.width / 2),
                (e.clientY - rect.top - rect.height / 2) / (rect.height / 2),
              );
              return;
            }
            processWheelInput(wheelPixels(e.deltaY, e.deltaMode));
          }}
          onPointerDown={(e) => {
            if (isMeasuringMode) {
              const rect = e.currentTarget.getBoundingClientRect();
              const pt = pointInSection(
                getCurrentWindow(),
                e.clientX - rect.left,
                e.clientY - rect.top,
                rect.width,
                AXIAL_PROBE.basis,
              );
              const newLine: SectionMeasure = {
                ah: pt.h,
                av: pt.v,
                bh: pt.h,
                bv: pt.v,
                at: AXIAL_PROBE.at,
                plane: AXIAL_PROBE.plane,
              };
              currentDraftRef.current = newLine;
              setActiveDraftMeasure(newLine);
              e.currentTarget.setPointerCapture(e.pointerId);
              return;
            }
            if (!activeWindow) return;
            lastDragPos.current = { x: e.clientX, y: e.clientY };
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (currentDraftRef.current) {
              const rect = e.currentTarget.getBoundingClientRect();
              const pt = pointInSection(
                getCurrentWindow(),
                e.clientX - rect.left,
                e.clientY - rect.top,
                rect.width,
                AXIAL_PROBE.basis,
              );
              const updatedLine: SectionMeasure = {
                ...currentDraftRef.current,
                bh: pt.h,
                bv: pt.v,
              };
              currentDraftRef.current = updatedLine;
              setActiveDraftMeasure(updatedLine);
              return;
            }

            const prev = lastDragPos.current;
            if (prev) {
              lastDragPos.current = { x: e.clientX, y: e.clientY };
              if (computedFrameWidth > 0) {
                applyWindowChange(
                  panWindow(
                    getCurrentWindow(),
                    AXIAL_PROBE.base,
                    e.clientX - prev.x,
                    e.clientY - prev.y,
                    computedFrameWidth,
                    AXIAL_PROBE.basis,
                  ),
                );
              }
              return;
            }

            updateTorchPosition(e.currentTarget.getBoundingClientRect(), e.clientX, e.clientY);
          }}
          onPointerUp={() => {
            lastDragPos.current = null;
            const finalized = currentDraftRef.current;
            if (!finalized) return;
            currentDraftRef.current = null;
            setActiveDraftMeasure(null);
            if (measureCm(finalized) > 0) {
              setRecordedMeasures((prev) => [...prev, finalized]);
            }
          }}
          onPointerCancel={() => {
            lastDragPos.current = null;
            currentDraftRef.current = null;
            setActiveDraftMeasure(null);
          }}
          style={{
            width: SECTION_WINDOW,
            height: SECTION_WINDOW,
            cursor: isMeasuringMode
              ? "crosshair"
              : lastDragPos.current
                ? "grabbing"
                : isTorchActive
                  ? "crosshair"
                  : activeWindow
                    ? "grab"
                    : "default",
          }}
        >
          <canvas
            ref={canvasRef}
            width={SLICE_PIXELS.value}
            height={SLICE_PIXELS.value}
            style={{ filter: WINDOW_FILTERS[windowPreset] }}
            className="absolute inset-0 h-full w-full"
            aria-label={
              isFrontalView
                ? "Frontal section at the depth of the scanner"
                : "Cross-section at the height of the scanner"
            }
          />

          {(activeMeasures.length > 0 || activeDraftMeasure) && computedFrameWidth > 0 && (
            <svg
              className="pointer-events-none absolute inset-0 h-full w-full"
              viewBox={`0 0 ${computedFrameWidth} ${computedFrameWidth}`}
              aria-hidden
            >
              {[...activeMeasures, ...(activeDraftMeasure ? [activeDraftMeasure] : [])].map(
                (line) => {
                  const pA = pointOnScreen(
                    getCurrentWindow(),
                    line.ah,
                    line.av,
                    computedFrameWidth,
                    AXIAL_PROBE.basis,
                  );
                  const pB = pointOnScreen(
                    getCurrentWindow(),
                    line.bh,
                    line.bv,
                    computedFrameWidth,
                    AXIAL_PROBE.basis,
                  );
                  const distCm = measureCm(line);
                  const isExisting = line !== activeDraftMeasure;

                  return (
                    <g key={`${line.plane}:${line.ah}:${line.av}:${line.bh}:${line.bv}:${line.at}`}>
                      <line
                        x1={pA.x}
                        y1={pA.y}
                        x2={pB.x}
                        y2={pB.y}
                        stroke="#22d3ee"
                        strokeWidth={1.5}
                      />
                      <circle cx={pA.x} cy={pA.y} r={3} fill="#22d3ee" />
                      <circle cx={pB.x} cy={pB.y} r={3} fill="#22d3ee" />
                      {distCm > 0 && (
                        <text
                          x={(pA.x + pB.x) / 2 + 8}
                          y={(pA.y + pB.y) / 2 - 8}
                          fill="#a5f3fc"
                          fontSize={13}
                          stroke="#020617"
                          strokeWidth={3}
                          paintOrder="stroke"
                          style={
                            isExisting ? { pointerEvents: "auto", cursor: "pointer" } : undefined
                          }
                          onPointerDown={
                            isExisting
                              ? (e) => {
                                  e.stopPropagation();
                                  setRecordedMeasures((prev) => prev.filter((item) => item !== line));
                                }
                              : undefined
                          }
                        >
                          {isExisting && <title>Remove this measurement</title>}
                          {formatDistance(distCm)}
                        </text>
                      )}
                    </g>
                  );
                },
              )}
            </svg>
          )}
        </div>

        <div className="flex w-72 flex-col gap-3 self-center">
          <p className="text-[10px] uppercase tracking-wider text-cyan-500/70">
            {viewTypeName}
            {currentLevelLabel ? ` · ${currentLevelLabel}` : ""} ·{" "}
            {isSteppedNavigation ? `${SECTION_STEP_CM} cm steps` : "where you let go"}
          </p>

          <div className="flex items-center gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => performZoom(1 / 1.4)}
              className="rounded border border-slate-700 px-2 py-0.5 text-slate-300 hover:border-cyan-700 hover:text-cyan-300"
            >
              −
            </button>
            <button
              type="button"
              title="Back to the whole section"
              onClick={() => {
                if (SECTION_VIEW.value === null) return;
                applyWindowChange(null, true);
              }}
              className="w-20 rounded border border-slate-700 px-2 py-0.5 tabular-nums text-slate-300 hover:border-cyan-700 hover:text-cyan-300"
            >
              {physicalSpanCm > 0
                ? `${physicalSpanCm.toFixed(physicalSpanCm < 10 ? 1 : 0)} cm`
                : "—"}
            </button>
            <button
              type="button"
              onClick={() => performZoom(1.4)}
              className="rounded border border-slate-700 px-2 py-0.5 text-slate-300 hover:border-cyan-700 hover:text-cyan-300"
            >
              +
            </button>
            <button
              type="button"
              onClick={() => setIsFullScreen(false)}
              className="ml-auto rounded border border-slate-700 px-3 py-0.5 text-slate-300 hover:border-cyan-700 hover:text-cyan-300"
            >
              Close · Esc
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => setIsMeasuringMode((v) => !v)}
              aria-pressed={isMeasuringMode}
              title="Drag across the section to measure it"
              className={`rounded border px-2 py-0.5 ${
                isMeasuringMode
                  ? "border-cyan-500 bg-cyan-500/15 text-cyan-200"
                  : "border-slate-700 text-slate-300 hover:border-cyan-700 hover:text-cyan-300"
              }`}
            >
              Measure
            </button>

            {(isMeasuringMode || activeMeasures.length > 0) && (
              <span className="tabular-nums text-cyan-200">
                {activeDraftMeasure
                  ? formatDistance(measureCm(activeDraftMeasure))
                  : activeMeasures.length > 0
                    ? `${activeMeasures.length} at this ${spatialDomainName}`
                    : "drag across it"}
              </span>
            )}

            {activeMeasures.length > 0 && (
              <button
                type="button"
                onClick={() =>
                  setRecordedMeasures((prev) =>
                    prev.filter((m) => !onLevel(m, AXIAL_PROBE.at, AXIAL_PROBE.plane)),
                  )
                }
                title={`Remove the measurements at this ${spatialDomainName}`}
                className="rounded border border-slate-700 px-2 py-0.5 text-slate-300 hover:border-cyan-700 hover:text-cyan-300"
              >
                Clear
              </button>
            )}

            <button
              type="button"
              disabled={isSavingImage}
              onClick={() => {
                setIsSavingImage(true);
                setSaveStatusMessage(null);
                sectionImage(getCurrentWindow(), activeMeasures, AXIAL_PROBE.basis)
                  .then((png) =>
                    png
                      ? saveViewImage(
                          png,
                          sectionFileName(
                            AXIAL_PROBE.plane,
                            currentLevelLabel,
                            physicalSpanCm,
                            isCutMode,
                          ),
                        )
                      : Promise.reject(new Error("There is no section to save yet.")),
                  )
                  .then((filePath) =>
                    setSaveStatusMessage(filePath ? `Saved to ${filePath}` : null),
                  )
                  .catch((err: unknown) =>
                    setSaveStatusMessage(err instanceof Error ? err.message : String(err)),
                  )
                  .finally(() => setIsSavingImage(false));
              }}
              title="Save this section as a PNG, with its measurements"
              className="ml-auto rounded border border-slate-700 px-2 py-0.5 text-slate-300 hover:border-cyan-700 hover:text-cyan-300 disabled:opacity-40"
            >
              {isSavingImage ? "Saving…" : "Save"}
            </button>
          </div>

          {saveStatusMessage && (
            <button
              type="button"
              onClick={() => setSaveStatusMessage(null)}
              title={saveStatusMessage}
              className="truncate text-left text-[10px] text-slate-500 hover:text-slate-300"
            >
              {saveStatusMessage}
            </button>
          )}

          {isMeasuringMode && (
            <p className="text-[11px] leading-snug text-slate-500">
              Drag again for another; click a number to remove it. Each stays on
              the {spatialDomainName} it was drawn on. Both ends lie in the plane, so this is the
              true distance between those two points —{" "}
              {isCutMode
                ? `but in Cut you are seeing surfaces ${
                    isFrontalView ? "behind" : "below"
                  } the plane, so the structures under the ends may not be at this ${spatialDomainName}. Slab is the mode to measure a ${spatialDomainName} in.`
                : "and in Slab everything shown is within four millimetres of it."}
            </p>
          )}

          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-cyan-500/80">
              {isPersian ? "پنجرهٔ کنتراست رادیولوژی (Windowing)" : "Radiological Window"}
            </p>
            <div className="flex flex-wrap gap-1">
              {(
                [
                  { id: "natural", labelEn: "Natural", labelFa: "طبیعی" },
                  { id: "soft", labelEn: "Soft Tissue", labelFa: "بافت نرم" },
                  { id: "bone", labelEn: "Bone", labelFa: "استخوان" },
                  { id: "lung", labelEn: "Lung", labelFa: "ریه" },
                  { id: "invert", labelEn: "Invert X-ray", labelFa: "نگاتیو" },
                ] as const
              ).map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setWindowPreset(preset.id)}
                  className={`rounded px-2 py-0.5 text-[10px] font-medium transition ${
                    windowPreset === preset.id
                      ? "border border-cyan-400 bg-cyan-950/60 text-cyan-200"
                      : "border border-slate-700 bg-slate-900/60 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {isPersian ? preset.labelFa : preset.labelEn}
                </button>
              ))}
            </div>
          </div>

          <SliceTable compact={false} />

          <p className="text-[11px] leading-snug text-slate-500">
            {descriptionSummary} The wheel steps {SECTION_STEP_CM} cm through the body;
            Ctrl and the wheel, or −/+, magnify. Magnifying re-renders the
            section at the narrower width rather than enlarging what is there,
            so it adds detail instead of pixels. Drag to move; the button gives
            the whole section back.
            {isTorchActive
              ? ` The pointer is the light: the middle is ${
                  isFrontalView ? "straight on" : "overhead"
                }, and the edges rake it flat across the section.`
              : ""}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="pointer-events-none select-none rounded border border-cyan-900/60 bg-slate-950/85 p-1.5 shadow-lg">
      <p className="mb-1 text-[9px] uppercase tracking-wider text-cyan-500/70">
        {viewTypeName}
        {currentLevelLabel ? ` · ${currentLevelLabel}` : ""} ·{" "}
        {isSteppedNavigation ? `${SECTION_STEP_CM} cm steps` : "where you let go"}
      </p>
      <button
        type="button"
        onClick={() => setIsFullScreen(true)}
        onWheel={(e) => processWheelInput(wheelPixels(e.deltaY, e.deltaMode))}
        title={`See it full size. The wheel steps ${SECTION_STEP_CM} cm through the body.`}
        className="pointer-events-auto block cursor-zoom-in rounded-sm"
      >
        <canvas
          ref={canvasRef}
          width={SLICE_PIXELS.value}
          height={SLICE_PIXELS.value}
          style={{ filter: WINDOW_FILTERS[windowPreset] }}
          className="block h-36 w-36 rounded-sm bg-black short:h-28 short:w-28"
          aria-label={`${
            isFrontalView
              ? "Frontal section at the depth of the scanner"
              : "Cross-section at the height of the scanner"
          }. Click to enlarge.`}
        />
      </button>
      <p className="mt-1 max-w-36 text-[9px] leading-snug text-slate-500 short:max-w-28">
        {physicalSpanCm > 0 ? `${physicalSpanCm.toFixed(0)} cm · ` : ""}
        {isCutMode ? "cut" : "slab"} · {CURRENT_CROSSING.value.total} structures
        <span className="block text-cyan-500/70">
          wheel to step · click to enlarge
        </span>
      </p>
    </div>
  );
}
