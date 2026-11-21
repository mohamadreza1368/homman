import { usePrintStore } from "@/stores/printStore";
import { useStudyStore } from "@/stores/studyStore";
import { buildNotesDocument, journalLanguage } from "./printDocument";

export function PrintNotesAction() {
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
