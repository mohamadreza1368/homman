import { useState, useCallback } from "react";
import { GrowingTextarea } from "@/components/GrowingTextarea";
import type { StudyNote } from "@/lib/studyDb";
import { askToConfirm } from "@/stores/confirmStore";
import { useSceneStore } from "@/stores/sceneStore";
import { useStudyStore } from "@/stores/studyStore";
import { whenLabel } from "./whenLabel";

interface NoteCardProps {
  note: StudyNote;
}

/**
 * Educational clinical note item card.
 * Enables in-place editing, spatial 3D viewport navigation, and deletion.
 */
export function NoteCard({ note }: NoteCardProps) {
  const [editingContent, setEditingContent] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const sceneOrgans = useSceneStore((s) => s.organs);
  const setHoveredOrgan = useSceneStore((s) => s.setHovered);
  const dispatchCommand = useSceneStore((s) => s.applyCommand);

  const editNoteInStore = useStudyStore((s) => s.editNote);
  const removeNoteFromStore = useStudyStore((s) => s.removeNote);
  const setFilter = useStudyStore((s) => s.setOrganFilter);

  const isStructureAvailable = Boolean(note.organ_id && note.organ_id in sceneOrgans);
  const isLong = note.body.length > 240;

  const handleFocusOrgan = useCallback(() => {
    if (note.organ_id && isStructureAvailable) {
      dispatchCommand({ action: "focus_organ", organ_id: note.organ_id });
    }
  }, [note.organ_id, isStructureAvailable, dispatchCommand]);

  const handleDelete = useCallback(async () => {
    const confirmed = await askToConfirm({
      title: "حذف یادداشت آموزشی",
      subject: note.body.slice(0, 60),
      body: "این یادداشت اختصاصی شماست و امکان بازیابی آن وجود ندارد. آیا از حذف اطمینان دارید؟",
      confirmLabel: "حذف یادداشت",
    });

    if (confirmed) {
      await removeNoteFromStore(note.id);
    }
  }, [note.id, note.body, removeNoteFromStore]);

  const handleSaveEdit = useCallback(async () => {
    if (editingContent !== null && editingContent.trim() !== "") {
      await editNoteInStore(note.id, editingContent.trim());
      setEditingContent(null);
    }
  }, [note.id, editingContent, editNoteInStore]);

  return (
    <article className="rounded-xl border border-slate-800/90 bg-slate-900/60 p-3 transition hover:border-slate-700/80">
      {/* Structure Header & Link */}
      {note.organ_label && (
        <div className="mb-2 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={!isStructureAvailable}
              onClick={handleFocusOrgan}
              onMouseEnter={() => isStructureAvailable && setHoveredOrgan(note.organ_id)}
              onMouseLeave={() => setHoveredOrgan(null)}
              className="font-medium text-sky-400 hover:text-sky-300 disabled:text-slate-500 transition-colors"
            >
              {note.organ_label}
            </button>
            {note.organ_id && (
              <button
                type="button"
                onClick={() => void setFilter(note.organ_id, note.organ_label)}
                className="text-[10px] text-slate-500 hover:text-slate-300"
                title="فیلتر یادداشت‌های این عضو"
              >
                (فیلتر)
              </button>
            )}
          </div>
          <span className="text-[10px] text-slate-500">{whenLabel(note.updated_at)}</span>
        </div>
      )}

      {/* Note Body or Editor */}
      {editingContent !== null ? (
        <div className="space-y-2 mt-1">
          <GrowingTextarea
            value={editingContent}
            onChange={(e) => setEditingContent(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditingContent(null)}
              className="px-2.5 py-1 text-[11px] text-slate-400 hover:text-slate-200"
            >
              انصراف
            </button>
            <button
              type="button"
              onClick={handleSaveEdit}
              className="rounded bg-sky-600 px-3 py-1 text-[11px] font-medium text-white hover:bg-sky-500"
            >
              ذخیره تغییرات
            </button>
          </div>
        </div>
      ) : (
        <div className="text-xs text-slate-300 leading-relaxed">
          <p className="whitespace-pre-wrap">
            {isLong && !isExpanded ? `${note.body.slice(0, 240)}...` : note.body}
          </p>
          {isLong && (
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="mt-1 text-[10px] text-sky-400 hover:underline"
            >
              {isExpanded ? "نمایش کمتر" : "ادامه متن..."}
            </button>
          )}
        </div>
      )}

      {/* Actions Toolbar */}
      {editingContent === null && (
        <footer className="mt-3 flex items-center justify-between border-t border-slate-800/60 pt-2 text-[10px] text-slate-500">
          {!note.organ_label && <span>{whenLabel(note.updated_at)}</span>}
          <div className="flex items-center gap-2 mr-auto">
            <button
              type="button"
              onClick={() => setEditingContent(note.body)}
              className="hover:text-slate-300 transition-colors"
            >
              ویرایش
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="text-rose-400/80 hover:text-rose-300 transition-colors"
            >
              حذف
            </button>
          </div>
        </footer>
      )}
    </article>
  );
}
