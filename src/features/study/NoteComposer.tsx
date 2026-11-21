import { useRef, useState } from "react";
import { GrowingTextarea } from "@/components/GrowingTextarea";
import { useChatStore } from "@/stores/chatStore";
import { organLabel, useSceneStore } from "@/stores/sceneStore";
import { useStudyStore } from "@/stores/studyStore";

export function NoteComposer() {
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
