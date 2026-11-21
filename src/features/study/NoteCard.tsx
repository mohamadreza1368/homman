import { useState } from "react";
import { GrowingTextarea } from "@/components/GrowingTextarea";
import type { StudyNote } from "@/lib/studyDb";
import { askToConfirm } from "@/stores/confirmStore";
import { useSceneStore } from "@/stores/sceneStore";
import { useStudyStore } from "@/stores/studyStore";
import { isLongNote, preview } from "./studyUtils";
import { whenLabel } from "./whenLabel";

export function NoteCard({ note }: { note: StudyNote }) {
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
