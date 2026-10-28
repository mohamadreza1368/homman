import React, { useState } from 'react';
import { Heart, Brain, Play, Pause, Compass, Zap } from 'lucide-react';
import { AnatomyViewer, CORTICAL_LOBE_COLORS } from '../engine/AnatomyViewer';

interface PhysiologyPanelProps {
  viewer: AnatomyViewer | null;
}

export const PhysiologyPanel: React.FC<PhysiologyPanelProps> = ({ viewer }) => {
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
    <div className="absolute top-16 left-4 bg-card/95 backdrop-blur-lg border border-border p-3.5 rounded-xl shadow-2xl z-20 w-80 select-none space-y-3.5 animate-in fade-in slide-in-from-top duration-200">
      <h3 className="text-xs font-bold text-foreground flex items-center justify-between border-b border-border pb-2">
        <span className="flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-primary" />
          ماژول‌های فیزیولوژی و عملکردی
        </span>
        <span className="text-[10px] text-muted-foreground font-mono">Phase 2</span>
      </h3>

      {/* Dissectible Beating Heart Section */}
      <div className="p-2.5 rounded-lg bg-rose-950/20 border border-rose-500/30 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Heart className={`w-4 h-4 ${isBeating ? 'text-rose-500 animate-pulse' : 'text-muted-foreground'}`} />
            <span className="text-xs font-bold text-foreground">قلب تپنده فیزیولوژیک</span>
          </div>
          <button
            onClick={toggleHeartBeating}
            className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border transition-colors ${
              isBeating
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                : 'bg-muted text-muted-foreground border-border'
            }`}
          >
            {isBeating ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            {isBeating ? 'توقف تپش' : 'شروع تپش'}
          </button>
        </div>

        <div>
          <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
            <span>نرخ ضربان (BPM):</span>
            <span className="text-rose-400 font-bold">{bpm} ضربان در دقیقه</span>
          </div>
          <input
            type="range"
            min="45"
            max="180"
            step="1"
            value={bpm}
            onChange={(e) => handleBpmChange(parseInt(e.target.value))}
            className="w-full accent-rose-500 cursor-pointer h-1.5 bg-muted rounded-lg"
          />
          <div className="flex justify-between text-[9px] text-muted-foreground mt-1">
            <button
              onClick={() => handleBpmChange(55)}
              className="hover:text-foreground hover:underline"
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
              className="hover:text-foreground hover:underline"
            >
              ورزش سنگین (۱۴۰)
            </button>
          </div>
        </div>

        <button
          onClick={() => viewer?.focusOnHeart()}
          className="w-full flex items-center justify-center gap-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-[11px] py-1 rounded border border-rose-500/30 transition-colors"
        >
          <Compass className="w-3 h-3" />
          تمرکز دوربین روی قلب و حفره‌های قلبی
        </button>
      </div>

      {/* Neuroanatomy & Cortical Lobes Section */}
      <div className="p-2.5 rounded-lg bg-sky-950/20 border border-sky-500/30 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-sky-400" />
            <span className="text-xs font-bold text-foreground">نوروآناتومی و لوب‌های مغزی</span>
          </div>
          <button
            onClick={toggleNeuro}
            className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
              isNeuroMode
                ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                : 'bg-muted text-muted-foreground border-border'
            }`}
          >
            {isNeuroMode ? 'حالت فعال' : 'مشاهده لوب‌ها'}
          </button>
        </div>

        {isNeuroMode && (
          <div className="space-y-1.5 pt-1 text-[11px]">
            <div className="flex items-center justify-between p-1 rounded bg-muted/40">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#38bdf8]" />
                لوب پیشانی (Frontal)
              </span>
              <span className="text-[10px] text-muted-foreground">حرکت و تفکر</span>
            </div>
            <div className="flex items-center justify-between p-1 rounded bg-muted/40">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#a855f7]" />
                لوب آهیانه (Parietal)
              </span>
              <span className="text-[10px] text-muted-foreground">پردازش حس‌ها</span>
            </div>
            <div className="flex items-center justify-between p-1 rounded bg-muted/40">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#10b981]" />
                لوب گیجگاهی (Temporal)
              </span>
              <span className="text-[10px] text-muted-foreground">شنوایی و زبان</span>
            </div>
            <div className="flex items-center justify-between p-1 rounded bg-muted/40">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#f59e0b]" />
                لوب پس‌سری (Occipital)
              </span>
              <span className="text-[10px] text-muted-foreground">بینایی</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
