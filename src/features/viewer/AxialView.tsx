import { useEffect, useRef, useState } from "react";

import { useInterfaceLanguage } from "@/stores/interfaceLanguage";
import { useScanStore } from "@/stores/scanStore";

import {
  AXIAL_CANVAS,
  onLevel,
  panWindow,
  pointInSection,
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
import { AxialMeasureOverlay } from "./AxialMeasureOverlay";
import { AxialSidebar } from "./AxialSidebar";
import { WINDOW_FILTERS } from "./axialViewTypes";
import type { WindowPreset } from "./axialViewTypes";

/**
 * HOOMAAN Axial & Cross-Section Viewer.
 * Orchestrates real-time 2D cross-sectional slice rendering, magnification windowing,
 * dynamic caliper distance measurements, and slice export actions.
 */
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

  const handleSaveSliceImage = () => {
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
  };

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
            if (finalized.ah !== finalized.bh || finalized.av !== finalized.bv) {
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

          <AxialMeasureOverlay
            activeMeasures={activeMeasures}
            activeDraftMeasure={activeDraftMeasure}
            computedFrameWidth={computedFrameWidth}
            currentWindow={getCurrentWindow()}
            onRemoveMeasure={(target) =>
              setRecordedMeasures((prev) => prev.filter((m) => m !== target))
            }
          />
        </div>

        <AxialSidebar
          viewTypeName={viewTypeName}
          currentLevelLabel={currentLevelLabel}
          isSteppedNavigation={isSteppedNavigation}
          physicalSpanCm={physicalSpanCm}
          spatialDomainName={spatialDomainName}
          isCutMode={isCutMode}
          isFrontalView={isFrontalView}
          isTorchActive={isTorchActive}
          isPersian={isPersian}
          windowPreset={windowPreset}
          onSelectWindowPreset={setWindowPreset}
          onZoom={performZoom}
          onResetZoom={() => {
            if (SECTION_VIEW.value === null) return;
            applyWindowChange(null, true);
          }}
          onClose={() => setIsFullScreen(false)}
          isMeasuringMode={isMeasuringMode}
          onToggleMeasuring={() => setIsMeasuringMode((v) => !v)}
          activeDraftMeasure={activeDraftMeasure}
          activeMeasures={activeMeasures}
          onClearLevelMeasures={() =>
            setRecordedMeasures((prev) =>
              prev.filter((m) => !onLevel(m, AXIAL_PROBE.at, AXIAL_PROBE.plane)),
            )
          }
          isSavingImage={isSavingImage}
          saveStatusMessage={saveStatusMessage}
          onClearSaveStatus={() => setSaveStatusMessage(null)}
          onSaveSlice={handleSaveSliceImage}
          descriptionSummary={descriptionSummary}
        />
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
