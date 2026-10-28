import React, { useState } from 'react';
import { X, Activity, FileText, Zap, Eye, RotateCcw, Filter, Stethoscope, Dna, ShieldAlert } from 'lucide-react';
import type { AnatomicalStructure, PathologyDisorder } from '../types/anatomy';
import knowledgeGraphData from '../data/pathologyKnowledgeGraph.json';

interface PathologyDrawerProps {
  structure: AnatomicalStructure | null;
  onClose: () => void;
  stage: 1 | 2;
  onIsolate?: (fmaId: string) => void;
  onClearIsolate?: () => void;
}

interface OrganData {
  fmaId: string;
  nameEn: string;
  nameFa: string;
  snomedRootId: string;
  disorders: PathologyDisorder[];
}

const PRESET_BADGES = {
  pbr_inflammation: { label: 'التهاب PBR (قرمزی و تورم)', color: 'bg-rose-500/20 text-rose-300 border-rose-500/40' },
  pbr_ischemia: { label: 'ایسکمی و نکروز بافتی', color: 'bg-purple-500/20 text-purple-300 border-purple-500/40' },
  morph_atrophy: { label: 'آتروفی و دژنراسیون مورفولوژیک', color: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
  procedural_mass: { label: 'توده نئوپلاستیک / تومور فضاگیر', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
  rig_fracture: { label: 'شکستگی اسکلتی و جابه‌جایی استخوان', color: 'bg-blue-500/20 text-blue-300 border-blue-500/40' },
};

export const PathologyDrawer: React.FC<PathologyDrawerProps> = ({
  structure,
  onClose,
  onIsolate,
  onClearIsolate,
}) => {
  const [selectedDisorder, setSelectedDisorder] = useState<PathologyDisorder | null>(null);
  const [severity, setSeverity] = useState(0.75);
  const [isIsolated, setIsIsolated] = useState(false);
  const [selectedDept, setSelectedDept] = useState<string>('همه');

  if (!structure) return null;

  const organData = (knowledgeGraphData as unknown as Record<string, OrganData>)[structure.fmaId];
  const allDisorders: PathologyDisorder[] = organData ? organData.disorders : [];

  // Extract unique departments for filtering
  const departments = ['همه', ...Array.from(new Set(allDisorders.map((d) => d.clinicalDepartment)))];

  const filteredDisorders = selectedDept === 'همه'
    ? allDisorders
    : allDisorders.filter((d) => d.clinicalDepartment === selectedDept);

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
    <div className="absolute left-4 top-20 bottom-6 w-104 bg-card/95 backdrop-blur-xl border border-border rounded-xl shadow-2xl z-30 flex flex-col overflow-hidden animate-in fade-in slide-in-from-left duration-200 select-none">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-start justify-between bg-muted/40">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded font-mono font-bold border border-primary/30">
              {structure.fmaId}
            </span>
            <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded font-mono border border-border">
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
          <div className="flex items-center justify-between mb-1.5">
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

        {/* Phase 3: Clinical Knowledge Graph (SNOMED CT, ICD-10, ICD-O) */}
        <div className="pt-2 border-t border-border space-y-2.5">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5" />
              بیماری‌های مرتبط (الگوریتم ANAT و SEP)
            </h4>
            <span className="text-[10px] bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded font-mono border border-rose-500/30">
              {allDisorders.length} اختلال شناسایی‌شده
            </span>
          </div>

          {/* Department Filter Tabs */}
          {departments.length > 2 && (
            <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px]">
              <Filter className="w-3 h-3 text-muted-foreground shrink-0" />
              {departments.map((dept) => (
                <button
                  key={dept}
                  onClick={() => setSelectedDept(dept)}
                  className={`px-2 py-0.5 rounded-full shrink-0 transition-colors ${
                    selectedDept === dept
                      ? 'bg-primary text-primary-foreground font-semibold'
                      : 'bg-muted/60 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {dept}
                </button>
              ))}
            </div>
          )}

          {filteredDisorders.length === 0 ? (
            <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg border border-border/50 text-center">
              اختلالی برای این ساختار یا دپارتمان انتخاب‌شده ثبت نشده است.
            </div>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {filteredDisorders.map((disorder) => {
                const isSelected = selectedDisorder?.snomedDisorderId === disorder.snomedDisorderId;
                const presetInfo = PRESET_BADGES[disorder.visualPresetType] || { label: disorder.visualPresetType, color: 'bg-muted' };

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
                      <div className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                        <Stethoscope className="w-3 h-3 text-rose-400" />
                        {disorder.preferredTermFa}
                      </div>
                      <div className="flex items-center gap-1">
                        {disorder.icd10Code && (
                          <span className="text-[10px] font-mono text-muted-foreground bg-card px-1.5 py-0.5 rounded border border-border">
                            {disorder.icd10Code}
                          </span>
                        )}
                        {disorder.icdoTopographyCode && (
                          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/40 px-1 py-0.5 rounded border border-emerald-500/30" title="ICD-O Oncology Topography">
                            {disorder.icdoTopographyCode}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-[11px] text-muted-foreground font-sans mt-0.5">{disorder.fsnEn}</div>

                    <div className="flex flex-wrap items-center gap-1.5 mt-2 text-[10px]">
                      <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                        {disorder.clinicalDepartment}
                      </span>
                      <span className="bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                        {disorder.etiologyCategory}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded border font-mono ${presetInfo.color}`}>
                        {presetInfo.label}
                      </span>
                      {disorder.orphanCode && (
                        <span className="text-amber-400 bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-500/30 flex items-center gap-1">
                          <Dna className="w-2.5 h-2.5" />
                          {disorder.orphanCode}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected Disorder Simulation Controls (Stage 2) */}
        {selectedDisorder && (
          <div className="p-3 bg-card border border-rose-500/40 rounded-xl space-y-3 animate-in fade-in duration-150">
            <div className="flex items-center justify-between border-b border-border/60 pb-1.5">
              <span className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5" />
                شبیه‌سازی پارامتریک اثر پاتولوژی روی بافت
              </span>
              <span className="text-[10px] font-mono text-primary bg-primary/20 px-1.5 py-0.5 rounded">
                Preset: {selectedDisorder.visualPresetType}
              </span>
            </div>

            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {selectedDisorder.descriptionFa}
            </p>

            {/* Clinical Mechanism Tags */}
            <div className="grid grid-cols-2 gap-1.5 text-[10px]">
              <div className="p-1.5 rounded bg-muted/40 border border-border/50">
                <span className="text-muted-foreground block">سیر بالینی (|Course|):</span>
                <span className="font-semibold text-foreground">{selectedDisorder.clinicalCourse || 'حاد'}</span>
              </div>
              <div className="p-1.5 rounded bg-muted/40 border border-border/50">
                <span className="text-muted-foreground block">مورفولوژی بافتی (|Morphology|):</span>
                <span className="font-mono text-primary">{selectedDisorder.associatedMorphologyId || '56246009'}</span>
              </div>
            </div>

            {/* Severity Slider */}
            <div className="space-y-1 pt-1">
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
