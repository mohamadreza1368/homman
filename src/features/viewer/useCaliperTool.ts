/**
 * Hook managing 2D slice caliper measurements, live drawing drafts,
 * and level-specific clear operations.
 */

import { useState, useRef, useCallback } from "react";
import {
  onLevel,
  pointInSection,
  type SectionMeasure,
  type SliceWindow,
} from "./axialSlice";
import { AXIAL_PROBE } from "./AxialProbe";

export function useCaliperTool() {
  const [isMeasuringMode, setIsMeasuringMode] = useState(false);
  const [recordedMeasures, setRecordedMeasures] = useState<SectionMeasure[]>([]);
  const [activeDraftMeasure, setActiveDraftMeasure] = useState<SectionMeasure | null>(null);
  const currentDraftRef = useRef<SectionMeasure | null>(null);

  const startMeasure = useCallback(
    (currentWindow: SliceWindow, offsetX: number, offsetY: number, rectWidth: number) => {
      const pt = pointInSection(currentWindow, offsetX, offsetY, rectWidth, AXIAL_PROBE.basis);
      const newLine: SectionMeasure = {
        plane: AXIAL_PROBE.plane,
        at: AXIAL_PROBE.at,
        ah: pt.h,
        av: pt.v,
        bh: pt.h,
        bv: pt.v,
      };
      currentDraftRef.current = newLine;
      setActiveDraftMeasure(newLine);
    },
    [],
  );

  const updateDraftMeasure = useCallback(
    (currentWindow: SliceWindow, offsetX: number, offsetY: number, rectWidth: number) => {
      if (!currentDraftRef.current) return;
      const pt = pointInSection(currentWindow, offsetX, offsetY, rectWidth, AXIAL_PROBE.basis);
      const updatedLine: SectionMeasure = {
        ...currentDraftRef.current,
        bh: pt.h,
        bv: pt.v,
      };
      currentDraftRef.current = updatedLine;
      setActiveDraftMeasure(updatedLine);
    },
    [],
  );

  const finishDraftMeasure = useCallback(() => {
    const finalized = currentDraftRef.current;
    if (!finalized) return;
    currentDraftRef.current = null;
    setActiveDraftMeasure(null);
    if (finalized.ah !== finalized.bh || finalized.av !== finalized.bv) {
      setRecordedMeasures((prev) => [...prev, finalized]);
    }
  }, []);

  const cancelDraftMeasure = useCallback(() => {
    currentDraftRef.current = null;
    setActiveDraftMeasure(null);
  }, []);

  const removeMeasure = useCallback((target: SectionMeasure) => {
    setRecordedMeasures((prev) => prev.filter((m) => m !== target));
  }, []);

  const clearCurrentLevelMeasures = useCallback(() => {
    setRecordedMeasures((prev) =>
      prev.filter((m) => !onLevel(m, AXIAL_PROBE.at, AXIAL_PROBE.plane)),
    );
  }, []);

  const activeLevelMeasures = recordedMeasures.filter((m) =>
    onLevel(m, AXIAL_PROBE.at, AXIAL_PROBE.plane),
  );

  return {
    isMeasuringMode,
    setIsMeasuringMode,
    toggleMeasuringMode: () => setIsMeasuringMode((v) => !v),
    recordedMeasures,
    activeMeasures: activeLevelMeasures,
    activeDraftMeasure,
    currentDraftRef,
    startMeasure,
    updateDraftMeasure,
    finishDraftMeasure,
    cancelDraftMeasure,
    removeMeasure,
    clearCurrentLevelMeasures,
  };
}
