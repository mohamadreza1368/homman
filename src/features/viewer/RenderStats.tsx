import { useFrame, useThree } from "@react-three/fiber";
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import * as THREE from "three";

import { fps, heapMb, noteFrame, sample } from "./renderSample";
import { viewportKey } from "./viewportKeys";
import { AXIAL_PROBE } from "./AxialProbe";
import { SLICE_PIXELS } from "./axialSlice";
import { FLOW_PROBE } from "./bloodFlow";
import { BEATING, HEART_PROBE } from "./heartbeat";
import { readLocal, writeLocal } from "@/lib/localStore";
import { OVERLAY_CHIP } from "./overlayChrome";

/**
 * HOOMAAN Diagnostics & Real-time Render Performance Instrumentation.
 * Samples WebGL draw calls, triangle counts, buffer memory, FPS, P95 frame times,
 * and cardiovascular/tomographic solver execution latencies.
 */

const SCENE_POLL_INTERVAL_MS = 500;

function sweepSceneGraph(scene: THREE.Scene): void {
  let drawnCount = 0;
  let totalObjects = 0;

  scene.traverse((node) => {
    totalObjects += 1;
    if ((node as THREE.Mesh).isMesh && node.visible) {
      drawnCount += 1;
    }
  });

  sample.visible = drawnCount;
  sample.objects = totalObjects;
  sample.canvases = document.querySelectorAll("canvas").length;
  sample.heapMb = heapMb();
}

export function RenderProbe() {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const prevTimestamp = useRef(performance.now());
  const prevSweepTime = useRef(0);

  useFrame(() => {
    const now = performance.now();
    noteFrame(now - prevTimestamp.current);
    prevTimestamp.current = now;

    const rendererInfo = gl.info;
    sample.calls = rendererInfo.render.calls;
    sample.triangles = rendererInfo.render.triangles;
    sample.geometries = rendererInfo.memory.geometries;
    sample.textures = rendererInfo.memory.textures;
    sample.programs = rendererInfo.programs?.length ?? 0;

    if (now - prevSweepTime.current > SCENE_POLL_INTERVAL_MS) {
      prevSweepTime.current = now;
      sweepSceneGraph(scene);
    }
  });

  return null;
}

interface StatMetricRow {
  label: string;
  read: () => string;
  key?: boolean;
}

const STAT_METRIC_ROWS: StatMetricRow[] = [
  { label: "fps", read: () => fps(sample).toFixed(0), key: true },
  { label: "p95", read: () => `${sample.p95Ms.toFixed(1)} ms`, key: true },
  { label: "draw calls", read: () => sample.calls.toLocaleString(), key: true },
  { label: "triangles", read: () => sample.triangles.toLocaleString() },
  { label: "meshes drawn", read: () => sample.visible.toLocaleString(), key: true },
  { label: "objects", read: () => sample.objects.toLocaleString() },
  { label: "geometries", read: () => sample.geometries.toLocaleString() },
  { label: "textures", read: () => sample.textures.toLocaleString() },
  { label: "programs", read: () => sample.programs.toLocaleString() },
  { label: "canvases", read: () => String(sample.canvases) },
  {
    label: "heap",
    read: () => (sample.heapMb === null ? "—" : `${sample.heapMb.toFixed(0)} MB`),
  },
  {
    label: "axial render",
    read: () => (AXIAL_PROBE.renderMs < 0 ? "—" : `${AXIAL_PROBE.renderMs.toFixed(1)} ms`),
  },
  {
    label: "axial readback",
    read: () => (AXIAL_PROBE.readbackMs < 0 ? "—" : `${AXIAL_PROBE.readbackMs.toFixed(1)} ms`),
  },
  {
    label: "axial calls",
    read: () => (AXIAL_PROBE.drawCalls < 0 ? "—" : AXIAL_PROBE.drawCalls.toLocaleString()),
  },
  {
    label: "axial drawn",
    read: () => (AXIAL_PROBE.drawn < 0 ? "—" : AXIAL_PROBE.drawn.toLocaleString()),
  },
  { label: "axial runs", read: () => String(AXIAL_PROBE.runs) },
  { label: "axial pixels", read: () => `${SLICE_PIXELS.value}²` },
  { label: "heart meshes", read: () => (BEATING.size === 0 ? "—" : String(BEATING.size)) },
  {
    label: "heart seams",
    read: () => (HEART_PROBE.seamMs < 0 ? "—" : `${HEART_PROBE.seamMs.toFixed(0)} ms`),
  },
  {
    label: "blood paths",
    read: () =>
      FLOW_PROBE.pathMs < 0
        ? "—"
        : `${FLOW_PROBE.pathMs.toFixed(0)} ms · ${(FLOW_PROBE.vertices / 1000).toFixed(0)}k verts`,
  },
];

const LOCAL_STORAGE_COORDS_KEY = "hoomaan.stats.place.v1";
const SCREEN_MARGIN_PX = 120;

export function clampToWindow(coords: { x: number; y: number }): { x: number; y: number } {
  return {
    x: Math.min(Math.max(coords.x, 0), Math.max(0, window.innerWidth - SCREEN_MARGIN_PX)),
    y: Math.min(Math.max(coords.y, 0), Math.max(0, window.innerHeight - SCREEN_MARGIN_PX)),
  };
}

export function storedPlace(): { x: number; y: number } | null {
  const serial = readLocal(LOCAL_STORAGE_COORDS_KEY);
  if (!serial) return null;
  const [px, py] = serial.split(",").map(Number);
  if (!Number.isFinite(px) || !Number.isFinite(py)) return null;
  return clampToWindow({ x: px as number, y: py as number });
}

export function RenderStatsPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const valueDomCells = useRef<(HTMLSpanElement | null)[]>([]);
  const [screenCoords, setScreenCoords] = useState<{ x: number; y: number } | null>(storedPlace);
  const dragAnchor = useRef<{ x: number; y: number } | null>(null);
  const containerPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleViewportResize = () => setScreenCoords((loc) => (loc ? clampToWindow(loc) : loc));
    window.addEventListener("resize", handleViewportResize);
    return () => window.removeEventListener("resize", handleViewportResize);
  }, []);

  useLayoutEffect(() => {
    if (!isOpen || screenCoords) return;
    const clientBounds = containerPanelRef.current?.getBoundingClientRect();
    if (!clientBounds) return;
    const isOutOfBounds =
      clientBounds.top < 0 ||
      clientBounds.left < 0 ||
      clientBounds.bottom > window.innerHeight;
    if (isOutOfBounds) {
      setScreenCoords(clampToWindow({ x: Math.max(clientBounds.left, 8), y: 8 }));
    }
  }, [isOpen, screenCoords]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (viewportKey(e) !== "m") return;
      setIsOpen((active) => !active);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    let animId = 0;
    const updateMetrics = () => {
      for (const [idx, item] of STAT_METRIC_ROWS.entries()) {
        const domNode = valueDomCells.current[idx];
        if (domNode) domNode.textContent = item.read();
      }
      animId = requestAnimationFrame(updateMetrics);
    };
    animId = requestAnimationFrame(updateMetrics);
    return () => cancelAnimationFrame(animId);
  }, [isOpen]);

  if (!isOpen) {
    return (
      <div className={`pointer-events-none select-none ${OVERLAY_CHIP}`}>
        M · render stats
      </div>
    );
  }

  return (
    <div
      ref={containerPanelRef}
      className={`pointer-events-none select-none rounded border border-slate-700/70 bg-slate-950/90 px-2.5 py-2 font-mono text-[10px] text-slate-300 shadow-lg ${
        screenCoords ? "fixed z-30" : ""
      }`}
      style={screenCoords ? { left: screenCoords.x, top: screenCoords.y } : undefined}
    >
      <p
        className="pointer-events-auto mb-1.5 cursor-grab text-[9px] uppercase tracking-wider text-slate-500 active:cursor-grabbing"
        onPointerDown={(e) => {
          const rect = e.currentTarget.parentElement?.getBoundingClientRect();
          if (!rect) return;
          dragAnchor.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
          setScreenCoords(clampToWindow({ x: rect.left, y: rect.top }));
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const anchor = dragAnchor.current;
          if (!anchor) return;
          setScreenCoords(clampToWindow({ x: e.clientX - anchor.x, y: e.clientY - anchor.y }));
        }}
        onPointerUp={(e) => {
          dragAnchor.current = null;
          const rect = e.currentTarget.parentElement?.getBoundingClientRect();
          if (rect) {
            writeLocal(LOCAL_STORAGE_COORDS_KEY, `${Math.round(rect.left)},${Math.round(rect.top)}`);
          }
        }}
        onPointerCancel={() => {
          dragAnchor.current = null;
        }}
        title="Drag to move · M to hide"
      >
        Renderer · drag me · M to hide
      </p>
      <div className="grid grid-cols-[auto_auto] gap-x-3 gap-y-0.5 tabular-nums">
        {STAT_METRIC_ROWS.map((row, idx) => (
          <Fragment key={row.label}>
            <span className={row.key ? "text-slate-400" : "text-slate-600"}>
              {row.label}
            </span>
            <span
              ref={(elem) => {
                valueDomCells.current[idx] = elem;
              }}
              className={`text-right ${row.key ? "text-sky-300" : "text-slate-400"}`}
            >
              —
            </span>
          </Fragment>
        ))}
      </div>
    </div>
  );
}
