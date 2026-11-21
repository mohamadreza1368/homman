import { AdaptiveDpr, AdaptiveEvents } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";

import { loadManifest } from "@/lib/manifest";
import type { AnatomyManifest } from "@/lib/schemas";
import { organLabel, organSubtitle, useSceneStore } from "@/stores/sceneStore";
import { useStudyViewsStore } from "@/stores/studyViewsStore";
import { usePhysiologyStore } from "@/stores/physiologyStore";
import { readStoredView, sanitiseViewPreferences } from "@/stores/viewPreferences";

import { AnatomyScene } from "./AnatomyScene";
import { backgroundTheme } from "./background";
import { ColourLegend } from "./ColourLegend";
import { consumeClickReport, consumeDepthStackReport } from "./depthStack";
import {
  beginPress,
  DRAG_SLOP,
  pressTravelled,
  trackPress as beginTrack,
} from "./dragGuard";
import { DepthProbe } from "./DepthProbe";
import { ExplodeBar } from "./ExplodeBar";
import { IlluminationBar } from "./IlluminationBar";
import { IsolationBar } from "./IsolationBar";
import { FULL_CANVAS, LabelOverlay } from "./LabelOverlay";
import { RenderProbe, RenderStatsPanel } from "./RenderStats";
import { AxialView } from "./AxialView";
import { ScanControls } from "./ScanControls";
import { HeartControls } from "./HeartControls";
import { BreathControls } from "./BreathControls";
import { ScanReadout } from "./ScanReadout";
import { PointerRouting, StudyViews } from "./StudyViews";
import { ClosedViews, StudyViewsFrame } from "./StudyViewsFrame";
import { domRect, mainRect } from "./studyLayout";
import { StudyViewsToggle } from "./StudyViewsToggle";
import { LassoSelect } from "./LassoSelect";
import { PathwayBar } from "./PathwayBar";
import { SelectionBar } from "./SelectionBar";
import { StructureMenu, type MenuTarget } from "./StructureMenu";
import { useCaseMarks } from "./useCaseMarks";
import { StudioActionDock } from "./StudioActionDock";
import { OVERLAY_CHIP, OVERLAY_CHIP_ACTION, OVERLAY_GROUND } from "./overlayChrome";

/**
 * HOOMAAN Top-level Anatomy 3D Viewer Container.
 * Manages manifest retrieval, WebGL Canvas rendering context, multi-angle split views,
 * hover labels, context menus, and UI overlay toolbars.
 */

function HoverLabel() {
  const hoveredOrganId = useSceneStore((s) => s.hoveredOrganId);
  const organs = useSceneStore((s) => s.organs);
  const organ = hoveredOrganId ? organs[hoveredOrganId] : undefined;
  if (!organ) return null;

  return (
    <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 z-20 max-w-[70%] rounded-xl border border-teal-500/30 bg-slate-900/90 px-4 py-2 text-center shadow-2xl backdrop-blur-xl ring-1 ring-white/10">
      {organ.path.length > 0 && (
        <div className="truncate text-[10px] text-teal-300/80">
          {organ.path.join(" › ")}
        </div>
      )}
      <div className="text-sm font-semibold italic text-slate-100">{organLabel(organ)}</div>
      <div className="text-xs text-slate-300">{organSubtitle(organ)}</div>
    </div>
  );
}

function ViewerFallback({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center">
      <p className="max-w-md text-center text-sm text-slate-400">{message}</p>
    </div>
  );
}

const DEFAULT_INITIAL_MODEL = "male";

export function AnatomyViewer({ paused = false }: { paused?: boolean } = {}) {
  const setManifest = useSceneStore((s) => s.setManifest);
  const genderModel = useSceneStore((s) => s.genderModel);
  const background = useSceneStore((s) => s.background);
  const restoreView = useSceneStore((s) => s.restoreView);

  const isolatedOrganIds = useSceneStore((s) => s.isolatedOrganIds);
  const studyViewsWanted = useStudyViewsStore((s) => s.wanted);
  const activeViews = useStudyViewsStore((s) => s.active);
  const isMultiViewSplit = studyViewsWanted && (isolatedOrganIds?.length ?? 0) > 0;
  const physiologyActive = usePhysiologyStore((s) => s.active);

  const [manifest, setLocalManifest] = useState<AnatomyManifest | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeMenu, setActiveMenu] = useState<MenuTarget | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const pointerStartLoc = useRef<{ x: number; y: number } | null>(null);
  const clearDepthStack = useSceneStore((s) => s.clearDepthStack);
  const selectFromViewport = useSceneStore((s) => s.selectFromViewport);

  useCaseMarks();

  const handleOpenContextMenu = useCallback((organId: string, x: number, y: number) => {
    const origin = pointerStartLoc.current;
    if (origin && Math.hypot(x - origin.x, y - origin.y) > DRAG_SLOP) return;

    const rect = containerRef.current?.getBoundingClientRect();
    setActiveMenu({ organId, x: x - (rect?.left ?? 0), y: y - (rect?.top ?? 0) });
  }, []);

  useEffect(() => {
    const abortCtrl = new AbortController();
    setLocalManifest(null);
    setLoadError(null);

    loadManifest(genderModel, abortCtrl.signal).then(
      (data) => {
        setLocalManifest(data);
        setManifest(data);

        if (genderModel !== DEFAULT_INITIAL_MODEL) return;
        restoreView(
          sanitiseViewPreferences(
            readStoredView(),
            data.systems.map((s) => s.system),
          ),
        );
      },
      (err: unknown) => {
        if (abortCtrl.signal.aborted) return;
        setLoadError(err instanceof Error ? err.message : String(err));
      },
    );

    return () => abortCtrl.abort();
  }, [genderModel, setManifest, restoreView]);

  if (loadError) return <ViewerFallback message={loadError} />;
  if (!manifest) return <ViewerFallback message="Loading anatomy…" />;

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full"
      style={paused ? { visibility: "hidden" } : undefined}
      onPointerDown={(e) => {
        if (e.button === 2) pointerStartLoc.current = { x: e.clientX, y: e.clientY };
        beginPress(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        beginTrack(e.clientX, e.clientY);
        if (!consumeDepthStackReport()) clearDepthStack();
      }}
      onClick={(e) => {
        if (!(e.target instanceof HTMLCanvasElement)) return;
        if (pressTravelled()) return;
        if (consumeClickReport()) return;
        const topHit = useSceneStore.getState().depthStack[0];
        if (topHit) selectFromViewport(topHit, e.ctrlKey || e.metaKey);
      }}
      onPointerLeave={clearDepthStack}
      onContextMenu={(e) => e.preventDefault()}
    >
      <Canvas
        camera={{ position: [0, 0.2, 2.4], fov: 45, near: 0.05, far: 100 }}
        dpr={[1, 2]}
        gl={{ antialias: true }}
        performance={{ min: 0.5 }}
        frameloop={paused ? "never" : "always"}
      >
        <color attach="background" args={[backgroundTheme(background).canvas]} />
        <AdaptiveDpr pixelated={false} />
        <AdaptiveEvents />
        <Suspense fallback={null}>
          <AnatomyScene manifest={manifest} onContextMenu={handleOpenContextMenu} />
        </Suspense>
        <RenderProbe />
        <PointerRouting splitting={isMultiViewSplit} />
        {isMultiViewSplit && <StudyViews />}
      </Canvas>

      {!isMultiViewSplit && <LassoSelect container={containerRef} />}
      <LabelOverlay
        panel={isMultiViewSplit ? domRect(mainRect(activeViews)) : FULL_CANVAS}
      />
      {isMultiViewSplit && <StudyViewsFrame />}

      <div className="pointer-events-none absolute top-12 bottom-3 left-3 z-20 flex flex-col items-start justify-end gap-1.5 max-h-[calc(100%-3.5rem)] overflow-y-auto">
        <RenderStatsPanel />
        <ScanReadout />
        <ScanControls />
        {physiologyActive && (
          <>
            <HeartControls />
            <BreathControls />
          </>
        )}
        <AxialView />
        {isMultiViewSplit && <ClosedViews />}
        <StudyViewsToggle />
        <ControlsHint />
      </div>

      <DepthProbe />
      <HoverLabel />
      <ColourLegend />
      <IsolationBar />
      <PathwayBar />
      <SelectionBar />
      <IlluminationBar />
      <StudioActionDock />
      <ExplodeBar />
      <StructureMenu target={activeMenu} onClose={() => setActiveMenu(null)} />
    </div>
  );
}

const CONTROLS_HINT_TIMEOUT_MS = 10_000;

function ControlsHint() {
  const [isVisible, setIsVisible] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  const triggerOpen = useCallback(() => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    setIsVisible(true);
    timerRef.current = window.setTimeout(() => setIsVisible(false), CONTROLS_HINT_TIMEOUT_MS);
  }, []);

  return (
    <div className="pointer-events-none flex flex-col items-start gap-1">
      <div
        hidden={!isVisible}
        className={`rounded ${OVERLAY_GROUND} px-2 py-1 text-[10px] leading-tight`}
      >
        <p>Drag to rotate · Scroll to zoom where you point · Lost? Use Fit, bottom right</p>
        <p>Right-drag to pan · Double-click an organ to open it with its parts</p>
        <p>Shift+double-click to build a study set · Esc to exit</p>
        <p>Ctrl+click to select several · Ctrl+drag to draw round a region</p>
        <p>I isolate · H hide · U bring hidden back · C clear · X explode</p>
        <p>F fit · A P L R S viewpoints · + − zoom</p>
        <p>Right-click a structure to isolate the organ it belongs to</p>
      </div>
      <button
        type="button"
        onPointerEnter={triggerOpen}
        onFocus={triggerOpen}
        onClick={triggerOpen}
        aria-expanded={isVisible}
        title="How to move around the body"
        className={`pointer-events-auto select-none ${OVERLAY_CHIP} ${OVERLAY_CHIP_ACTION}`}
      >
        Controls
      </button>
    </div>
  );
}
