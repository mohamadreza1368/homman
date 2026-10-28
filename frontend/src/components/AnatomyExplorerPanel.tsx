import { useState } from 'react';
import type { AnatomyViewer } from '../engine/AnatomyViewer';
import type { SystemCategory } from '../engine/AtlasModelLoader';
import { X, Layers, SplitSquareVertical } from 'lucide-react';

interface Props {
  viewer: AnatomyViewer | null;
  onClose?: () => void;
}

interface SystemItem {
  id: SystemCategory;
  nameEn: string;
  nameFa: string;
  color: string;
}

const SYSTEMS_LIST: SystemItem[] = [
  { id: 'skeletal', nameEn: 'Skeletal', nameFa: 'اسکلت و استخوان‌ها', color: '#e2d9ba' },
  { id: 'muscular', nameEn: 'Muscular', nameFa: 'دستگاه عضلانی', color: '#a84c40' },
  { id: 'nervous', nameEn: 'Nervous', nameFa: 'سیستم عصبی و مغز', color: '#eab308' },
  { id: 'cardiovascular', nameEn: 'Cardiovascular', nameFa: 'قلب و عروق', color: '#dc2626' },
  { id: 'respiratory', nameEn: 'Respiratory', nameFa: 'دستگاه تنفس و ریه‌ها', color: '#f472b6' },
  { id: 'digestive', nameEn: 'Digestive', nameFa: 'گوارش و احشا', color: '#d97706' },
  { id: 'lymphatic', nameEn: 'Lymphatic', nameFa: 'سیستم لنفاوی و ایمنی', color: '#10b981' },
  { id: 'integumentary', nameEn: 'Integumentary', nameFa: 'پوست و کانتور سطحی', color: '#e2b89d' },
];

export function AnatomyExplorerPanel({ viewer, onClose }: Props) {
  const [halfDissection, setHalfDissection] = useState(true);
  const [systemsState, setSystemsState] = useState<Record<SystemCategory, boolean>>({
    skeletal: true,
    muscular: true,
    nervous: true,
    cardiovascular: true,
    respiratory: true,
    digestive: true,
    urinary: true,
    lymphatic: true,
    integumentary: true,
  });

  const [opacities, setOpacities] = useState({
    integumentary: 0.18,
    muscular: 1.0,
    skeletal: 1.0,
  });

  const toggleSystem = (systemId: SystemCategory) => {
    const next = !systemsState[systemId];
    setSystemsState((prev) => ({ ...prev, [systemId]: next }));
    viewer?.setSystemVisibility(systemId, next);
  };

  const handleHalfDissectionToggle = () => {
    const next = !halfDissection;
    setHalfDissection(next);
    viewer?.setHalfDissection(next);
  };

  const handleOpacityChange = (
    system: 'integumentary' | 'muscular' | 'skeletal',
    value: number
  ) => {
    setOpacities((prev) => ({ ...prev, [system]: value }));
    viewer?.setSystemOpacity(system, value);
  };

  return (
    <div
      className="absolute top-16 left-6 z-30 w-72 bg-slate-950/85 backdrop-blur-xl border border-slate-800/80 rounded-2xl shadow-2xl p-4 text-slate-100 flex flex-col gap-3.5 select-none"
      dir="ltr"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800/60">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-sky-400" />
          <h2 className="text-sm font-semibold tracking-wide text-slate-100">Anatomy Explorer</h2>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Half-Dissection Mode Feature Switch */}
      <div className="bg-slate-900/90 rounded-xl p-2.5 border border-sky-500/20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SplitSquareVertical className="w-4 h-4 text-sky-400" />
          <div className="flex flex-col">
            <span className="text-xs font-medium text-slate-200">Half Dissection</span>
            <span className="text-[10px] text-slate-400">کالبدشکافی عضلانی / اسکلتی</span>
          </div>
        </div>
        <button
          onClick={handleHalfDissectionToggle}
          className={`w-11 h-6 rounded-full transition-colors relative flex items-center p-0.5 ${
            halfDissection ? 'bg-sky-500' : 'bg-slate-700'
          }`}
        >
          <div
            className={`w-5 h-5 rounded-full bg-white transition-transform ${
              halfDissection ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {/* Systems Toggle List */}
      <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto pr-1">
        {SYSTEMS_LIST.map((sys) => {
          const isActive = systemsState[sys.id];
          return (
            <div
              key={sys.id}
              className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-slate-900/50 hover:bg-slate-900/80 transition"
            >
              <div className="flex items-center gap-2.5">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: sys.color }}
                />
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-slate-200">{sys.nameEn}</span>
                  <span className="text-[9px] text-slate-400 font-normal">{sys.nameFa}</span>
                </div>
              </div>

              {/* iOS Pill Toggle */}
              <button
                onClick={() => toggleSystem(sys.id)}
                className={`w-9 h-5 rounded-full transition-colors relative flex items-center p-0.5 ${
                  isActive ? 'bg-sky-500 shadow-sm shadow-sky-500/30' : 'bg-slate-700'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white transition-transform ${
                    isActive ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          );
        })}
      </div>

      {/* Opacity Sliders */}
      <div className="pt-2 border-t border-slate-800/60 flex flex-col gap-2.5">
        <span className="text-[11px] font-semibold text-slate-400 tracking-wider uppercase">
          Layer Opacity
        </span>

        {/* Integumentary / Skin Opacity */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-[10px] text-slate-300">
            <span>Integumentary (پوست)</span>
            <span>{Math.round(opacities.integumentary * 100)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.02"
            value={opacities.integumentary}
            onChange={(e) => handleOpacityChange('integumentary', parseFloat(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-400"
          />
        </div>

        {/* Muscular Opacity */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-[10px] text-slate-300">
            <span>Muscular (عضلات)</span>
            <span>{Math.round(opacities.muscular * 100)}%</span>
          </div>
          <input
            type="range"
            min="0.1"
            max="1"
            step="0.05"
            value={opacities.muscular}
            onChange={(e) => handleOpacityChange('muscular', parseFloat(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-400"
          />
        </div>

        {/* Skeletal Opacity */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-[10px] text-slate-300">
            <span>Skeletal (استخوان‌ها)</span>
            <span>{Math.round(opacities.skeletal * 100)}%</span>
          </div>
          <input
            type="range"
            min="0.1"
            max="1"
            step="0.05"
            value={opacities.skeletal}
            onChange={(e) => handleOpacityChange('skeletal', parseFloat(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-400"
          />
        </div>
      </div>
    </div>
  );
}
