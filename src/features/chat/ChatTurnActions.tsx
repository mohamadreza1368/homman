import { useState } from "react";
import type { SceneCommand } from "@/lib/schemas";
import { useChatStore } from "@/stores/chatStore";
import { useInterfaceLanguage } from "@/stores/interfaceLanguage";
import { organLabel, useSceneStore } from "@/stores/sceneStore";
import { useStudyStore } from "@/stores/studyStore";
import { collectOrganRefs, stripOrganRefs } from "./organRefs";
import { useCopy } from "./useCopy";

/**
 * Clipboard copy trigger with localized confirmation feedback.
 */
export function CopyButton({ text, label }: { text: string; label?: string }) {
  const isPersian = useInterfaceLanguage((state) => state.language === "fa");
  const { copied, copy } = useCopy();
  const idleCaption = label ?? (isPersian ? "کپی" : "Copy");

  return (
    <button
      type="button"
      onClick={() => void copy(text)}
      className="rounded border border-slate-700 px-1.5 py-0.5 text-[10px] text-slate-400 transition hover:border-slate-600 hover:text-slate-200"
    >
      {copied ? (isPersian ? "کپی شد" : "Copied") : idleCaption}
    </button>
  );
}

/**
 * Restores 3D camera and system visibility state corresponding to an assistant answer.
 */
export function RestoreViewButton({ commands }: { commands: SceneCommand[] }) {
  const isPersian = useInterfaceLanguage((state) => state.language === "fa");
  const executeCommand = useSceneStore((state) => state.applyCommand);
  if (commands.length === 0) return null;

  const handleReplayScene = () => {
    for (const step of commands) {
      executeCommand(step);
    }
  };

  return (
    <button
      type="button"
      onClick={handleReplayScene}
      title={isPersian ? "برگرداندن مدل به نمای زمان این پاسخ" : "Put the model back the way this answer left it"}
      className="rounded border border-slate-700 px-1.5 py-0.5 text-[10px] text-slate-400 transition hover:border-sky-600 hover:text-sky-200"
    >
      {isPersian ? "بازیابی این نما" : "Restore this view"}
    </button>
  );
}

/**
 * Renders interactive badges for referenced anatomical structures beneath assistant prose.
 */
export function ReferenceLegend({ content }: { content: string }) {
  const loadedOrgans = useSceneStore((state) => state.organs);
  const highlightOrgan = useSceneStore((state) => state.setHovered);
  const targetOrganReference = useSceneStore((state) => state.focusReference);

  const matchedReferences = collectOrganRefs(content, (id) => id in loadedOrgans);
  if (matchedReferences.length === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-1 border-t border-slate-800/70 pt-2">
      {matchedReferences.map((refItem) => {
        const itemData = loadedOrgans[refItem.organId];
        if (!itemData) return null;
        return (
          <button
            key={refItem.organId}
            type="button"
            onMouseEnter={() => highlightOrgan(refItem.organId)}
            onMouseLeave={() => highlightOrgan(null)}
            onClick={() => targetOrganReference(refItem.organId, refItem.index)}
            className="flex items-center gap-1 rounded border border-slate-700/80 px-1.5 py-0.5 text-[10px] text-slate-400 transition hover:border-sky-600 hover:text-sky-200"
          >
            <span className="flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-sky-500/20 px-0.5 text-[8px] font-semibold text-sky-300">
              {refItem.index}
            </span>
            <span className="italic">{organLabel(itemData)}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Displays graded score badge for clinical drill answers.
 */
export function ScoreBadge({ score }: { score: number }) {
  const toneClasses =
    score >= 71
      ? "bg-emerald-500/15 text-emerald-300"
      : score >= 41
        ? "bg-amber-500/15 text-amber-300"
        : "bg-rose-500/15 text-rose-300";

  return (
    <span className={`mb-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${toneClasses}`}>
      {score}/100 · saved to your journal
    </span>
  );
}

/**
 * Saves assistant answer text to student study journal.
 */
export function SaveAsNoteButton({ content }: { content: string }) {
  const isPersian = useInterfaceLanguage((state) => state.language === "fa");
  const availableOrgans = useSceneStore((state) => state.organs);
  const activeOrganSelection = useSceneStore((state) => state.selectedOrganIds);
  const currentSessionId = useChatStore((state) => state.sessionId);
  const appendNoteToStudy = useStudyStore((state) => state.addNote);
  const [hasSaved, setHasSaved] = useState(false);

  const primarySelectedOrgan = activeOrganSelection[0] ? availableOrgans[activeOrganSelection[0]] : undefined;

  const handleStoreNote = () => {
    setHasSaved(true);
    void appendNoteToStudy({
      organ_id: primarySelectedOrgan?.organ_id ?? null,
      organ_label: primarySelectedOrgan ? organLabel(primarySelectedOrgan) : null,
      session_id: currentSessionId,
      body: stripOrganRefs(content),
    });
  };

  return (
    <button
      type="button"
      onClick={handleStoreNote}
      title={primarySelectedOrgan ? `Save as a note on ${organLabel(primarySelectedOrgan)}` : "Save as a note"}
      className="rounded border border-slate-700 px-1.5 py-0.5 text-[10px] text-slate-400 transition hover:border-slate-600 hover:text-slate-200"
    >
      {hasSaved ? (isPersian ? "ذخیره شد" : "Saved") : isPersian ? "ذخیره در یادداشت" : "Save as note"}
    </button>
  );
}
