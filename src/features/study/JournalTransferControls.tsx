import { useState } from "react";
import { useStudyStore } from "@/stores/studyStore";
import { CollapsibleHeader } from "./CollapsibleHeader";

export function JournalTransferControls() {
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
