import { create } from "zustand";

import * as db from "@/lib/studyDb";
import { useCaseStore } from "@/stores/caseStore";
import { createExportPackage } from "@/features/local/journalVaultEngine";
import type {
  ImportSummary,
  NoteInput,
  SessionSummary,
  StudyNote,
  StudyStats,
  TurnInput,
} from "@/lib/studyDb";

/**
 * Journal and academic study store for HOOMAAN.
 *
 * Encapsulates study sessions, clinical case reviews, anatomical dissection notes,
 * and structure coverage analytics backed by local SQLite storage.
 * Gracefully captures I/O errors into store state without throwing into UI threads.
 */
interface StudyState {
  sessions: SessionSummary[];
  notes: StudyNote[];
  stats: StudyStats | null;
  query: string;
  organFilter: string | null;
  organFilterLabel: string | null;
  caseFilter: string | null;
  error: string | null;
  loaded: boolean;

  refresh: () => Promise<void>;
  setQuery: (query: string) => Promise<void>;
  setOrganFilter: (organId: string | null, label?: string | null) => Promise<void>;
  setCaseFilter: (caseId: string | null) => Promise<void>;
  dismissError: () => void;

  saveTurn: (turn: TurnInput) => Promise<boolean>;
  recordVerdict: (sessionId: string, score: number, verdict: string) => Promise<boolean>;
  renameSession: (sessionId: string, title: string) => Promise<boolean>;
  removeSession: (sessionId: string) => Promise<boolean>;

  addNote: (input: NoteInput) => Promise<boolean>;
  editNote: (id: number, body: string) => Promise<boolean>;
  removeNote: (id: number) => Promise<boolean>;

  coverage: Record<string, number>;
  coverageVisible: boolean;
  setCoverageVisible: (visible: boolean) => Promise<void>;

  transfer: string | null;
  exportJournal: () => Promise<void>;
  importJournal: () => Promise<void>;
  dismissTransfer: () => void;
}

export function describeImport(summary: ImportSummary): string {
  const parts: string[] = [];
  const added = summary.sessions_added + summary.notes_added + summary.cases_added;
  const updated = summary.sessions_updated + summary.notes_updated;

  if (summary.sessions_added > 0) {
    parts.push(`${summary.sessions_added} sessions`);
  }
  if (summary.cases_added > 0) {
    parts.push(`${summary.cases_added} ${summary.cases_added === 1 ? "patient" : "patients"}`);
  }
  if (summary.notes_added > 0) {
    parts.push(`${summary.notes_added} notes`);
  }

  if (added === 0 && updated === 0) {
    return "Nothing new — that journal is already here.";
  }

  const prefix = parts.length > 0 ? `Added ${parts.join(" and ")}` : "Merged";
  const updateSuffix = updated > 0 ? `, updated ${updated}` : "";
  const skipSuffix = summary.skipped > 0 ? `. ${summary.skipped} already here.` : ".";
  return `${prefix}${updateSuffix}${skipSuffix}`;
}

function extractErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function mapCoverageRows(rows: db.StudyCoverage[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const row of rows) {
    result[row.organ_id] = row.touches;
  }
  return result;
}

export const useStudyStore = create<StudyState>()((set, get) => {
  async function executeJournalWrite(action: () => Promise<unknown>): Promise<boolean> {
    try {
      await action();
      set({ error: null });
    } catch (err) {
      set({ error: extractErrorMessage(err) });
      return false;
    }
    await get().refresh();
    return true;
  }

  return {
    sessions: [],
    notes: [],
    stats: null,
    query: "",
    organFilter: null,
    organFilterLabel: null,
    caseFilter: null,
    error: null,
    loaded: false,

    coverage: {},
    coverageVisible: false,

    refresh: async () => {
      const { query, organFilter, caseFilter, coverageVisible } = get();
      const searchTerm = query.trim() || null;
      try {
        const [sessions, notes, stats, coverageData] = await Promise.all([
          db.listStudySessions(searchTerm, organFilter, caseFilter),
          db.listNotes(organFilter, searchTerm),
          db.studyStats(),
          coverageVisible ? db.studyCoverage() : Promise.resolve(null),
        ]);

        set({
          sessions,
          notes,
          stats,
          ...(coverageData ? { coverage: mapCoverageRows(coverageData) } : {}),
          error: null,
          loaded: true,
        });
      } catch (err) {
        set({ error: extractErrorMessage(err), loaded: true });
      }
    },

    setCoverageVisible: async (visible: boolean) => {
      set({ coverageVisible: visible });
      if (visible) {
        await get().refresh();
      }
    },

    setQuery: async (query: string) => {
      set({ query });
      await get().refresh();
    },

    setOrganFilter: async (organId: string | null, label: string | null = null) => {
      set({
        organFilter: organId,
        organFilterLabel: organId ? label : null,
      });
      await get().refresh();
    },

    setCaseFilter: async (caseId: string | null) => {
      set({ caseFilter: caseId });
      await get().refresh();
    },

    dismissError: () => set({ error: null }),

    saveTurn: (turn: TurnInput) => executeJournalWrite(() => db.saveStudyTurn(turn)),

    recordVerdict: (sessionId: string, score: number, verdict: string) =>
      executeJournalWrite(() => db.recordCaseResult(sessionId, score, verdict)),

    renameSession: (sessionId: string, title: string) =>
      executeJournalWrite(() => db.renameStudySession(sessionId, title)),

    removeSession: (sessionId: string) =>
      executeJournalWrite(() => db.deleteStudySession(sessionId)),

    addNote: (input: NoteInput) => executeJournalWrite(() => db.createNote(input)),

    editNote: (id: number, body: string) => executeJournalWrite(() => db.updateNote(id, body)),

    removeNote: (id: number) => executeJournalWrite(() => db.deleteNote(id)),

    transfer: null,

    exportJournal: async () => {
      try {
        const { notes } = get();
        createExportPackage(
          notes.map((n) => ({ id: String(n.id), content: n.body })),
          [],
        );
        const exportedPath = await db.exportJournal();
        set({
          transfer: exportedPath ? `Saved to ${exportedPath}` : null,
          error: null,
        });
      } catch (err) {
        set({ error: extractErrorMessage(err) });
      }
    },

    importJournal: async () => {
      let result: ImportSummary | null;
      try {
        result = await db.importJournal();
      } catch (err) {
        set({ error: extractErrorMessage(err) });
        return;
      }
      if (!result) return;

      set({ transfer: describeImport(result), error: null });
      await Promise.all([get().refresh(), useCaseStore.getState().refresh()]);
    },

    dismissTransfer: () => set({ transfer: null }),
  };
});
