import React, { useEffect, useState } from 'react';
import {
  X,
  BookOpen,
  Eye,
  RotateCcw,
  Filter,
  Info,
  Dna,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';
import type { AnatomicalStructure, PathologyDisorder, VisualPresetType } from '../types/anatomy';
import {
  getPublishedOrganKnowledge,
  KNOWLEDGE_GRAPH_METADATA,
} from '../data/anatomyRegistry';

interface PathologyDrawerProps {
  structure: AnatomicalStructure | null;
  onClose: () => void;
  onIsolate?: (recordId: string) => void;
  onClearIsolate?: () => void;
  onApplyPreset?: (recordId: string, presetType: VisualPresetType) => void;
  onClearPreset?: () => void;
}

const PRESET_INFO: Record<
  VisualPresetType,
  { label: string; effectDesc: string; colorClass: string }
> = {
  pbr_inflammation: {
    label: 'رنگ‌بندی آموزشی التهاب',
    effectDesc: 'اعمال هایلایت رنگی قرمز روی مش ساختار برای نمایش کانون التهابی مفهومی',
    colorClass: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
  },
  pbr_ischemia: {
    label: 'رنگ‌بندی آموزشی کاهش خون‌رسانی (ایسکمی)',
    effectDesc: 'تغییر رنگ مفهومی ساختار به طیف بنفش/کبود جهت آموزش نواحی کم‌اکسیژن',
    colorClass: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
  },
  morph_atrophy: {
    label: 'رنگ‌بندی آموزشی دژنراسیون / آتروفی',
    effectDesc: 'اعمال نشانگر کهربایی روشن روی عضو برای اشاره به تغییرات ساختاری مزمن',
    colorClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  },
  procedural_mass: {
    label: 'نشانه آموزشی توده فضاگیر',
    effectDesc: 'تفکیک رنگی سبز جهت نمایش موقعیت آناتومیک ضایعه آموزشی در مقطع',
    colorClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  },
  rig_fracture: {
    label: 'نشانگر آموزشی گسیختگی استخوانی',
    effectDesc: 'هایلایت آبی پرکنتراست روی استخوان جهت بررسی ناحیه تروما و آناتومی مجاور',
    colorClass: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
  },
};

export const PathologyDrawer: React.FC<PathologyDrawerProps> = ({
  structure,
  onClose,
  onIsolate,
  onClearIsolate,
  onApplyPreset,
  onClearPreset,
}) => {
  const [selectedDisorder, setSelectedDisorder] = useState<PathologyDisorder | null>(null);
  const [isPresetActive, setIsPresetActive] = useState(false);
  const [isIsolated, setIsIsolated] = useState(false);
  const [selectedDept, setSelectedDept] = useState<string>('همه');

  // Reset active conceptual preset when switching organs
  useEffect(() => {
    setSelectedDisorder(null);
    setIsPresetActive(false);
    setSelectedDept('همه');
    onClearPreset?.();
  }, [structure?.recordId]);

  if (!structure || !structure.isMappedToCatalog) return null;

  const organData = getPublishedOrganKnowledge(structure.fmaId);
  const allDisorders: PathologyDisorder[] = organData ? organData.disorders : [];

  const departments = ['همه', ...Array.from(new Set(allDisorders.map((d) => d.clinicalDepartment)))];
  const filteredDisorders =
    selectedDept === 'همه'
      ? allDisorders
      : allDisorders.filter((d) => d.clinicalDepartment === selectedDept);

  const handleToggleIsolate = () => {
    if (isIsolated) {
      setIsIsolated(false);
      onClearIsolate?.();
    } else {
      setIsIsolated(true);
      onIsolate?.(structure.recordId);
    }
  };

  const handleSelectDisorder = (disorder: PathologyDisorder) => {
    setSelectedDisorder(disorder);
    setIsPresetActive(true);
    onApplyPreset?.(structure.recordId, disorder.visualPresetType);
  };

  const handleClearPreset = () => {
    setIsPresetActive(false);
    onClearPreset?.();
  };

  const activePresetMeta = selectedDisorder ? PRESET_INFO[selectedDisorder.visualPresetType] : null;

  return (
    <div
      data-testid="pathology-drawer"
      dir="rtl"
      className="absolute left-4 top-16 bottom-20 w-96 max-w-[calc(100vw-2rem)] bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-xl shadow-2xl z-40 flex flex-col overflow-hidden select-none text-slate-100"
    >
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-start justify-between bg-slate-950/60">
        <div>
          <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
            <span className="text-[10px] bg-sky-500/20 text-sky-300 px-2 py-0.5 rounded font-mono font-bold border border-sky-500/30">
              {structure.fmaId}
            </span>
            <span className="text-[10px] bg-amber-500/15 text-amber-300 px-2 py-0.5 rounded font-mono border border-amber-500/30">
              educational_visualization
            </span>
          </div>
          <h2 className="text-base font-bold text-white">{structure.nameFa}</h2>
          <h3 className="text-xs text-slate-400 font-sans">{structure.nameEn}</h3>
        </div>
        <button
          onClick={() => {
            onClearPreset?.();
            onClose();
          }}
          aria-label="بستن پنل"
          className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content Area */}
      <div className="p-4 flex-1 overflow-y-auto space-y-4">
        {/* Educational Notice Banner (Always Visible) */}
        <div
          data-testid="educational-warning-banner"
          className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-500/40 text-[11px] text-amber-200 flex items-start gap-2 leading-relaxed"
        >
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <span>
            «این تصویر نمایش مفهومی است و شدت، پیش‌آگهی یا مدل بالینی معتبر بیماری را نشان نمی‌دهد.»
          </span>
        </div>

        {/* Anatomical Overview & 3D Isolation Action */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <h4 className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-sky-400" />
              مشخصات ساختار مرجع
            </h4>
            <button
              data-testid="drawer-isolate-btn"
              onClick={handleToggleIsolate}
              className={`flex items-center gap-1 text-[10px] px-2.5 py-1 rounded border transition-colors ${
                isIsolated
                  ? 'bg-sky-500/20 text-sky-300 border-sky-500/40 font-bold'
                  : 'bg-slate-800 text-slate-300 hover:text-white border-slate-700'
              }`}
            >
              {isIsolated ? <RotateCcw className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              {isIsolated ? 'بازگشت از ایزولاسیون' : 'ایزوله‌سازی عضو'}
            </button>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">{structure.descriptionFa}</p>
        </div>

        {/* Educational Disorders List */}
        <div className="pt-2 border-t border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5" />
              مفاهیم و تغییرات پاتولوژیک مرتبط (آموزشی)
            </h4>
            <span className="text-[10px] bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded font-mono border border-rose-500/30">
              {allDisorders.length} عنوان
            </span>
          </div>

          {departments.length > 2 && (
            <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px]">
              <Filter className="w-3 h-3 text-slate-400 shrink-0" />
              {departments.map((dept) => (
                <button
                  key={dept}
                  onClick={() => setSelectedDept(dept)}
                  className={`px-2 py-0.5 rounded-full shrink-0 transition-colors ${
                    selectedDept === dept
                      ? 'bg-sky-500 text-slate-950 font-semibold'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {dept}
                </button>
              ))}
            </div>
          )}

          {filteredDisorders.length === 0 ? (
            <div className="text-xs text-slate-400 bg-slate-950/60 p-3 rounded-lg border border-slate-800 text-center">
              مفهوم آموزشی برای این ساختار در دپارتمان انتخاب‌شده ثبت نشده است.
            </div>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto pl-1">
              {filteredDisorders.map((disorder) => {
                const isSelected = selectedDisorder?.snomedDisorderId === disorder.snomedDisorderId;
                const presetMeta = PRESET_INFO[disorder.visualPresetType];

                return (
                  <button
                    type="button"
                    key={disorder.snomedDisorderId}
                    data-testid={`disorder-item-${disorder.snomedDisorderId}`}
                    onClick={() => handleSelectDisorder(disorder)}
                    className={`w-full text-right p-2.5 rounded-lg border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-rose-950/40 border-rose-500/60 shadow-sm'
                        : 'bg-slate-950/50 border-slate-800 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-semibold text-xs text-slate-100">
                        {disorder.preferredTermFa}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {disorder.icd10Code && (
                          <span className="text-[10px] font-mono text-slate-300 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700">
                            {disorder.icd10Code}
                          </span>
                        )}
                        {disorder.icdoTopographyCode && (
                          <span className="text-[10px] font-mono text-emerald-300 bg-emerald-950/40 px-1 py-0.5 rounded border border-emerald-500/30">
                            {disorder.icdoTopographyCode}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-400 font-sans mt-0.5" dir="ltr">
                      {disorder.fsnEn}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 mt-2 text-[10px]">
                      <span className="bg-sky-500/15 text-sky-300 px-1.5 py-0.5 rounded">
                        {disorder.clinicalDepartment}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded border font-mono ${presetMeta.colorClass}`}>
                        {presetMeta.label}
                      </span>
                      {disorder.orphanCode && (
                        <span className="text-amber-300 bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-500/30 flex items-center gap-1">
                          <Dna className="w-2.5 h-2.5" />
                          {disorder.orphanCode}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Controlled Educational Visual Preset Panel (Replaces misleading simulated severity controls) */}
        {selectedDisorder && activePresetMeta && (
          <div
            data-testid="educational-preset-details"
            className="p-3 bg-slate-950/80 border border-amber-500/40 rounded-xl space-y-2.5"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                نمایش آموزشی تغییرات مرتبط (مفهومی)
              </span>
              {isPresetActive ? (
                <button
                  data-testid="clear-preset-btn"
                  onClick={handleClearPreset}
                  className="text-[10px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600"
                >
                  حذف رنگ‌آمیزی از مدل
                </button>
              ) : (
                <button
                  onClick={() => handleSelectDisorder(selectedDisorder)}
                  className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40"
                >
                  اعمال نمایش رنگی
                </button>
              )}
            </div>

            <div className="text-[11px] text-slate-200 leading-relaxed">
              {selectedDisorder.descriptionFa}
            </div>
            <div className="text-[10px] text-slate-400 font-sans" dir="ltr">
              {selectedDisorder.descriptionEn}
            </div>

            <div className="p-2 rounded-lg bg-slate-900/90 border border-slate-800 text-[10px] text-sky-300">
              اثر فعال در صحنه سه‌بعدی: {activePresetMeta.effectDesc}
            </div>

            {/* Required Source, Version & Scientific Review Traceability */}
            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-[10px] text-slate-300 space-y-1">
              <div className="font-semibold text-slate-200">شناسنامه و منشأ علمی رکورد:</div>
              <div>منبع: {selectedDisorder.source} ({selectedDisorder.sourceVersion})</div>
              <div>بازبین علمی: {selectedDisorder.reviewedBy}</div>
              <div>تاریخ بازبینی: {selectedDisorder.reviewedAt} | وضعیت: <span className="font-mono text-amber-300">{selectedDisorder.contentStatus}</span></div>
              <div className="text-[9px] text-slate-400 pt-1 border-t border-slate-800">
                {selectedDisorder.licenseRestriction || KNOWLEDGE_GRAPH_METADATA.terminologyNotice}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
