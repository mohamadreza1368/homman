import type { AnatomicalStructure } from '../types/anatomy';
import { Activity, ShieldAlert, Eye, RotateCcw, X } from 'lucide-react';

interface Props {
  structure: AnatomicalStructure | null;
  onClose: () => void;
  onIsolate?: (fmaId: string) => void;
  onOpenPathology?: () => void;
  onOpenPhysiology?: () => void;
  onReset?: () => void;
}

export function StructureDetailsCard({
  structure,
  onClose,
  onIsolate,
  onOpenPathology,
  onOpenPhysiology,
  onReset
}: Props) {
  if (!structure) {
    return (
      <div
        className="absolute top-16 right-6 z-30 w-80 bg-slate-950/85 backdrop-blur-xl border border-slate-800/80 rounded-2xl shadow-2xl p-4 text-slate-100 flex flex-col gap-2 select-none"
        dir="ltr"
      >
        <div className="flex items-center justify-between pb-2 border-b border-slate-800/60">
          <span className="text-xs font-semibold text-slate-300">Structure: None Selected</span>
        </div>
        <div className="text-[11px] text-slate-400 py-2">
          Click on any organ, muscle, bone, or leader-line callout to view clinical anatomy intelligence and simulate pathophysiological disorders.
        </div>
        <div className="text-[10px] text-sky-400 bg-sky-950/40 border border-sky-800/50 rounded-lg p-2">
          Tip: You can click the &ldquo;Cerebrum&rdquo;, &ldquo;Heart&rdquo;, or &ldquo;Left Kidney&rdquo; callouts to inspect their 3D structure.
        </div>
      </div>
    );
  }

  return (
    <div
      className="absolute top-16 right-6 z-30 w-84 bg-slate-950/90 backdrop-blur-xl border border-slate-800/90 rounded-2xl shadow-2xl p-4 text-slate-100 flex flex-col gap-3 select-none"
      dir="ltr"
    >
      {/* Title & Close */}
      <div className="flex items-start justify-between pb-2 border-b border-slate-800/70">
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-wider text-sky-400 font-semibold">
            Structure Details
          </span>
          <h3 className="text-sm font-bold text-white tracking-wide">{structure.nameEn}</h3>
          <span className="text-[11px] text-slate-400 font-medium">{structure.nameFa}</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Info Section */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Info</span>
        <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/50">
          {structure.descriptionEn || `${structure.nameEn} is a core anatomical structure in the ${structure.systemCategory} system.`}
        </p>
      </div>

      {/* Metadata Badges */}
      <div className="grid grid-cols-2 gap-2 text-[10px]">
        <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800 flex flex-col">
          <span className="text-slate-400">FMA Identifier:</span>
          <span className="font-mono text-sky-300 font-semibold">{structure.fmaId}</span>
        </div>
        <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800 flex flex-col">
          <span className="text-slate-400">System Category:</span>
          <span className="font-medium text-emerald-300">{structure.systemCategory}</span>
        </div>
      </div>

      {/* Interactive Action Buttons */}
      <div className="pt-2 border-t border-slate-800/60 flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-2">
          {onIsolate && (
            <button
              onClick={() => onIsolate(structure.fmaId)}
              className="flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 font-medium border border-slate-700 transition"
            >
              <Eye className="w-3.5 h-3.5 text-sky-400" />
              <span>ایزوله (Isolate)</span>
            </button>
          )}

          {onReset && (
            <button
              onClick={onReset}
              className="flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 font-medium border border-slate-700 transition"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
              <span>ریست نما</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {onOpenPathology && (
            <button
              onClick={onOpenPathology}
              className="flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg bg-rose-950/70 hover:bg-rose-900/80 text-xs text-rose-200 font-medium border border-rose-800/60 transition"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
              <span>شبیه‌ساز بیماری</span>
            </button>
          )}

          {onOpenPhysiology && (
            <button
              onClick={onOpenPhysiology}
              className="flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg bg-sky-950/70 hover:bg-sky-900/80 text-xs text-sky-200 font-medium border border-sky-800/60 transition"
            >
              <Activity className="w-3.5 h-3.5 text-sky-400" />
              <span>فیزیولوژی زنده</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
