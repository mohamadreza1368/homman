import { memo } from "react";
import { Markdown } from "@/features/chat/Markdown";
import type { Memory } from "./memories";
import type { MemoryInspectionState } from "./memoryLabUtils";

export interface MemoryReaderProps {
  memory: Memory;
  reading: MemoryInspectionState | null;
  wide: boolean;
  holding: boolean;
  onToggleWide: () => void;
  onClose: (key: null) => void;
  onHoldStart: () => void;
  onHoldEnd: () => void;
  onHoldDone: (key: string) => void;
}

const CATEGORY_NAMES = {
  session: "جلسه گفتگو با هوش مصنوعی",
  case: "شبیه‌سازی بیمار مجازی",
  note: "یادداشت بالینی کاربر",
} as const;

/**
 * Spatial Memory Reader & Detailed Viewer.
 * Displays content, markdown notes, structure tags, and hold-to-erase safety action.
 */
export const MemoryReader = memo(function MemoryReader({
  memory,
  wide,
  holding,
  onToggleWide,
  onClose,
  onHoldStart,
  onHoldEnd,
  onHoldDone,
}: MemoryReaderProps) {
  return (
    <article
      className={`flex flex-col border border-slate-800 bg-slate-950/90 text-slate-100 shadow-2xl rounded-2xl transition-all ${
        wide ? "fixed inset-8 z-50 p-6" : "w-80 h-full p-4"
      }`}
    >
      {/* Top Header */}
      <header className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex flex-col">
          <span className="text-[10px] font-medium text-sky-400 uppercase tracking-wider">
            {CATEGORY_NAMES[memory.kind]}
          </span>
          <span className="text-[11px] text-slate-500 font-mono mt-0.5">
            {new Date(memory.at).toLocaleString()}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleWide}
            className="rounded p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
            title={wide ? "حالت استاندارد" : "حالت تمام‌صفحه"}
          >
            {wide ? "⤡" : "⤢"}
          </button>
          <button
            type="button"
            onClick={() => onClose(null)}
            className="rounded p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
            title="بستن"
          >
            ✕
          </button>
        </div>
      </header>

      {/* Title */}
      <h3 className="text-sm font-semibold text-slate-100 mt-3">{memory.title}</h3>

      {/* Content Body */}
      <div className="flex-1 overflow-y-auto mt-3 pr-1 text-xs text-slate-300 leading-relaxed space-y-2">
        <Markdown>{memory.title}</Markdown>
      </div>

      {/* Footer & Erase Action */}
      <footer className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
        <button
          type="button"
          onMouseDown={onHoldStart}
          onMouseUp={onHoldEnd}
          onMouseLeave={onHoldEnd}
          onTouchStart={onHoldStart}
          onTouchEnd={onHoldEnd}
          onClick={() => onHoldDone(memory.key)}
          className={`relative overflow-hidden rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
            holding
              ? "bg-rose-700 text-white ring-2 ring-rose-500"
              : "bg-rose-950/40 text-rose-300 border border-rose-800/50 hover:bg-rose-900/40"
          }`}
        >
          {holding ? "در حال حذف..." : "نگه‌داشتن جهت پاکسازی"}
        </button>

        <span className="text-[10px] text-slate-500 font-mono">ID: {memory.key.slice(0, 8)}</span>
      </footer>
    </article>
  );
});
