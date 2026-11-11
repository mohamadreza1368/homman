import type { AnatomicalStructure } from '../types/anatomy';
import { Activity, BookOpen, Eye, RotateCcw, Info, AlertCircle } from 'lucide-react';
import { DraggablePanel } from './DraggablePanel';

interface Props {
  structure: AnatomicalStructure | null;
  onClose: () => void;
  onIsolate?: (recordId: string) => void;
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
        title="مشخصات ساختار (Structure Details)"
        icon={<Info className="w-4 h-4 text-slate-400" />}
        initialPos={{ x: initialX, y: 70 }}
        width="w-84"
        onClose={onClose}
      >
        <div className="flex flex-col gap-2.5 text-slate-100" dir="rtl">
          <div className="text-xs font-semibold text-slate-300">
            هیچ ساختاری انتخاب نشده است (None Selected)
          </div>
          <div className="text-[11px] text-slate-400 leading-relaxed">
            روی هر عضو، عضله، استخوان یا برچسب راهنمای سه‌بعدی کلیک کنید یا از نوار بالا جست‌وجو نمایید تا شناسنامه مرجع و نمایش آموزشی مرتبط نمایش داده شود.
          </div>
          <div className="text-[10px] text-sky-400 bg-sky-950/40 border border-sky-800/50 rounded-lg p-2.5 leading-relaxed">
            راهنما: استفاده از این اطلس صرفاً برای مرور آموزشی ساختارهای تشریحی است.
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
      <div className="flex flex-col gap-3" data-testid="structure-details-card" dir="rtl">
        {/* Title & Status Pill */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] uppercase tracking-wider text-sky-400 font-semibold">
              {structure.systemCategory}
            </span>
            <span
              className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                structure.contentStatus === 'reference'
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
              }`}
            >
              {structure.contentStatus}
            </span>
          </div>
          <span className="text-sm font-bold text-white tracking-wide" data-testid="structure-name-fa">
            {structure.nameFa}
          </span>
          <span className="text-[10px] text-slate-400 font-mono" dir="ltr">
            ID: {structure.recordId}
          </span>
        </div>

        {/* Info Section */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-semibold text-slate-400">
            توضیحات مرجع تشریحی
          </span>
          <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/50">
            {structure.descriptionFa || structure.descriptionEn}
          </p>
        </div>

        {/* Metadata Badges */}
        <div className="grid grid-cols-2 gap-2 text-[10px]">
          <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800 flex flex-col">
            <span className="text-slate-400">شناسه FMA:</span>
            <span className="font-mono text-sky-300 font-semibold" data-testid="structure-fma-id">
              {structure.fmaId}
            </span>
          </div>
          <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800 flex flex-col">
            <span className="text-slate-400">SNOMED Body:</span>
            <span className="font-mono text-emerald-300 font-semibold">{structure.snomedBodyStructureId}</span>
          </div>
        </div>

        {/* Provenance block */}
        {(structure.source || structure.reviewedBy) && (
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-2 text-[10px] text-slate-400 space-y-0.5">
            {structure.source && <div>منبع: {structure.source}</div>}
            {structure.reviewedBy && (
              <div>
                بازبینی: {structure.reviewedBy} ({structure.reviewedAt})
              </div>
            )}
          </div>
        )}

        {/* Unmapped warning vs Interactive Action Buttons */}
        <div className="pt-2 border-t border-slate-800/60 flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            {onIsolate && (
              <button
                data-testid="isolate-structure-btn"
                onClick={() => onIsolate(structure.isMappedToCatalog ? structure.recordId : `unmapped:${structure.meshNodeName}`)}
                className="flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 font-medium border border-slate-700 transition"
              >
                <Eye className="w-3.5 h-3.5 text-sky-400" />
                <span>ایزوله (Isolate)</span>
              </button>
            )}

            {onReset && (
              <button
                data-testid="reset-selection-btn"
                onClick={onReset}
                className="flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 font-medium border border-slate-700 transition"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                <span>خروج از انتخاب / ریست</span>
              </button>
            )}
          </div>

          {!structure.isMappedToCatalog ? (
            <div className="p-2 rounded-lg bg-slate-900/90 border border-slate-800 text-[10px] text-slate-400 flex items-start gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              <span>
                این جزء فرعی در نگاشت پرونده‌های آموزشی ثبت نشده است؛ برای پرهیز از اطلاعات غیرمستند، پرونده بیماری برای آن باز نمی‌شود.
              </span>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {onOpenPathology && (
                <button
                  data-testid="open-pathology-btn"
                  onClick={onOpenPathology}
                  className="flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg bg-rose-950/70 hover:bg-rose-900/80 text-xs text-rose-200 font-medium border border-rose-800/60 transition"
                >
                  <BookOpen className="w-3.5 h-3.5 text-rose-400" />
                  <span>نمایش آموزشی تغییرات</span>
                </button>
              )}

              {onOpenPhysiology && (
                <button
                  onClick={onOpenPhysiology}
                  className="flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg bg-sky-950/70 hover:bg-sky-900/80 text-xs text-sky-200 font-medium border border-sky-800/60 transition"
                >
                  <Activity className="w-3.5 h-3.5 text-sky-400" />
                  <span>فیزیولوژی آموزشی</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </DraggablePanel>
  );
}
