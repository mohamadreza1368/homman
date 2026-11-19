import { useEffect, useRef, useState } from "react";

import { GrowingTextarea } from "@/components/GrowingTextarea";
import {
  caseDigest,
  getStudySession,
  type CaseFile,
  type SessionDetail,
  type SessionSummary,
  type StudyNote,
} from "@/lib/studyDb";
import { matchesQuery, useCaseStore, visitLabel } from "@/stores/caseStore";
import { useChatStore } from "@/stores/chatStore";
import { askToConfirm } from "@/stores/confirmStore";
import { usePrintStore } from "@/stores/printStore";
import { organLabel, useSceneStore } from "@/stores/sceneStore";
import { useStudyStore } from "@/stores/studyStore";
import { useInterfaceLanguage } from "@/stores/interfaceLanguage";

import {
  buildCaseDocument,
  buildNotesDocument,
  buildSessionDocument,
  journalLanguage,
} from "./printDocument";
import { foldStateFor, type StudySection } from "./sections";
import { whenLabel } from "./whenLabel";

/**
 * Main study notebook panel displaying notes, past dialogue sessions, and simulated patient case histories.
 */
export function StudyPanel() {
  const isPersian = useInterfaceLanguage((state) => state.language === "fa");
  const recordedSessions = useStudyStore((state) => state.sessions);
  const recordedNotes = useStudyStore((state) => state.notes);
  const searchQuery = useStudyStore((state) => state.query);
  const activeOrganFilter = useStudyStore((state) => state.organFilter);
  const activeOrganFilterLabel = useStudyStore((state) => state.organFilterLabel);
  const errorMessage = useStudyStore((state) => state.error);
  const transferMessage = useStudyStore((state) => state.transfer);
  const dismissTransfer = useStudyStore((state) => state.dismissTransfer);
  const isLoaded = useStudyStore((state) => state.loaded);
  const reloadStudyData = useStudyStore((state) => state.refresh);
  const setSearchQuery = useStudyStore((state) => state.setQuery);
  const setOrganFilter = useStudyStore((state) => state.setOrganFilter);
  const activeCaseFilter = useStudyStore((state) => state.caseFilter);
  const setCaseFilter = useStudyStore((state) => state.setCaseFilter);
  const virtualCasesList = useCaseStore((state) => state.cases);
  const dismissError = useStudyStore((state) => state.dismissError);

  useEffect(() => {
    void reloadStudyData();
  }, [reloadStudyData]);

  const isFilteringActive =
    searchQuery.trim() !== "" || activeOrganFilter !== null || activeCaseFilter !== null;
  const [sectionFoldState, setSectionFoldState] = useState(() => foldStateFor(false));

  useEffect(() => {
    setSectionFoldState(foldStateFor(isFilteringActive));
  }, [isFilteringActive]);

  const toggleSectionFold = (sectionKey: StudySection) =>
    setSectionFoldState((prev) => ({ ...prev, [sectionKey]: !prev[sectionKey] }));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-slate-800 p-3">
        <StudyStatsOverview />
        <input
          value={searchQuery}
          onChange={(event) => void setSearchQuery(event.target.value)}
          placeholder={isPersian ? "جست‌وجو در یادداشت‌ها و نشست‌ها…" : "Search notes, sessions and patients…"}
          className="mt-2 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs outline-none placeholder:text-slate-600 focus:border-sky-600"
        />
        {activeCaseFilter && (
          <button
            type="button"
            onClick={() => void setCaseFilter(null)}
            title="Show every session again"
            className="mt-1.5 flex w-full items-center gap-1 rounded bg-amber-600/15 px-2 py-0.5 text-[10px] text-amber-300"
          >
            <span className="truncate">
              {virtualCasesList.find((entry) => entry.id === activeCaseFilter)?.title ?? "This patient"}
            </span>
            <span className="ml-auto shrink-0 text-amber-500">clear ✕</span>
          </button>
        )}
        {activeOrganFilter && (
          <button
            type="button"
            onClick={() => void setOrganFilter(null)}
            title="Show everything again"
            className="mt-1.5 flex w-full items-center gap-1 rounded bg-sky-600/15 px-2 py-0.5 text-[10px] text-sky-300"
          >
            <span className="truncate italic">
              {activeOrganFilterLabel ?? activeOrganFilter}
            </span>
            <span className="ml-auto shrink-0 text-sky-500">clear ✕</span>
          </button>
        )}
      </div>

      {transferMessage && (
        <button
          type="button"
          onClick={dismissTransfer}
          title="Dismiss"
          className="mx-3 mt-2 rounded border border-emerald-800/60 bg-emerald-900/20 px-2 py-1 text-left text-[11px] text-emerald-300"
        >
          {transferMessage}
        </button>
      )}

      {errorMessage && (
        <button
          type="button"
          onClick={dismissError}
          title="Dismiss"
          className="mx-3 mt-2 rounded border border-rose-800/60 bg-rose-900/20 px-2 py-1 text-left text-[11px] text-rose-300"
        >
          {errorMessage}
        </button>
      )}

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-3">
        <section>
          <CollapsibleHeader
            label={isPersian ? "یادداشت‌ها" : "Notes"}
            count={recordedNotes.length}
            action={<PrintNotesAction />}
            open={!sectionFoldState.notes}
            onToggle={() => toggleSectionFold("notes")}
          />
          <NoteComposer />
          {!sectionFoldState.notes && (
            <>
              {isLoaded && recordedNotes.length === 0 && (
                <p className="mt-2 text-[11px] text-slate-600">
                  Nothing written down yet. Select a structure and add a note, or save
                  an answer from the assistant.
                </p>
              )}
              <div className="mt-2 space-y-1.5">
                {recordedNotes.map((noteItem) => (
                  <NoteCard key={noteItem.id} note={noteItem} />
                ))}
              </div>
            </>
          )}
        </section>

        <VirtualPatientCasesSection
          open={!sectionFoldState.cases}
          onToggle={() => toggleSectionFold("cases")}
        />

        <section>
          <CollapsibleHeader
            label={isPersian ? "نشست‌ها" : "Sessions"}
            count={recordedSessions.length}
            open={!sectionFoldState.sessions}
            onToggle={() => toggleSectionFold("sessions")}
          />
          {!sectionFoldState.sessions && (
            <>
              {isLoaded && recordedSessions.length === 0 && (
                <p className="mt-2 text-[11px] text-slate-600">
                  Conversations are filed here automatically as you have them.
                </p>
              )}
              <div className="mt-2 space-y-1">
                {recordedSessions.map((sessionItem) => (
                  <SessionRow key={sessionItem.id} session={sessionItem} />
                ))}
              </div>
            </>
          )}
        </section>

        <JournalTransferControls />
      </div>
    </div>
  );
}

function JournalTransferControls() {
  const exportJournalData = useStudyStore((state) => state.exportJournal);
  const importJournalData = useStudyStore((state) => state.importJournal);
  const journalMetrics = useStudyStore((state) => state.stats);
  const [activeTask, setActiveTask] = useState<"export" | "import" | null>(null);

  const isStoreEmpty = !journalMetrics || journalMetrics.sessions + journalMetrics.notes === 0;

  const triggerTransfer = (mode: "export" | "import", runner: () => Promise<void>) => async () => {
    setActiveTask(mode);
    try {
      await runner();
    } finally {
      setActiveTask(null);
    }
  };

  return (
    <section>
      <CollapsibleHeader label="Move it to another machine" />
      <div className="mt-2 flex gap-1.5">
        <button
          type="button"
          disabled={isStoreEmpty || activeTask !== null}
          onClick={() => void triggerTransfer("export", exportJournalData)()}
          title={
            isStoreEmpty
              ? "Nothing to export yet"
              : "Write the whole journal to one file you can carry"
          }
          className="flex-1 rounded border border-slate-700 py-1 text-[11px] text-slate-300 transition hover:border-sky-600 hover:text-sky-200 disabled:opacity-30"
        >
          {activeTask === "export" ? "Exporting…" : "Export"}
        </button>
        <button
          type="button"
          disabled={activeTask !== null}
          onClick={() => void triggerTransfer("import", importJournalData)()}
          title="Merge a journal file into this one — nothing here is overwritten"
          className="flex-1 rounded border border-slate-700 py-1 text-[11px] text-slate-300 transition hover:border-sky-600 hover:text-sky-200 disabled:opacity-30"
        >
          {activeTask === "import" ? "Importing…" : "Import"}
        </button>
      </div>
      <p className="mt-1.5 text-[10px] leading-snug text-slate-600">
        One file, everything in it. Importing merges — it adds to what is here and
        never overwrites a note you edited more recently.
      </p>
    </section>
  );
}

function PrintNotesAction() {
  const noteList = useStudyStore((state) => state.notes);
  const sessionList = useStudyStore((state) => state.sessions);
  const activeOrganFilter = useStudyStore((state) => state.organFilter);
  const activeOrganFilterLabel = useStudyStore((state) => state.organFilterLabel);
  const launchPrintSheet = usePrintStore((state) => state.show);

  if (noteList.length === 0) return null;

  const contextStructure = activeOrganFilter ? (activeOrganFilterLabel ?? null) : null;

  const handlePrint = () => {
    launchPrintSheet(buildNotesDocument(noteList, contextStructure, journalLanguage(sessionList)));
  };

  return (
    <button
      type="button"
      onClick={handlePrint}
      title={
        contextStructure
          ? `Print your notes on ${contextStructure}, or save them as a PDF`
          : "Print these notes, or save them as a PDF"
      }
      className="text-[10px] text-slate-600 transition hover:text-sky-300"
    >
      ⎙ print
    </button>
  );
}

function CollapsibleHeader({
  label,
  count,
  action,
  open,
  onToggle,
}: {
  label: string;
  count?: number;
  action?: React.ReactNode;
  open?: boolean;
  onToggle?: () => void;
}) {
  const headerContent = (
    <>
      {label}
      {count !== undefined && <span className="ml-2 text-slate-600">{count}</span>}
    </>
  );

  return (
    <div className="flex items-center gap-2 border-b border-slate-800/70 pb-1">
      <h2 className="min-w-0 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {onToggle ? (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            title={open ? `Fold ${label.toLowerCase()} away` : `Show ${label.toLowerCase()}`}
            className="flex items-center gap-1.5 transition hover:text-slate-300"
          >
            <span aria-hidden className="text-slate-600">
              {open ? "▾" : "▸"}
            </span>
            {headerContent}
          </button>
        ) : (
          headerContent
        )}
      </h2>
      <div className="ml-auto">{action}</div>
    </div>
  );
}

function StudyStatsOverview() {
  const currentStats = useStudyStore((state) => state.stats);
  if (!currentStats || currentStats.sessions + currentStats.notes === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
      <StatItem label="sessions" value={currentStats.sessions} />
      {currentStats.cases > 0 && <StatItem label="cases" value={currentStats.cases} />}
      <StatItem label="notes" value={currentStats.notes} />
      {currentStats.average_score !== null && (
        <span
          title={`Across ${currentStats.graded_cases} graded case drill(s)`}
          className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 font-semibold text-emerald-300"
        >
          avg {Math.round(currentStats.average_score)}/100
        </span>
      )}
    </div>
  );
}

function StatItem({ label, value }: { label: string; value: number }) {
  return (
    <span className="rounded-full bg-slate-800/70 px-1.5 py-0.5 text-slate-400">
      {value} {label}
    </span>
  );
}

function NoteComposer() {
  const loadedOrgans = useSceneStore((state) => state.organs);
  const selectedOrganIds = useSceneStore((state) => state.selectedOrganIds);
  const activeSessionId = useChatStore((state) => state.sessionId);
  const commitNote = useStudyStore((state) => state.addNote);

  const [textContent, setTextContent] = useState("");
  const [isEditorExpanded, setIsEditorExpanded] = useState(false);
  const savingLockRef = useRef(false);
  const [isSavingInProgress, setIsSavingInProgress] = useState(false);

  const focusedOrgan = selectedOrganIds[0] ? loadedOrgans[selectedOrganIds[0]] : undefined;

  async function handleNoteSubmit() {
    const trimmedInput = textContent.trim();
    if (!trimmedInput || savingLockRef.current) return;

    savingLockRef.current = true;
    setIsSavingInProgress(true);
    try {
      const isSaved = await commitNote({
        organ_id: focusedOrgan?.organ_id ?? null,
        organ_label: focusedOrgan ? organLabel(focusedOrgan) : null,
        session_id: activeSessionId,
        body: trimmedInput,
      });
      if (isSaved) {
        setTextContent("");
        setIsEditorExpanded(false);
      }
    } finally {
      savingLockRef.current = false;
      setIsSavingInProgress(false);
    }
  }

  if (!isEditorExpanded) {
    return (
      <button
        type="button"
        onClick={() => setIsEditorExpanded(true)}
        className="mt-2 w-full rounded border border-dashed border-slate-700 py-1 text-[11px] text-slate-500 hover:border-sky-700 hover:text-sky-300"
      >
        {focusedOrgan ? `Add a note on ${organLabel(focusedOrgan)}` : "Add a note"}
      </button>
    );
  }

  return (
    <div className="mt-2 rounded border border-slate-700 bg-slate-900/60 p-2">
      {focusedOrgan && (
        <p className="mb-1 truncate text-[10px] italic text-sky-300">
          {organLabel(focusedOrgan)}
        </p>
      )}
      <GrowingTextarea
        value={textContent}
        disabled={isSavingInProgress}
        onChange={(event) => setTextContent(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            void handleNoteSubmit();
          }
          if (event.key === "Escape" && !savingLockRef.current) {
            setIsEditorExpanded(false);
          }
        }}
        rows={3}
        autoFocus
        placeholder="What is worth remembering here?"
        className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[12px] outline-none placeholder:text-slate-600 focus:border-sky-600"
      />
      <div className="mt-1 flex items-center gap-2">
        <button
          type="button"
          onClick={() => void handleNoteSubmit()}
          disabled={isSavingInProgress || textContent.trim().length === 0}
          className="rounded bg-sky-600 px-2 py-0.5 text-[10px] font-medium disabled:opacity-30"
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => {
            setTextContent("");
            setIsEditorExpanded(false);
          }}
          disabled={isSavingInProgress}
          className="text-[10px] text-slate-500 hover:text-slate-300"
        >
          Cancel
        </button>
        <span className="ml-auto text-[9px] text-slate-600">Ctrl+Enter</span>
      </div>
    </div>
  );
}

function NoteCard({ note }: { note: StudyNote }) {
  const loadedOrgans = useSceneStore((state) => state.organs);
  const hoverOrgan = useSceneStore((state) => state.setHovered);
  const runSceneCommand = useSceneStore((state) => state.applyCommand);
  const updateOrganFilter = useStudyStore((state) => state.setOrganFilter);
  const modifyNote = useStudyStore((state) => state.editNote);
  const deleteNote = useStudyStore((state) => state.removeNote);

  const [editDraft, setEditDraft] = useState<string | null>(null);
  const [isFullyExpanded, setIsFullyExpanded] = useState(false);
  const noteIsLong = isLongNote(note.body);
  const isTargetOrganLoaded = note.organ_id !== null && note.organ_id in loadedOrgans;

  async function confirmAndDeleteNote() {
    const isApproved = await askToConfirm({
      title: "Delete this note?",
      subject: preview(note.body),
      body:
        "This is your own writing and there is no copy of it anywhere else. " +
        "It cannot be brought back.",
      confirmLabel: "Delete note",
    });
    if (isApproved) {
      await deleteNote(note.id);
    }
  }

  return (
    <div className="group rounded border border-slate-800 bg-slate-900/50 p-2">
      {note.organ_label && (
        <div className="mb-1 flex items-center gap-1">
          <button
            type="button"
            disabled={!isTargetOrganLoaded}
            onMouseEnter={() => isTargetOrganLoaded && hoverOrgan(note.organ_id)}
            onMouseLeave={() => hoverOrgan(null)}
            onClick={() =>
              note.organ_id &&
              runSceneCommand({ action: "focus_organ", organ_id: note.organ_id })
            }
            title={isTargetOrganLoaded ? "Fly to this structure" : "Not loaded right now"}
            className="truncate text-[10px] italic text-sky-300 disabled:text-slate-500"
          >
            {note.organ_label}
          </button>
          {note.organ_id && (
            <button
              type="button"
              onClick={() => void updateOrganFilter(note.organ_id, note.organ_label)}
              title="Show everything filed under this structure"
              className="text-[10px] text-slate-600 hover:text-slate-300"
            >
              ⌕
            </button>
          )}
        </div>
      )}

      {editDraft === null ? (
        <>
          <p
            className={`whitespace-pre-wrap text-[12px] text-slate-300 ${
              noteIsLong && !isFullyExpanded ? "line-clamp-4" : ""
            }`}
          >
            {note.body}
          </p>
          {noteIsLong && (
            <button
              type="button"
              onClick={() => setIsFullyExpanded(!isFullyExpanded)}
              className="mt-0.5 text-[10px] text-slate-500 hover:text-sky-300"
            >
              {isFullyExpanded ? "Show less" : "Show more"}
            </button>
          )}
        </>
      ) : (
        <GrowingTextarea
          value={editDraft}
          onChange={(event) => setEditDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              void modifyNote(note.id, editDraft).then(() => setEditDraft(null));
            }
            if (event.key === "Escape") setEditDraft(null);
          }}
          rows={3}
          autoFocus
          className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[12px] outline-none focus:border-sky-600"
        />
      )}

      <div className="mt-1 flex items-center gap-2 text-[9px] text-slate-600">
        <span>{whenLabel(note.updated_at)}</span>
        <div className="ml-auto flex gap-2 opacity-0 transition group-hover:opacity-100">
          {editDraft === null ? (
            <button
              type="button"
              onClick={() => setEditDraft(note.body)}
              className="hover:text-slate-300"
            >
              Edit
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void modifyNote(note.id, editDraft).then(() => setEditDraft(null))}
              className="text-sky-400 hover:text-sky-300"
            >
              Save
            </button>
          )}
          <button
            type="button"
            onClick={() => void confirmAndDeleteNote()}
            className="hover:text-rose-400"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function SessionRow({ session }: { session: SessionSummary }) {
  const loadStoredSession = useChatStore((state) => state.loadSession);
  const currentActiveSessionId = useChatStore((state) => state.sessionId);
  const selectStructures = useSceneStore((state) => state.selectMany);
  const dropSession = useStudyStore((state) => state.removeSession);
  const openPrintModal = usePrintStore((state) => state.show);
  const casesCollection = useCaseStore((state) => state.cases);
  const [isRowBusy, setIsRowBusy] = useState(false);

  const isCurrentActive = session.id === currentActiveSessionId;
  const linkedPatient = session.case_id
    ? casesCollection.find((item) => item.id === session.case_id)
    : undefined;

  async function handleReopenSession() {
    setIsRowBusy(true);
    try {
      const detailedSession = await getStudySession(session.id);
      if (detailedSession) {
        loadStoredSession(detailedSession);
        selectStructures(detailedSession.structures);
      }
    } catch {
      useStudyStore.setState({ error: "Could not reopen that session." });
    } finally {
      setIsRowBusy(false);
    }
  }

  async function confirmAndDeleteSession() {
    const isApproved = await askToConfirm({
      title: "Delete this session?",
      subject: session.title,
      body:
        `The whole conversation goes — ${session.message_count} messages — along with ` +
        "the record of which structures it covered. Any notes you filed during it stay " +
        "in your journal. It cannot be brought back.",
      confirmLabel: "Delete session",
    });
    if (isApproved) {
      await dropSession(session.id);
    }
  }

  async function handlePrintSession() {
    setIsRowBusy(true);
    try {
      const sessionData = await getStudySession(session.id);
      if (!sessionData) {
        useStudyStore.setState({ error: "That session is no longer in the journal." });
        return;
      }
      const sceneOrgans = useSceneStore.getState().organs;
      openPrintModal(
        buildSessionDocument(sessionData, (organId) => {
          const item = sceneOrgans[organId];
          return item ? organLabel(item) : null;
        }),
      );
    } catch {
      useStudyStore.setState({ error: "Could not prepare that session for printing." });
    } finally {
      setIsRowBusy(false);
    }
  }

  return (
    <div
      className={`group flex items-start gap-2 rounded border px-2 py-1.5 ${
        isCurrentActive
          ? "border-sky-700/60 bg-sky-600/10"
          : "border-slate-800 hover:border-slate-700"
      }`}
    >
      <button
        type="button"
        onClick={() => void handleReopenSession()}
        disabled={isRowBusy || isCurrentActive}
        className="min-w-0 flex-1 text-left"
      >
        <p className="truncate text-[12px] text-slate-300">{session.title}</p>
        <p className="mt-0.5 flex items-center gap-1.5 text-[9px] text-slate-600">
          {linkedPatient ? (
            <span className="truncate rounded-full bg-sky-600/15 px-1 text-sky-300">
              {linkedPatient.title}
              {session.visit_no !== null && ` · visit ${session.visit_no}`}
            </span>
          ) : (
            session.kind === "case" && (
              <span className="rounded-full bg-amber-500/15 px-1 text-amber-300">case</span>
            )
          )}
          <span>{whenLabel(session.updated_at)}</span>
          <span>· {session.message_count} messages</span>
          {session.structure_count > 0 && <span>· {session.structure_count} structures</span>}
        </p>
        {session.score !== null && (
          <p
            title={session.verdict ?? undefined}
            className={`mt-1 truncate text-[10px] font-semibold ${determineScoreColor(session.score)}`}
          >
            {session.score}/100 — {session.verdict}
          </p>
        )}
      </button>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <button
          type="button"
          onClick={() => void confirmAndDeleteSession()}
          title="Delete this session"
          className="text-[10px] text-slate-700 opacity-0 transition hover:text-rose-400 group-hover:opacity-100"
        >
          ✕
        </button>
        <button
          type="button"
          onClick={() => void handlePrintSession()}
          disabled={isRowBusy}
          title="Print this session, or save it as a PDF"
          className="text-[10px] text-slate-700 opacity-0 transition hover:text-sky-300 disabled:opacity-30 group-hover:opacity-100"
        >
          ⎙
        </button>
      </div>
    </div>
  );
}

function VirtualPatientCasesSection({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const registeredCases = useCaseStore((state) => state.cases);
  const reloadCases = useCaseStore((state) => state.refresh);
  const activeQuery = useStudyStore((state) => state.query);

  useEffect(() => {
    void reloadCases();
  }, [reloadCases]);

  if (registeredCases.length === 0) return null;
  const filteredCases = registeredCases.filter((item) => matchesQuery(item, activeQuery));

  return (
    <section>
      <CollapsibleHeader
        label="Virtual patients"
        count={filteredCases.length}
        open={open}
        onToggle={onToggle}
      />
      {open && (
        <>
          {filteredCases.length === 0 && (
            <p className="mt-2 text-[11px] text-slate-600">
              No patient matches that. The notes and sessions below are narrowed too.
            </p>
          )}
          <div className="mt-2 space-y-1">
            {filteredCases.map((caseItem) => (
              <CaseRow key={caseItem.id} entry={caseItem} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function CaseRow({ entry }: { entry: CaseFile }) {
  const dropCase = useCaseStore((state) => state.remove);
  const currentCaseId = useCaseStore((state) => state.activeCaseId);
  const filterByCase = useStudyStore((state) => state.caseFilter);
  const setFilterByCase = useStudyStore((state) => state.setCaseFilter);
  const isCaseFiltered = filterByCase === entry.id;
  const openPrintSheet = usePrintStore((state) => state.show);
  const [isProcessing, setIsProcessing] = useState(false);

  const isSelectedCase = entry.id === currentCaseId;

  async function confirmAndDeleteCase() {
    const isApproved = await askToConfirm({
      title: "Delete this virtual patient?",
      subject: entry.title,
      body:
        `The case goes, along with everything marked on the body — ` +
        `${entry.visit_count === 1 ? "the visit" : `all ${entry.visit_count} visits`} ` +
        "stay in your journal as ordinary sessions, with their transcripts and " +
        "scores. The sealed answer goes with the case. It cannot be brought back.",
      confirmLabel: "Delete patient",
    });
    if (isApproved) {
      await dropCase(entry.id);
    }
  }

  async function handlePrintCase() {
    setIsProcessing(true);
    try {
      const caseRecord = await caseDigest(entry.id);
      if (!caseRecord) {
        useStudyStore.setState({ error: "That case is no longer in the journal." });
        return;
      }

      const sessionsDetailsMap = new Map<string, SessionDetail>();
      const loadedDetails = await Promise.all(
        caseRecord.visits.map((visit) =>
          getStudySession(visit.session_id).catch(() => null),
        ),
      );
      loadedDetails.forEach((res) => {
        if (res) sessionsDetailsMap.set(res.session.id, res);
      });

      const sceneOrgans = useSceneStore.getState().organs;
      openPrintSheet(
        buildCaseDocument(caseRecord, sessionsDetailsMap, (organId) => {
          const item = sceneOrgans[organId];
          return item ? organLabel(item) : null;
        }),
      );
    } catch {
      useStudyStore.setState({ error: "Could not prepare that case for printing." });
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <div
      className={`group flex items-start gap-2 rounded border px-2 py-1.5 ${
        isSelectedCase
          ? "border-sky-700/60 bg-sky-600/10"
          : "border-slate-800 hover:border-slate-700"
      }`}
    >
      <button
        type="button"
        onClick={() => void setFilterByCase(isCaseFiltered ? null : entry.id)}
        title={
          isCaseFiltered
            ? "Show every session again"
            : "Show only this patient's visits below"
        }
        className="min-w-0 flex-1 text-left"
      >
        <p className="truncate text-[12px] text-slate-300">{entry.title}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[9px] text-slate-600">
          <span className="rounded-full bg-slate-700/40 px-1 text-slate-400">
            {entry.sex === "female" ? "female" : "male"}
          </span>
          {entry.age_years !== null && <span>{entry.age_years}y</span>}
          <span>· {visitLabel(entry)}</span>
          <span>· {whenLabel(entry.updated_at)}</span>
          {isCaseFiltered && <span className="text-amber-400">· showing visits</span>}
        </p>
      </button>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <button
          type="button"
          onClick={() => void confirmAndDeleteCase()}
          title="Delete this virtual patient"
          className="text-[10px] text-slate-700 opacity-0 transition hover:text-rose-400 group-hover:opacity-100"
        >
          ✕
        </button>
        <button
          type="button"
          onClick={() => void handlePrintCase()}
          disabled={isProcessing}
          title="Print the whole history, or save it as a PDF — includes the sealed answer"
          className="text-[10px] text-slate-700 opacity-0 transition hover:text-sky-300 disabled:opacity-30 group-hover:opacity-100"
        >
          ⎙
        </button>
      </div>
    </div>
  );
}

/**
 * Condensed single-line preview of a note suitable for confirmation dialog headers.
 */
export function preview(bodyText: string, limitChars = 140): string {
  const normalized = bodyText.replace(/\s+/g, " ").trim();
  return normalized.length <= limitChars ? normalized : `${normalized.slice(0, limitChars - 1)}…`;
}

/** Default maximum lines displayed before clamp applies in study cards. */
export const NOTE_CLAMP_LINES = 4;

const ESTIMATED_CHARS_PER_LINE = 55;

/**
 * Determines whether note content length or line breaks require folding with a 'Show more' action.
 */
export function isLongNote(bodyText: string, thresholdLines = NOTE_CLAMP_LINES): boolean {
  const lineCount = bodyText
    .split("\n")
    .reduce((total, line) => total + Math.max(1, Math.ceil(line.length / ESTIMATED_CHARS_PER_LINE)), 0);
  return lineCount > thresholdLines;
}

function determineScoreColor(scoreVal: number): string {
  if (scoreVal >= 71) return "text-emerald-400";
  if (scoreVal >= 41) return "text-amber-400";
  return "text-rose-400";
}
