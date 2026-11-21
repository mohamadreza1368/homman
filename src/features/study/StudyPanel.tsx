import { useEffect, useState } from "react";
import { useCaseStore } from "@/stores/caseStore";
import { useInterfaceLanguage } from "@/stores/interfaceLanguage";
import { useStudyStore } from "@/stores/studyStore";
import { VirtualPatientCasesSection } from "./CaseRow";
import { CollapsibleHeader } from "./CollapsibleHeader";
import { JournalTransferControls } from "./JournalTransferControls";
import { NoteCard } from "./NoteCard";
import { NoteComposer } from "./NoteComposer";
import { PrintNotesAction } from "./PrintNotesAction";
import { foldStateFor, type StudySection } from "./sections";
import { SessionRow } from "./SessionRow";
import { StudyStatsOverview } from "./StudyStatsOverview";

export { preview, isLongNote, NOTE_CLAMP_LINES } from "./studyUtils";

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
