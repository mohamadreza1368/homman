import React, { useState } from 'react';
import {
  RotateCcw,
  Hand,
  Orbit,
  ZoomIn,
  ZoomOut,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Tags,
} from 'lucide-react';
import type { AnatomyViewer } from '../engine/AnatomyViewer';

interface Props {
  viewer: AnatomyViewer | null;
  showCallouts: boolean;
  onToggleCallouts: () => void;
}

export const CameraNavigationWidget: React.FC<Props> = ({
  viewer,
  showCallouts,
  onToggleCallouts,
}) => {
  const [isPanMode, setIsPanMode] = useState(false);

  const togglePanMode = () => {
    const next = !isPanMode;
    setIsPanMode(next);
    viewer?.setPanMode(next);
  };

  const handlePan = (dx: number, dy: number) => {
    viewer?.panCamera(dx, dy);
  };

  const handleZoom = (factor: number) => {
    viewer?.zoomCamera(factor);
  };

  const handleReset = () => {
    viewer?.resetView();
  };

  return (
    <div
      className="absolute bottom-6 left-6 z-30 flex items-center gap-2 bg-slate-950/85 backdrop-blur-xl border border-slate-800/80 rounded-2xl shadow-2xl p-2 text-slate-200 select-none"
      dir="ltr"
    >
      {/* Pan / Orbit Mode Switch */}
      <button
        onClick={togglePanMode}
        title={isPanMode ? 'تغییر به حالت چرخش ۳۶۰ درجه' : 'تغییر به حالت جابه‌جایی دستی (Pan)'}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
          isPanMode
            ? 'bg-sky-500/20 text-sky-300 border-sky-500/50 shadow-sm shadow-sky-500/20'
            : 'bg-slate-900/80 text-slate-300 border-slate-700/80 hover:bg-slate-800'
        }`}
      >
        {isPanMode ? <Hand className="w-4 h-4 text-sky-400" /> : <Orbit className="w-4 h-4 text-slate-400" />}
        <span className="hidden sm:inline">{isPanMode ? 'حالت جابه‌جایی (Pan)' : 'حالت چرخش (Orbit)'}</span>
      </button>

      <div className="w-px h-6 bg-slate-800" />

      {/* D-Pad Pan Directional Buttons */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => handlePan(0, 1)}
          title="حرکت دوربین به بالا (Pan Up)"
          className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition"
        >
          <ChevronUp className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => handlePan(0, -1)}
          title="حرکت دوربین به پایین (Pan Down)"
          className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => handlePan(-1, 0)}
          title="حرکت دوربین به چپ (Pan Left)"
          className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => handlePan(1, 0)}
          title="حرکت دوربین به راست (Pan Right)"
          className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="w-px h-6 bg-slate-800" />

      {/* Zoom In & Out */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => handleZoom(1)}
          title="بزرگ‌نمایی (Zoom In)"
          className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => handleZoom(-1)}
          title="کوچک‌نمایی (Zoom Out)"
          className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="w-px h-6 bg-slate-800" />

      {/* Reset View */}
      <button
        onClick={handleReset}
        title="تنظیم مجدد زاویه و موقعیت دوربین"
        className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-amber-400 border border-slate-800 transition"
      >
        <RotateCcw className="w-3.5 h-3.5" />
      </button>

      <div className="w-px h-6 bg-slate-800" />

      {/* Toggle Callout Labels */}
      <button
        onClick={onToggleCallouts}
        title={showCallouts ? 'مخفی‌سازی برچسب‌های راهنما' : 'نمایش برچسب‌های راهنما'}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all ${
          showCallouts
            ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
            : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-slate-200'
        }`}
      >
        <Tags className="w-3.5 h-3.5" />
        <span className="hidden md:inline">{showCallouts ? 'برچسب‌ها: روشن' : 'برچسب‌ها: خاموش'}</span>
      </button>
    </div>
  );
};
