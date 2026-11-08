import React, { useState } from 'react';
import { Heart, Brain, Play, Pause, Compass, Zap } from 'lucide-react';
import { AnatomyViewer } from '../engine/AnatomyViewer';
import { DraggablePanel } from './DraggablePanel';

interface PhysiologyPanelProps {
  viewer: AnatomyViewer | null;
  onClose?: () => void;
}

export const PhysiologyPanel: React.FC<PhysiologyPanelProps> = ({ viewer, onClose }) => {
  const [isBeating, setIsBeating] = useState(true);
  const [bpm, setBpm] = useState(72);
  const [isNeuroMode, setIsNeuroMode] = useState(false);

  const toggleHeartBeating = () => {
    const next = !isBeating;
    setIsBeating(next);
    viewer?.setHeartBeating(next, bpm);
  };

  const handleBpmChange = (newBpm: number) => {
    setBpm(newBpm);
    if (isBeating) {
      viewer?.setHeartBeating(true, newBpm);
    }
  };

  const toggleNeuro = () => {
    const next = !isNeuroMode;
    setIsNeuroMode(next);
    viewer?.setNeuroMode(next);
  };

  return (
    <DraggablePanel
      id="physiology-panel"
      title="فیزیولوژی زنده و عملکردی"
      icon={<Zap className="w-4 h-4 text-rose-400" />}
      initialPos={{ x: 330, y: 70 }}
      width="w-84"
      onClose={onClose}
    >
      <div className="space-y-3.5 select-none" dir="rtl">
        {/* Dissectible Beating Heart Section */}
        <div className="p-3 rounded-xl bg-rose-950/25 border border-rose-500/30 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Heart className={`w-4 h-4 ${isBeating ? 'text-rose-400 animate-pulse' : 'text-slate-400'}`} />
              <span className="text-xs font-bold text-slate-100">پمپاژ فیزیولوژیک قلب (Wiggers Cycle)</span>
            </div>
            <button
              onClick={toggleHeartBeating}
              className={`flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-lg border font-medium transition-colors ${
                isBeating
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              {isBeating ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              <span>{isBeating ? 'توقف تپش' : 'شروع تپش'}</span>
            </button>
          </div>

          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between text-[10px] text-slate-300 font-mono">
              <span>نرخ ضربان قلب (BPM):</span>
              <span className="text-rose-400 font-bold">{bpm} ضربان در دقیقه</span>
            </div>
            <input
              type="range"
              min="45"
              max="180"
              step="1"
              value={bpm}
              onChange={(e) => handleBpmChange(parseInt(e.target.value))}
              className="w-full accent-rose-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
            <div className="flex justify-between text-[9px] text-slate-400 mt-1">
              <button
                onClick={() => handleBpmChange(55)}
                className="hover:text-slate-200 hover:underline"
              >
                برادی‌کاردی (۵۵)
              </button>
              <button
                onClick={() => handleBpmChange(72)}
                className="text-rose-400 font-bold hover:underline"
              >
                استراحت (۷۲)
              </button>
              <button
                onClick={() => handleBpmChange(140)}
                className="hover:text-slate-200 hover:underline"
              >
                ورزش سنگین (۱۴۰)
              </button>
            </div>
          </div>

          <button
            onClick={() => viewer?.focusOnHeart()}
            className="w-full flex items-center justify-center gap-1.5 bg-rose-500/15 hover:bg-rose-500/25 text-rose-200 text-xs py-1.5 rounded-lg border border-rose-500/30 transition-colors font-medium mt-1"
          >
            <Compass className="w-3.5 h-3.5" />
            <span>تمرکز و زوم روی حفرات بطن و دهلیز قلب</span>
          </button>
        </div>

        {/* Neuroanatomy & Cortical Lobes Section */}
        <div className="p-3 rounded-xl bg-sky-950/25 border border-sky-500/30 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-sky-400" />
              <span className="text-xs font-bold text-slate-100">نوروآناتومی و لوب‌های مغزی</span>
            </div>
            <button
              onClick={toggleNeuro}
              className={`text-[10px] px-2.5 py-1 rounded-lg border font-medium transition-colors ${
                isNeuroMode
                  ? 'bg-sky-500/20 text-sky-300 border-sky-500/40 hover:bg-sky-500/30'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              {isNeuroMode ? 'حالت فعال' : 'مشاهده لوب‌ها'}
            </button>
          </div>

          {isNeuroMode && (
            <div className="space-y-1.5 pt-1 text-[11px]">
              <div className="flex items-center justify-between p-1.5 rounded-lg bg-slate-900/60 border border-slate-800">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#38bdf8]" />
                  لوب پیشانی (Frontal)
                </span>
                <span className="text-[10px] text-slate-400">حرکت، تکلم و تفکر اجرایی</span>
              </div>
              <div className="flex items-center justify-between p-1.5 rounded-lg bg-slate-900/60 border border-slate-800">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#a855f7]" />
                  لوب آهیانه (Parietal)
                </span>
                <span className="text-[10px] text-slate-400">پردازش حسی و جهت‌یابی فضایی</span>
              </div>
              <div className="flex items-center justify-between p-1.5 rounded-lg bg-slate-900/60 border border-slate-800">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#10b981]" />
                  لوب گیجگاهی (Temporal)
                </span>
                <span className="text-[10px] text-slate-400">شنوایی، حافظه و زبان</span>
              </div>
              <div className="flex items-center justify-between p-1.5 rounded-lg bg-slate-900/60 border border-slate-800">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#f59e0b]" />
                  لوب پس‌سری (Occipital)
                </span>
                <span className="text-[10px] text-slate-400">بینایی و ادراک رنگ</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </DraggablePanel>
  );
};
