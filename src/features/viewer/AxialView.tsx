/**
 * Hoomaan 3D Anatomy - Axial & Cross-Section Viewer
 *
 * Clean-room implementation of 2D cross-sectional inspection,
 * windowing filters, caliper measurements, and anatomical levels.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { useInterfaceLanguage } from "@/stores/interfaceLanguage";
import { useScanStore } from "@/stores/scanStore";
import { saveViewImage } from "@/lib/studyDb";
import {
  sectionFileName,
  sectionImage,
  SECTION_VIEW,
  SECTION_WINDOW,
  SLICE_PIXELS,
  wheelPixels,
} from "./axialSlice";
import { AXIAL_PROBE } from "./AxialProbe";
import { CURRENT_CROSSING } from "./scanCrossing";
import { CURRENT_LEVEL } from "./vertebralLevel";
import { SECTION_STEP_CM } from "./scanBand";
import { AxialMeasureOverlay } from "./AxialMeasureOverlay";
import { AxialSidebar } from "./AxialSidebar";
import { WINDOW_FILTERS, type WindowPreset } from "./axialViewTypes";
import { useSliceCanvasStream } from "./useSliceCanvasStream";
import { useCaliperTool } from "./useCaliperTool";

export function AxialView() {
  const isPersian = useInterfaceLanguage((s) => s.language === "fa");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameContainerRef = useRef<HTMLDivElement>(null);

  const [windowPreset, setWindowPreset] = useState<WindowPreset>("natural");
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [computedFrameWidth, setComputedFrameWidth] = useState(0);
  const [isSavingImage, setIsSavingImage] = useState(false);
  const [saveStatusMessage, setSaveStatusMessage] = useState<string | null>(null);

  // Scan store subscriptions
  const isScanEnabled = useScanStore((s) => s.enabled);
  const isAxialActive = useScanStore((s) => s.axial);
  const sectionCount = useScanStore((s) => s.sections);
  const isCutMode = useScanStore((s) => s.cut);
  const isTorchActive = useScanStore((s) => s.torch);
  const currentPlane = useScanStore((s) => s.plane);

  // Hook integrations
  const {
    activeWindow,
    getCurrentWindow,
    performZoom,
    applyWindowChange,
    updateTorchPosition,
    processWheelInput,
    panCanvas,
    lastDragPos,
    isSteppedNavigation,
  } = useSliceCanvasStream(canvasRef);

  const {
    isMeasuringMode,
    toggleMeasuringMode,
    activeMeasures,
    activeDraftMeasure,
    currentDraftRef,
    startMeasure,
    updateDraftMeasure,
    finishDraftMeasure,
    cancelDraftMeasure,
    removeMeasure,
    clearCurrentLevelMeasures,
  } = useCaliperTool();

  // Resize observer for frame width
  useEffect(() => {
    const el = frameContainerRef.current;
    if (!el) return;
    const updateSize = () => setComputedFrameWidth(el.clientWidth);
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(el);
    return () => observer.disconnect();
  }, [isFullScreen]);

  // Derived labels and descriptors
  const isFrontalView = currentPlane === "front";
  const viewTypeName = isFrontalView ? "Frontal" : "Axial";
  const currentLevelLabel = CURRENT_LEVEL.value;
  const spatialDomainName = isFrontalView ? "depth" : "spine";
  const physicalSpanCm = Math.round(AXIAL_PROBE.base.half * 200);

  const descriptionSummary = isFrontalView
    ? "Frontal cross-section (coronal plane) slicing the body from anterior to posterior."
    : "Axial cross-section (transverse plane) slicing the body from superior to inferior.";

  // Image export
  const handleSaveSliceImage = useCallback(async () => {
    setIsSavingImage(true);
    setSaveStatusMessage(null);
    try {
      const dataUri = await sectionImage(
        getCurrentWindow(),
        activeMeasures,
        AXIAL_PROBE.basis,
      );
      if (!dataUri) throw new Error("Canvas data could not be serialized");
      const defaultName = sectionFileName(
        AXIAL_PROBE.plane,
        currentLevelLabel,
        physicalSpanCm,
        isCutMode,
      );
      await saveViewImage(dataUri, defaultName);
      setSaveStatusMessage(isPersian ? "تصویر برش ذخیره شد" : "Slice image saved");
    } catch {
      setSaveStatusMessage(isPersian ? "خطا در ذخیره تصویر" : "Failed to save image");
    } finally {
      setIsSavingImage(false);
    }
  }, [currentLevelLabel, isCutMode, isPersian, physicalSpanCm, getCurrentWindow, activeMeasures]);

  // Visibility guard
  if (!isScanEnabled || !isAxialActive || sectionCount <= 0) {
    return null;
  }

  // Fullscreen Inspection Stage
  if (isFullScreen) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-md"
        role="dialog"
        aria-modal="true"
        aria-label="Full-size cross-section view"
      >
        <div
          ref={frameContainerRef}
          className="relative overflow-hidden rounded-lg border border-slate-800 bg-black shadow-2xl"
          onWheel={(e) => {
            const dy = wheelPixels(e.deltaY, e.deltaMode);
            if (e.ctrlKey || e.metaKey) {
              const rect = e.currentTarget.getBoundingClientRect();
              const u = (e.clientX - rect.left - rect.width / 2) / (rect.width / 2);
              const v = (e.clientY - rect.top - rect.height / 2) / (rect.height / 2);
              performZoom(dy > 0 ? 0.9 : 1.1, u, v);
            } else {
              processWheelInput(dy);
            }
          }}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const offsetX = e.clientX - rect.left;
            const offsetY = e.clientY - rect.top;

            if (isMeasuringMode) {
              startMeasure(getCurrentWindow(), offsetX, offsetY, rect.width);
              e.currentTarget.setPointerCapture(e.pointerId);
              return;
            }
            if (!activeWindow) return;
            lastDragPos.current = { x: e.clientX, y: e.clientY };
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const offsetX = e.clientX - rect.left;
            const offsetY = e.clientY - rect.top;

            if (currentDraftRef.current) {
              updateDraftMeasure(getCurrentWindow(), offsetX, offsetY, rect.width);
              return;
            }

            const prev = lastDragPos.current;
            if (prev) {
              lastDragPos.current = { x: e.clientX, y: e.clientY };
              panCanvas(e.clientX - prev.x, e.clientY - prev.y, computedFrameWidth);
              return;
            }

            updateTorchPosition(rect, e.clientX, e.clientY);
          }}
          onPointerUp={() => {
            lastDragPos.current = null;
            finishDraftMeasure();
          }}
          onPointerCancel={() => {
            lastDragPos.current = null;
            cancelDraftMeasure();
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
            onRemoveMeasure={removeMeasure}
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
          onToggleMeasuring={toggleMeasuringMode}
          activeDraftMeasure={activeDraftMeasure}
          activeMeasures={activeMeasures}
          onClearLevelMeasures={clearCurrentLevelMeasures}
          isSavingImage={isSavingImage}
          saveStatusMessage={saveStatusMessage}
          onClearSaveStatus={() => setSaveStatusMessage(null)}
          onSaveSlice={handleSaveSliceImage}
          descriptionSummary={descriptionSummary}
        />
      </div>
    );
  }

  // Compact Dock Widget
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
