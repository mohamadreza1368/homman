import { create } from "zustand";

import type { VirtualPatient } from "@/lib/schemas";
import * as db from "@/lib/studyDb";
import {
  MAX_VISITS,
  type CaseDigest,
  type CaseFile,
  type CaseInput,
  type CaseVisit,
  type CaseSymptom,
  type CaseFinding,
  type SymptomInput,
} from "@/lib/studyDb";

/**
 * Clinical simulation, virtual patients, and case management store for HOOMAAN.
 *
 * Manages simulated patient records, organ-localized symptom pins (with severity ratings),
 * incremental visit records, and secure diagnostic answer unsealing.
 * Isolates sealed diagnostic ground-truth so it is never exposed prematurely in user-facing UI.
 */
interface ClinicalCaseState {
  cases: CaseFile[];
  activeCaseId: string | null;
  symptoms: CaseSymptom[];
  visits: CaseVisit[];
  record: CaseFinding[];
  error: string | null;
  loaded: boolean;

  refresh: () => Promise<void>;
  mark: (input: SymptomInput) => Promise<CaseSymptom | null>;
  unmark: (id: number) => Promise<boolean>;
  note: (body: string) => Promise<CaseFinding | null>;
  unnote: (id: number) => Promise<boolean>;
  open: (input: CaseInput) => Promise<CaseFile | null>;
  select: (caseId: string | null) => void;
  remove: (caseId: string) => Promise<boolean>;
  reveal: (caseId: string) => Promise<string | null>;
  dismissError: () => void;
}

function parseErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function isFull(entry: CaseFile): boolean {
  return entry.visit_count >= MAX_VISITS;
}

export function visitLabel(entry: CaseFile): string {
  return isFull(entry) ? "complete" : `visit ${entry.visit_count + 1}`;
}

function normalizeDiacritics(str: string): string {
  return str
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export function matchesQuery(entry: CaseFile, query: string): boolean {
  const normalizedQuery = normalizeDiacritics(query.trim());
  return normalizedQuery === "" || normalizeDiacritics(entry.title).includes(normalizedQuery);
}

export const FILTER_PATIENTS_FROM = 8;

export function reviewMaySeeTheAnswer(
  visits: readonly CaseVisit[],
  revealedAt: number | null = null,
): boolean {
  if (revealedAt !== null) return true;
  return visits.length > 0 && visits.every((v) => v.score !== null);
}

export interface ReviewReadiness {
  ungraded: number;
  visits: number;
  complaints: number;
  updates: number;
  bare: boolean;
}

export function reviewReadiness(
  patient: CaseFile,
  symptoms: readonly CaseSymptom[],
  visits: readonly CaseVisit[],
  record: readonly CaseFinding[] = [],
): ReviewReadiness {
  return {
    ungraded: visits.filter((v) => v.score === null).length,
    visits: visits.length,
    complaints: symptoms.length,
    updates: record.length,
    bare: patient.findings.trim() === "" && record.length === 0,
  };
}

export const useCaseStore = create<ClinicalCaseState>((set, get) => ({
  cases: [],
  activeCaseId: null,
  symptoms: [],
  visits: [],
  record: [],
  error: null,
  loaded: false,

  refresh: async () => {
    try {
      const active = get().activeCaseId;
      const [cases, digest] = await Promise.all([
        db.listCases(),
        active ? db.caseDigest(active) : Promise.resolve(null),
      ]);

      set({
        cases,
        symptoms: digest?.symptoms ?? [],
        visits: digest?.visits ?? [],
        record: digest?.record_updates ?? [],
        error: null,
        loaded: true,
      });
    } catch (err) {
      set({ error: parseErrorMessage(err), loaded: true });
    }
  },

  open: async (input: CaseInput) => {
    try {
      const created = await db.createCase(input);
      set((state) => ({
        cases: [created, ...state.cases],
        activeCaseId: created.id,
        symptoms: [],
        visits: [],
        record: [],
        error: null,
      }));
      return created;
    } catch (err) {
      set({ error: parseErrorMessage(err) });
      return null;
    }
  },

  select: (caseId: string | null) => {
    set({
      activeCaseId: caseId,
      symptoms: [],
      visits: [],
      record: [],
    });
    if (caseId) {
      void get().refresh();
    }
  },

  mark: async (input: SymptomInput) => {
    try {
      const symptom = await db.addCaseSymptom(input);
      set((state) => ({
        symptoms: [...state.symptoms, symptom],
        error: null,
      }));
      return symptom;
    } catch (err) {
      set({ error: parseErrorMessage(err) });
      return null;
    }
  },

  unmark: async (id: number) => {
    try {
      await db.deleteCaseSymptom(id);
      set((state) => ({
        symptoms: state.symptoms.filter((s) => s.id !== id),
        error: null,
      }));
      return true;
    } catch (err) {
      set({ error: parseErrorMessage(err) });
      return false;
    }
  },

  note: async (body: string) => {
    const text = body.trim();
    if (text === "") return null;
    const activeId = get().activeCaseId;
    if (!activeId) return null;

    try {
      const entry = await db.addCaseFinding({ case_id: activeId, body: text });
      set((state) => ({
        record: [...state.record, entry],
        error: null,
      }));
      return entry;
    } catch (err) {
      set({ error: parseErrorMessage(err) });
      return null;
    }
  },

  unnote: async (id: number) => {
    try {
      await db.deleteCaseFinding(id);
      set((state) => ({
        record: state.record.filter((item) => item.id !== id),
        error: null,
      }));
      return true;
    } catch (err) {
      set({ error: parseErrorMessage(err) });
      return false;
    }
  },

  remove: async (caseId: string) => {
    try {
      await db.deleteCase(caseId);
      set((state) => {
        const isCurrentActive = state.activeCaseId === caseId;
        return {
          cases: state.cases.filter((c) => c.id !== caseId),
          activeCaseId: isCurrentActive ? null : state.activeCaseId,
          symptoms: isCurrentActive ? [] : state.symptoms,
          visits: isCurrentActive ? [] : state.visits,
          record: isCurrentActive ? [] : state.record,
          error: null,
        };
      });
      return true;
    } catch (err) {
      set({ error: parseErrorMessage(err) });
      return false;
    }
  },

  reveal: async (caseId: string) => {
    try {
      const answer = await db.revealCaseAnswer(caseId);
      await get().refresh();
      return answer;
    } catch (err) {
      set({ error: parseErrorMessage(err) });
      return null;
    }
  },

  dismissError: () => set({ error: null }),
}));

export function activeCase(state: ClinicalCaseState): CaseFile | undefined {
  return state.cases.find((entry) => entry.id === state.activeCaseId);
}

export async function virtualPatientContext(
  sessionId: string,
  labelFor: (organId: string) => string | null,
  mode: "case" | "review" = "case",
): Promise<{ case: VirtualPatient } | Record<string, never>> {
  const caseId = useCaseStore.getState().activeCaseId;
  if (!caseId) return {};

  let digest: CaseDigest | null = null;
  try {
    digest = await db.caseDigest(caseId);
  } catch (err) {
    useCaseStore.setState({ error: parseErrorMessage(err) });
    return {};
  }
  if (!digest) return {};

  const currentVisit = digest.visits.find((v) => v.session_id === sessionId);
  const visitIndex = currentVisit?.visit_no ?? digest.visits.length + 1;
  const canRevealTruth =
    mode === "case" || reviewMaySeeTheAnswer(digest.visits, digest.case.revealed_at);

  return {
    case: {
      title: digest.case.title,
      sex: digest.case.sex,
      age_years: digest.case.age_years,
      height_cm: digest.case.height_cm,
      weight_kg: digest.case.weight_kg,
      findings: digest.case.findings,
      record_updates: digest.record_updates.map((update) => ({
        visit_no: update.visit_no,
        body: update.body,
      })),
      ground_truth: canRevealTruth ? digest.ground_truth : "",
      visit_no: visitIndex,
      complaints: digest.symptoms.map((symptom) => ({
        organ_id: symptom.organ_id,
        label: symptom.organ_label ?? labelFor(symptom.organ_id) ?? symptom.organ_id,
        symptom: symptom.symptom,
        severity: symptom.severity,
      })),
      earlier_visits: digest.visits
        .filter((v) => v.visit_no < visitIndex)
        .map((v) => ({
          visit_no: v.visit_no,
          score: v.score,
          verdict: canRevealTruth ? v.verdict : null,
        })),
    },
  };
}
