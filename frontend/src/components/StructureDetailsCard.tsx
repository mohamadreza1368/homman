import type { AnatomicalStructure } from '../types/anatomy';
import { Activity, ShieldAlert, Eye, RotateCcw, Info } from 'lucide-react';
import { DraggablePanel } from './DraggablePanel';

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
  onReset,
}: Props) {
  const initialX = typeof window !== 'undefined' ? Math.max(300, window.innerWidth - 370) : 800;

  if (!structure) {
    return (
      <DraggablePanel
        id="structure-details-empty"
        title="Structure Details"
        icon={<Info className="w-4 h-4 text-slate-400" />}
        initialPos={{ x: initialX, y: 70 }}
        width="w-84"
        onClose={onClose}
      >
        <div className="flex flex-col gap-2.5 text-slate-100">
          <div className="text-xs font-semibold text-slate-300">
            هیچ عضوی انتخاب نشده است (None Selected)
          </div>
          <div className="text-[11px] text-slate-400 leading-relaxed">
            روی هر عضو، عضله، استخوان، ارگان یا خطوط راهنمای سه‌بعدی کلیک کنید تا اطلاعات کالبدی و گراف بیماری‌های بالینی آن باز شود.
          </div>
          <div className="text-[10px] text-sky-400 bg-sky-950/40 border border-sky-800/50 rounded-lg p-2.5 leading-relaxed">
            💡 راهنما: می‌توانید روی برچسب‌های «قلب»، «کلیه چپ»، یا «مغز» کلیک کنید تا ساختار سه‌بعدی آن‌ها فعال شود. همچنین کلیک روی پس‌زمینه خالی، انتخاب را ریست می‌کند.
          </div>
        </div>
      </DraggablePanel>
    );
  }

  return (
    <DraggablePanel
      id="structure-details-active"
      title={structure.nameEn}
      icon={<Activity className="w-4 h-4 text-sky-400" />}
      initialPos={{ x: initialX, y: 70 }}
      width="w-84"
      onClose={onClose}
    >
      <div className="flex flex-col gap-3">
        {/* Persian Title Subheading */}
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-wider text-sky-400 font-semibold">
            {structure.systemCategory} SYSTEM
          </span>
          <span className="text-sm font-bold text-white tracking-wide">{structure.nameFa}</span>
        </div>

        {/* Info Section */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            مشخصات کالبدی
          </span>
          <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/50">
            {structure.descriptionFa || structure.descriptionEn || `${structure.nameEn} عضو تشریحی تاییدشده در سیستم ${structure.systemCategory}.`}
          </p>
        </div>

        {/* Metadata Badges */}
        <div className="grid grid-cols-2 gap-2 text-[10px]">
          <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800 flex flex-col">
            <span className="text-slate-400">شناسه FMA:</span>
            <span className="font-mono text-sky-300 font-semibold">{structure.fmaId}</span>
          </div>
          <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800 flex flex-col">
            <span className="text-slate-400">سیستم آناتومی:</span>
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
    </DraggablePanel>
  );
}
