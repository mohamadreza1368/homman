import { useState } from "react";
import { getStudySession, type SessionSummary } from "@/lib/studyDb";
import { useCaseStore } from "@/stores/caseStore";
import { useChatStore } from "@/stores/chatStore";
import { askToConfirm } from "@/stores/confirmStore";
import { usePrintStore } from "@/stores/printStore";
import { organLabel, useSceneStore } from "@/stores/sceneStore";
import { useStudyStore } from "@/stores/studyStore";
import { buildSessionDocument } from "./printDocument";
import { determineScoreColor } from "./studyUtils";
import { whenLabel } from "./whenLabel";

export function SessionRow({ session }: { session: SessionSummary }) {
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
