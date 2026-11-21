import { useState, useCallback } from "react";
import { getStudySession, type SessionSummary } from "@/lib/studyDb";
import { useCaseStore } from "@/stores/caseStore";
import { useChatStore } from "@/stores/chatStore";
import { askToConfirm } from "@/stores/confirmStore";
import { usePrintStore } from "@/stores/printStore";
import { organLabel, useSceneStore } from "@/stores/sceneStore";
import { useStudyStore } from "@/stores/studyStore";
import { buildSessionDocument } from "./printDocument";
import { whenLabel } from "./whenLabel";

interface SessionRowProps {
  session: SessionSummary;
}

/**
 * Historical study session entry row.
 * Displays dialogue turn count, clinical scores, and actions to resume, print, or delete.
 */
export function SessionRow({ session }: SessionRowProps) {
  const currentSessionId = useChatStore((s) => s.sessionId);
  const restoreSession = useChatStore((s) => s.loadSession);

  const selectOrgansInScene = useSceneStore((s) => s.selectMany);
  const deleteSessionFromDb = useStudyStore((s) => s.removeSession);
  const triggerPrintModal = usePrintStore((s) => s.show);

  const casesList = useCaseStore((s) => s.cases);
  const [isProcessing, setIsProcessing] = useState(false);

  const isActive = session.id === currentSessionId;
  const patientCase = session.case_id
    ? casesList.find((c) => c.id === session.case_id)
    : null;

  const handleResume = useCallback(async () => {
    setIsProcessing(true);
    try {
      const detail = await getStudySession(session.id);
      if (detail) {
        restoreSession(detail);
        selectOrgansInScene(detail.structures);
      }
    } catch {
      useStudyStore.setState({ error: "خطا در بارگذاری مجدد جلسه مطالعه." });
    } finally {
      setIsProcessing(false);
    }
  }, [session.id, restoreSession, selectOrgansInScene]);

  const handlePrint = useCallback(async () => {
    setIsProcessing(true);
    try {
      const detail = await getStudySession(session.id);
      if (!detail) return;

      const organs = useSceneStore.getState().organs;
      const documentData = buildSessionDocument(
        detail,
        (id: string) => (organs[id] ? organLabel(organs[id]) : id),
      );
      triggerPrintModal(documentData);
    } finally {
      setIsProcessing(false);
    }
  }, [session.id, patientCase, triggerPrintModal]);

  const handleDelete = useCallback(async () => {
    const isConfirmed = await askToConfirm({
      title: "حذف جلسه مطالعه",
      subject: session.title,
      body: `این گفتگو (${session.message_count} پیام) و ساختارهای ثبت‌شده در آن برای همیشه حذف خواهند شد. آیا ادامه می‌دهید؟`,
      confirmLabel: "حذف جلسه",
    });

    if (isConfirmed) {
      await deleteSessionFromDb(session.id);
    }
  }, [session.id, session.title, session.message_count, deleteSessionFromDb]);

  return (
    <div
      className={`rounded-lg border p-2.5 text-xs transition-colors ${
        isActive
          ? "border-emerald-500/50 bg-emerald-950/20"
          : "border-slate-800/80 bg-slate-900/40 hover:border-slate-700/70"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <button
            type="button"
            disabled={isProcessing}
            onClick={handleResume}
            className="font-medium text-slate-200 hover:text-sky-300 transition-colors text-right"
          >
            {session.title || "جلسه مطالعه بدون عنوان"}
          </button>
          <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-400">
            <span>{session.message_count} پیام</span>
            <span>•</span>
            <span>{whenLabel(session.updated_at)}</span>
            {patientCase && (
              <>
                <span>•</span>
                <span className="text-sky-400/90">{patientCase.title}</span>
              </>
            )}
          </div>
        </div>

        {session.score !== null && (
          <div
            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
              session.score >= 80
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                : session.score >= 50
                  ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                  : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
            }`}
          >
            نمره: {session.score}٪
          </div>
        )}
      </div>

      <div className="mt-2.5 flex items-center justify-between border-t border-slate-800/50 pt-2 text-[10px] text-slate-500">
        <button
          type="button"
          disabled={isProcessing}
          onClick={handlePrint}
          className="hover:text-slate-300 disabled:opacity-40 transition-colors"
        >
          چاپ و خروجی
        </button>

        <button
          type="button"
          onClick={handleDelete}
          className="text-rose-400/80 hover:text-rose-300 transition-colors"
        >
          حذف
        </button>
      </div>
    </div>
  );
}
