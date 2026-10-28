import React, { useState } from 'react';
import { Scissors, RotateCcw, Eye } from 'lucide-react';
import { AnatomyViewer } from '../engine/AnatomyViewer';

interface CrossSectionPanelProps {
  viewer: AnatomyViewer | null;
  onClose: () => void;
}

export const CrossSectionPanel: React.FC<CrossSectionPanelProps> = ({ viewer, onClose }) => {
  const [axialEnabled, setAxialEnabled] = useState(viewer?.clippingState.axial ?? false);
  const [axialOffset, setAxialOffset] = useState(viewer?.clippingState.axialOffset ?? 1.25);

  const [sagittalEnabled, setSagittalEnabled] = useState(viewer?.clippingState.sagittal ?? false);
  const [sagittalOffset, setSagittalOffset] = useState(viewer?.clippingState.sagittalOffset ?? 0.0);

  const [coronalEnabled, setCoronalEnabled] = useState(viewer?.clippingState.coronal ?? false);
  const [coronalOffset, setCoronalOffset] = useState(viewer?.clippingState.coronalOffset ?? 0.0);

  const handleAxialToggle = () => {
    const next = !axialEnabled;
    setAxialEnabled(next);
    viewer?.setAxialClipping(next, axialOffset);
  };

  const handleAxialChange = (val: number) => {
    setAxialOffset(val);
    if (axialEnabled) viewer?.setAxialClipping(true, val);
  };

  const handleSagittalToggle = () => {
    const next = !sagittalEnabled;
    setSagittalEnabled(next);
    viewer?.setSagittalClipping(next, sagittalOffset);
  };

  const handleSagittalChange = (val: number) => {
    setSagittalOffset(val);
    if (sagittalEnabled) viewer?.setSagittalClipping(true, val);
  };

  const handleCoronalToggle = () => {
    const next = !coronalEnabled;
    setCoronalEnabled(next);
    viewer?.setCoronalClipping(next, coronalOffset);
  };

  const handleCoronalChange = (val: number) => {
    setCoronalOffset(val);
    if (coronalEnabled) viewer?.setCoronalClipping(true, val);
  };

  const handleResetSlices = () => {
    setAxialEnabled(false);
    setSagittalEnabled(false);
    setCoronalEnabled(false);
    viewer?.setAxialClipping(false, 1.25);
    viewer?.setSagittalClipping(false, 0.0);
    viewer?.setCoronalClipping(false, 0.0);
  };

  return (
    <div className="absolute bottom-6 right-84 bg-card/95 backdrop-blur-lg border border-border p-4 rounded-xl shadow-2xl z-20 w-84 select-none space-y-3 animate-in fade-in slide-in-from-bottom duration-200">
      <div className="flex items-center justify-between border-b border-border pb-2">
        <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5">
          <Scissors className="w-3.5 h-3.5 text-rose-500" />
          برش مقطعی سه‌محوره بلادرنگ (Cross-Section)
        </h3>
        <button
          onClick={handleResetSlices}
          title="بازنشانی تمام صفحات برش"
          className="p-1 hover:bg-muted text-muted-foreground hover:text-foreground rounded transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Axial Plane (محوری / افقی) */}
      <div className="p-2.5 rounded-lg bg-muted/40 border border-border/60 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
            صفحه آگزیال / محوری (Y)
          </span>
          <button
            onClick={handleAxialToggle}
            className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
              axialEnabled
                ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                : 'bg-muted text-muted-foreground border-border'
            }`}
          >
            {axialEnabled ? 'فعال' : 'خاموش'}
          </button>
        </div>
        {axialEnabled && (
          <div>
            <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
              <span>ارتفاع برش:</span>
              <span>{axialOffset.toFixed(2)} m</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="1.8"
              step="0.02"
              value={axialOffset}
              onChange={(e) => handleAxialChange(parseFloat(e.target.value))}
              className="w-full accent-rose-500 cursor-pointer h-1.5 bg-muted rounded-lg"
            />
          </div>
        )}
      </div>

      {/* Sagittal Plane (ساجیتال / طولی) */}
      <div className="p-2.5 rounded-lg bg-muted/40 border border-border/60 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-sky-500 inline-block" />
            صفحه ساجیتال / چپ و راست (X)
          </span>
          <button
            onClick={handleSagittalToggle}
            className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
              sagittalEnabled
                ? 'bg-sky-500/20 text-sky-400 border-sky-500/40'
                : 'bg-muted text-muted-foreground border-border'
            }`}
          >
            {sagittalEnabled ? 'فعال' : 'خاموش'}
          </button>
        </div>
        {sagittalEnabled && (
          <div>
            <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
              <span>آفست ساجیتال:</span>
              <span>{sagittalOffset.toFixed(2)} m</span>
            </div>
            <input
              type="range"
              min="-0.3"
              max="0.3"
              step="0.01"
              value={sagittalOffset}
              onChange={(e) => handleSagittalChange(parseFloat(e.target.value))}
              className="w-full accent-sky-500 cursor-pointer h-1.5 bg-muted rounded-lg"
            />
          </div>
        )}
      </div>

      {/* Coronal Plane (کرونال / قدامی خلفی) */}
      <div className="p-2.5 rounded-lg bg-muted/40 border border-border/60 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            صفحه کرونال / قدامی-خلفی (Z)
          </span>
          <button
            onClick={handleCoronalToggle}
            className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
              coronalEnabled
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                : 'bg-muted text-muted-foreground border-border'
            }`}
          >
            {coronalEnabled ? 'فعال' : 'خاموش'}
          </button>
        </div>
        {coronalEnabled && (
          <div>
            <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
              <span>عمق قدامی-خلفی:</span>
              <span>{coronalOffset.toFixed(2)} m</span>
            </div>
            <input
              type="range"
              min="-0.2"
              max="0.2"
              step="0.01"
              value={coronalOffset}
              onChange={(e) => handleCoronalChange(parseFloat(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-muted rounded-lg"
            />
          </div>
        )}
      </div>
    </div>
  );
};
