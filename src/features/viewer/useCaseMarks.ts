/**
 * Hoomaan 3D Viewer - Active Clinical Case Pathology Markers Hook
 */

import { useEffect } from "react";
import { useCaseStore } from "@/stores/caseStore";
import { useSceneStore, type PathologyOverlay } from "@/stores/sceneStore";

const DEFAULT_SEVERITY = 0.5;

/** Maps 0–10 clinical severity scale to normalized 0–1 rendering intensity. */
export function markSeverity(severity: number | null): number {
  if (severity === null) return DEFAULT_SEVERITY;
  return Math.min(Math.max(severity, 0), 10) / 10;
}

/** Converts patient symptom records into visual pathology overlay definitions. */
export function caseMarksFrom(
  symptoms: readonly { organ_id: string; symptom: string; severity: number | null }[],
): Record<string, PathologyOverlay> {
  const marks: Record<string, PathologyOverlay> = {};

  for (const item of symptoms) {
    const existing = marks[item.organ_id];
    const score = markSeverity(item.severity);
    marks[item.organ_id] =
      existing && existing.severity >= score
        ? { pathology: `${existing.pathology} · ${item.symptom}`, severity: existing.severity }
        : {
            pathology: existing ? `${existing.pathology} · ${item.symptom}` : item.symptom,
            severity: score,
          };
  }

  return marks;
}

/** Synchronizes active case symptoms with 3D scene pathology overlay state. */
export function useCaseMarks(): void {
  const symptoms = useCaseStore((s) => s.symptoms);
  const activeCaseId = useCaseStore((s) => s.activeCaseId);
  const setCaseMarks = useSceneStore((s) => s.setCaseMarks);

  useEffect(() => {
    setCaseMarks(activeCaseId ? caseMarksFrom(symptoms) : {});
  }, [symptoms, activeCaseId, setCaseMarks]);
}
