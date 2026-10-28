import React, { useState } from 'react';
import { X, Activity, FileText, Zap, Eye, RotateCcw } from 'lucide-react';
import type { AnatomicalStructure, PathologyDisorder } from '../types/anatomy';
import { MOCK_PATHOLOGY_DISORDERS } from '../data/mockPathology';

interface PathologyDrawerProps {
  structure: AnatomicalStructure | null;
  onClose: () => void;
  stage: 1 | 2;
  onIsolate?: (fmaId: string) => void;
  onClearIsolate?: () => void;
}

export const PathologyDrawer: React.FC<PathologyDrawerProps> = ({
  structure,
  onClose,
  onIsolate,
  onClearIsolate,
}) => {
  const [selectedDisorder, setSelectedDisorder] = useState<PathologyDisorder | null>(null);
  const [severity, setSeverity] = useState(0.8);
  const [isIsolated, setIsIsolated] = useState(false);

  if (!structure) return null;

  const disorders = MOCK_PATHOLOGY_DISORDERS[structure.fmaId] || [];

  const handleToggleIsolate = () => {
    if (isIsolated) {
      setIsIsolated(false);
      onClearIsolate?.();
    } else {
      setIsIsolated(true);
      onIsolate?.(structure.fmaId);
    }
  };

  return (
    <div className="absolute left-4 top-20 bottom-6 w-96 bg-card/95 backdrop-blur-lg border border-border rounded-xl shadow-2xl z-30 flex flex-col overflow-hidden animate-in fade-in slide-in-from-left duration-200">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-start justify-between bg-muted/40">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded font-mono font-bold">
              {structure.fmaId}
            </span>
            <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-mono">
              SNOMED: {structure.snomedBodyStructureId}
            </span>
          </div>
          <h2 className="text-base font-bold text-foreground">{structure.nameFa}</h2>
          <h3 className="text-xs text-muted-foreground font-sans">{structure.nameEn}</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content Area */}
      <div className="p-4 flex-1 overflow-y-auto space-y-4">
        {/* Anatomical Overview & 3D Isolation Action */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-primary" />
              مشخصات کالبدی و تشریحی
            </h4>
            <button
              onClick={handleToggleIsolate}
              className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border transition-colors ${
                isIsolated
                  ? 'bg-primary/20 text-primary border-primary/40 font-bold'
                  : 'bg-muted text-muted-foreground hover:text-foreground border-border'
              }`}
            >
              {isIsolated ? <RotateCcw className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              {isIsolated ? 'خروج از ایزوله' : 'ایزولاسیون و محوسازی سایرین'}
            </button>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {structure.descriptionFa || 'اطلاعات بافت‌شناسی و موقعیت این ساختار در سیستم کالبدی ثبت شده است.'}
          </p>
        </div>

        {/* Stage 2 Clinical Knowledge Graph */}
        <div className="pt-2 border-t border-border">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5" />
              بیماری‌های مرتبط (الگوریتم ANAT و SEP)
            </h4>
            <span className="text-[10px] bg-rose-500/20 text-rose-300 px-1.5 py-0.2 rounded font-mono">
              {disorders.length} اختلال بالینی
            </span>
          </div>

          {disorders.length === 0 ? (
            <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg border border-border/50 text-center">
              اختلالی برای این کد در پیش‌نمایش بارگذاری نشده است.
            </div>
          ) : (
            <div className="space-y-2">
              {disorders.map((disorder) => {
                const isSelected = selectedDisorder?.snomedDisorderId === disorder.snomedDisorderId;
                return (
                  <div
                    key={disorder.snomedDisorderId}
                    onClick={() => setSelectedDisorder(disorder)}
                    className={`p-2.5 rounded-lg border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-rose-950/40 border-rose-500/60 shadow-sm'
                        : 'bg-muted/40 border-border/70 hover:border-border'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-xs text-foreground">{disorder.preferredTermFa}</div>
                      <span className="text-[10px] font-mono text-muted-foreground bg-card px-1.5 py-0.5 rounded border border-border">
                        {disorder.icd10Code || 'ICD-10'}
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground font-sans mt-0.5">{disorder.fsnEn}</div>
                    <div className="flex items-center gap-2 mt-2 text-[10px]">
                      <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                        {disorder.clinicalDepartment}
                      </span>
                      <span className="bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                        {disorder.etiologyCategory}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected Disorder Simulation Controls (Stage 2) */}
        {selectedDisorder && (
          <div className="p-3 bg-card border border-rose-500/30 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5" />
                شبیه‌سازی بصری اثر بیماری بر بافت
              </span>
              <span className="text-[10px] font-mono text-primary bg-primary/20 px-1.5 py-0.5 rounded">
                Preset: {selectedDisorder.visualPresetType}
              </span>
            </div>

            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {selectedDisorder.descriptionFa}
            </p>

            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-muted-foreground">شدت بالینی بیماری (|Severity|):</span>
                <span className="font-mono text-rose-400 font-bold">{Math.round(severity * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={severity}
                onChange={(e) => setSeverity(parseFloat(e.target.value))}
                className="w-full accent-rose-500 cursor-pointer h-1.5 bg-muted rounded-lg"
              />
              <div className="flex justify-between text-[9px] text-muted-foreground">
                <span>سالم (0.0)</span>
                <span>متوسط (0.5)</span>
                <span>پیشرفته / نکروز (1.0)</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
