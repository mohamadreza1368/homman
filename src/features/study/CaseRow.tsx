import { useEffect, useState, useCallback } from "react";
import { caseDigest, getStudySession, type CaseFile, type SessionDetail } from "@/lib/studyDb";
import { matchesQuery, useCaseStore, visitLabel } from "@/stores/caseStore";
import { askToConfirm } from "@/stores/confirmStore";
import { usePrintStore } from "@/stores/printStore";
import { organLabel, useSceneStore } from "@/stores/sceneStore";
import { useStudyStore } from "@/stores/studyStore";
import { CollapsibleHeader } from "./CollapsibleHeader";
import { buildCaseDocument } from "./printDocument";
import { whenLabel } from "./whenLabel";

interface CasesSectionProps {
  open: boolean;
  onToggle: () => void;
}

/**
 * Collapsible section displaying simulated virtual patient cases and history.
 */
export function VirtualPatientCasesSection({ open, onToggle }: CasesSectionProps) {
  const patientCases = useCaseStore((s) => s.cases);
  const reload = useCaseStore((s) => s.refresh);
  const searchFilter = useStudyStore((s) => s.query);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (patientCases.length === 0) return null;

  const visibleCases = patientCases.filter((c) => matchesQuery(c, searchFilter));

  return (
    <section className="space-y-2">
      <CollapsibleHeader
        label="بیماران مجازی (Virtual Patients)"
        count={visibleCases.length}
        open={open}
        onToggle={onToggle}
      />

      {open && (
        <div className="space-y-1.5 pt-1">
          {visibleCases.length === 0 ? (
            <p className="text-[11px] text-slate-500 italic p-2">
              موردی منطبق با جستجو یافت نشد.
            </p>
          ) : (
            visibleCases.map((c) => <CaseRow key={c.id} entry={c} />)
          )}
        </div>
      )}
    </section>
  );
}

interface CaseRowProps {
  entry: CaseFile;
}

export function CaseRow({ entry }: CaseRowProps) {
  const activeCaseId = useCaseStore((s) => s.activeCaseId);
  const removeCase = useCaseStore((s) => s.remove);

  const selectedCaseFilter = useStudyStore((s) => s.caseFilter);
  const setCaseFilter = useStudyStore((s) => s.setCaseFilter);
  const openPrint = usePrintStore((s) => s.show);

  const [isLoadingDigest, setIsLoadingDigest] = useState(false);

  const isCurrentActive = entry.id === activeCaseId;
  const isFilterActive = selectedCaseFilter === entry.id;

  const handleToggleFilter = useCallback(() => {
    if (isFilterActive) {
      setCaseFilter(null);
    } else {
      setCaseFilter(entry.id);
    }
  }, [entry.id, isFilterActive, setCaseFilter]);

  const handlePrintSummary = useCallback(async () => {
    setIsLoadingDigest(true);
    try {
      const digest = await caseDigest(entry.id);
      if (!digest) return;

      const sessionMap = new Map<string, SessionDetail>();
      for (const v of digest.visits) {
        if (v.session_id) {
          const detail = await getStudySession(v.session_id);
          if (detail) sessionMap.set(v.session_id, detail);
        }
      }

      const allOrgans = useSceneStore.getState().organs;
      const doc = buildCaseDocument(
        digest,
        sessionMap,
        (id) => (allOrgans[id] ? organLabel(allOrgans[id]) : id),
      );
      openPrint(doc);
    } finally {
      setIsLoadingDigest(false);
    }
  }, [entry.id, openPrint]);

  const handleDelete = useCallback(async () => {
    const approved = await askToConfirm({
      title: "حذف پرونده بالینی",
      subject: entry.title,
      body: "تمامی سوابق گفتگو و پیشرفت این بیمار مجازی پاک خواهد شد. آیا مطمئن هستید؟",
      confirmLabel: "حذف پرونده",
    });

    if (approved) {
      await removeCase(entry.id);
    }
  }, [entry.id, entry.title, removeCase]);

  return (
    <div
      className={`rounded-lg border p-2.5 transition-colors text-xs ${
        isCurrentActive
          ? "border-sky-500/50 bg-sky-950/20"
          : "border-slate-800/80 bg-slate-900/40 hover:border-slate-700/70"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h4 className="font-medium text-slate-200">{entry.title}</h4>
          <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-400">
            <span className="capitalize">{entry.profile}</span>
            <span>•</span>
            <span>{visitLabel(entry)}</span>
            <span>•</span>
            <span>{whenLabel(entry.updated_at)}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleToggleFilter}
          className={`rounded px-2 py-0.5 text-[10px] font-medium transition ${
            isFilterActive
              ? "bg-sky-500/20 text-sky-300 border border-sky-500/30"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          }`}
        >
          {isFilterActive ? "فیلتر فعال" : "فیلتر جلسات"}
        </button>
      </div>

      <div className="mt-2.5 flex items-center justify-between border-t border-slate-800/50 pt-2 text-[10px] text-slate-500">
        <button
          type="button"
          disabled={isLoadingDigest}
          onClick={handlePrintSummary}
          className="hover:text-slate-300 disabled:opacity-40"
        >
          {isLoadingDigest ? "در حال دریافت خلاصه..." : "چاپ / خروجی پرونده"}
        </button>

        <button
          type="button"
          onClick={handleDelete}
          className="text-rose-400/80 hover:text-rose-300"
        >
          حذف
        </button>
      </div>
    </div>
  );
}
