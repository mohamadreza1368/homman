import React, { useState } from 'react';
import { Scissors, RotateCcw } from 'lucide-react';
import { AnatomyViewer } from '../engine/AnatomyViewer';
import { DraggablePanel } from './DraggablePanel';

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
    <DraggablePanel
      id="cross-section-panel"
      title="برش مقطعی سه‌محوره (Cross-Section)"
      icon={<Scissors className="w-4 h-4 text-rose-400" />}
      initialPos={{ x: 330, y: 390 }}
      width="w-84"
      onClose={onClose}
      headerExtra={
        <button
          onClick={handleResetSlices}
          title="بازنشانی تمام صفحات برش"
          className="p-1 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded transition"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      }
    >
      <div className="space-y-3 select-none" dir="rtl">
        {/* Axial Plane (محوری / افقی) */}
        <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
              صفحه آگزیال / افقی (Y)
            </span>
            <button
              onClick={handleAxialToggle}
              className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                axialEnabled
                  ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              {axialEnabled ? 'فعال' : 'خاموش'}
            </button>
          </div>
          {axialEnabled && (
            <div className="pt-1">
              <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                <span>ارتفاع مقطع:</span>
                <span className="text-rose-400 font-semibold">{axialOffset.toFixed(2)} m</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.8"
                step="0.02"
                value={axialOffset}
                onChange={(e) => handleAxialChange(parseFloat(e.target.value))}
                className="w-full accent-rose-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg mt-1"
              />
            </div>
          )}
        </div>

        {/* Sagittal Plane (ساجیتال / طولی) */}
        <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-sky-500 inline-block" />
              صفحه ساجیتال / چپ و راست (X)
            </span>
            <button
              onClick={handleSagittalToggle}
              className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                sagittalEnabled
                  ? 'bg-sky-500/20 text-sky-400 border-sky-500/40'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              {sagittalEnabled ? 'فعال' : 'خاموش'}
            </button>
          </div>
          {sagittalEnabled && (
            <div className="pt-1">
              <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                <span>آفست ساجیتال:</span>
                <span className="text-sky-400 font-semibold">{sagittalOffset.toFixed(2)} m</span>
              </div>
              <input
                type="range"
                min="-0.3"
                max="0.3"
                step="0.01"
                value={sagittalOffset}
                onChange={(e) => handleSagittalChange(parseFloat(e.target.value))}
                className="w-full accent-sky-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg mt-1"
              />
            </div>
          )}
        </div>

        {/* Coronal Plane (کرونال / قدامی خلفی) */}
        <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              صفحه کرونال / قدامی-خلفی (Z)
            </span>
            <button
              onClick={handleCoronalToggle}
              className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                coronalEnabled
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              {coronalEnabled ? 'فعال' : 'خاموش'}
            </button>
          </div>
          {coronalEnabled && (
            <div className="pt-1">
              <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                <span>عمق قدامی-خلفی:</span>
                <span className="text-emerald-400 font-semibold">{coronalOffset.toFixed(2)} m</span>
              </div>
              <input
                type="range"
                min="-0.2"
                max="0.2"
                step="0.01"
                value={coronalOffset}
                onChange={(e) => handleCoronalChange(parseFloat(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg mt-1"
              />
            </div>
          )}
        </div>
      </div>
    </DraggablePanel>
  );
};
