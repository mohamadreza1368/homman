/**
 * Hook managing axial canvas synchronization, zoom/pan window state,
 * torch lighting updates, and wheel-based stepped navigation.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { useScanStore } from "@/stores/scanStore";
import {
  AXIAL_CANVAS,
  panWindow,
  restoreSlice,
  RETAKE_INTERVAL_MS,
  SECTION_VIEW,
  slicePlane,
  TORCH,
  torchDirection,
  wantSection,
  wheelSteps,
  WHEEL_SETTLE_MS,
  zoomWindow,
  type SliceWindow,
} from "./axialSlice";
import { AXIAL_PROBE } from "./AxialProbe";
import { stepFraction } from "./scanBand";

export function useSliceCanvasStream(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const isTorchActive = useScanStore((s) => s.torch);
  const isScannerHeld = useScanStore((s) => s.held);
  const currentPlane = useScanStore((s) => s.plane);

  const [activeWindow, setActiveWindow] = useState<SliceWindow | null>(null);
  const [isSteppedNavigation, setIsSteppedNavigation] = useState(false);

  const lastDragPos = useRef<{ x: number; y: number } | null>(null);
  const carriedWheelDelta = useRef(0);
  const settleTimerRef = useRef<number | null>(null);
  const lastRetakeTimestamp = useRef(0);
  const trailingRetakeTimer = useRef<number | null>(null);

  const scheduleSliceRetake = useCallback(() => {
    const now = performance.now();
    const elapsed = now - lastRetakeTimestamp.current;
    if (trailingRetakeTimer.current !== null) {
      window.clearTimeout(trailingRetakeTimer.current);
    }

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
  }, []);

  const updateTorchPosition = useCallback(
    (rect: DOMRect, clientX: number, clientY: number) => {
      if (!isTorchActive || rect.width <= 0 || rect.height <= 0) return;
      const u = (clientX - rect.left - rect.width / 2) / (rect.width / 2);
      const v = (clientY - rect.top - rect.height / 2) / (rect.height / 2);
      TORCH.value = torchDirection(u, v, AXIAL_PROBE.basis, slicePlane(AXIAL_PROBE.plane));
      scheduleSliceRetake();
    },
    [isTorchActive, scheduleSliceRetake],
  );

  const applyWindowChange = useCallback(
    (nextWindow: SliceWindow | null, immediate = false) => {
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
    },
    [scheduleSliceRetake],
  );

  const getCurrentWindow = useCallback((): SliceWindow => {
    return activeWindow ?? AXIAL_PROBE.base;
  }, [activeWindow]);

  const performZoom = useCallback(
    (factor: number, u = 0, v = 0) => {
      if (AXIAL_PROBE.base.half <= 0) return;
      applyWindowChange(
        zoomWindow(getCurrentWindow(), AXIAL_PROBE.base, factor, AXIAL_PROBE.basis, u, v),
      );
    },
    [getCurrentWindow, applyWindowChange],
  );

  const processWheelInput = useCallback((deltaY: number) => {
    const fractionPerStep = stepFraction();
    if (fractionPerStep === 0) return;

    const { steps, carry } = wheelSteps(carriedWheelDelta.current, deltaY);
    carriedWheelDelta.current = carry;
    if (steps === 0) return;

    useScanStore.getState().step(-steps * fractionPerStep);
    setIsSteppedNavigation(true);

    if (settleTimerRef.current !== null) {
      window.clearTimeout(settleTimerRef.current);
    }
    settleTimerRef.current = window.setTimeout(() => {
      settleTimerRef.current = null;
      wantSection();
    }, WHEEL_SETTLE_MS);
  }, []);

  const panCanvas = useCallback(
    (dx: number, dy: number, computedWidth: number) => {
      if (computedWidth > 0) {
        applyWindowChange(
          panWindow(
            getCurrentWindow(),
            AXIAL_PROBE.base,
            dx,
            dy,
            computedWidth,
            AXIAL_PROBE.basis,
          ),
        );
      }
    },
    [getCurrentWindow, applyWindowChange],
  );

  useEffect(() => {
    if (isTorchActive || TORCH.value === null) return;
    TORCH.value = null;
    wantSection();
  }, [isTorchActive]);

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
    AXIAL_CANVAS.value = canvasRef.current;
    if (canvasRef.current) restoreSlice(canvasRef.current);
    return () => {
      AXIAL_CANVAS.value = null;
    };
  }, [canvasRef]);

  return {
    activeWindow,
    getCurrentWindow,
    performZoom,
    applyWindowChange,
    updateTorchPosition,
    processWheelInput,
    panCanvas,
    lastDragPos,
    isSteppedNavigation,
  };
}
