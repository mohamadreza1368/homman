import { useEffect, useState } from "react";
import { caseDigest, getStudySession, type CaseFile, type SessionDetail } from "@/lib/studyDb";
import { matchesQuery, useCaseStore, visitLabel } from "@/stores/caseStore";
import { askToConfirm } from "@/stores/confirmStore";
import { usePrintStore } from "@/stores/printStore";
import { organLabel, useSceneStore } from "@/stores/sceneStore";
import { useStudyStore } from "@/stores/studyStore";
import { CollapsibleHeader } from "./CollapsibleHeader";
import { buildCaseDocument } from "./printDocument";
import { whenLabel } from "./whenLabel";

export function VirtualPatientCasesSection({ open, onToggle }: { open: boolean; onToggle: () => void }) {
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

export function CaseRow({ entry }: { entry: CaseFile }) {
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
