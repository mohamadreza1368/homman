import React, { useState } from 'react';
import { Search, Eye, EyeOff, Sliders, Scissors, RotateCcw } from 'lucide-react';
import { AnatomyViewer } from '../engine/AnatomyViewer';

interface SidebarProps {
  viewer: AnatomyViewer | null;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
}

const SYSTEMS = [
  { id: 'Skeletal', nameFa: 'دستگاه اسکلتی (استخوان‌ها)', count: '۲۶۰ قطعه' },
  { id: 'Circulatory', nameFa: 'دستگاه گردش خون و قلب', count: 'قلب و عروق' },
  { id: 'Respiratory', nameFa: 'دستگاه تنفس (ریه‌ها)', count: 'مجاری و ریه' },
  { id: 'Digestive', nameFa: 'دستگاه گوارش (کبد و احشا)', count: 'ارگان‌های شکمی' },
  { id: 'Nervous', nameFa: 'دستگاه عصبی و مغز', count: 'مخ و نخاع' },
];

export const Sidebar: React.FC<SidebarProps> = ({ viewer, searchQuery, setSearchQuery }) => {
  const [activeSystems, setActiveSystems] = useState<Record<string, boolean>>({
    Skeletal: true,
    Circulatory: true,
    Respiratory: true,
    Digestive: true,
    Nervous: true,
  });

  const [explodeFactor, setExplodeFactor] = useState(0);
  const [clippingActive, setClippingActive] = useState(false);
  const [clippingPlaneY, setClippingPlaneY] = useState(1.3);

  const toggleSystem = (systemId: string) => {
    const nextState = !activeSystems[systemId];
    setActiveSystems((prev) => ({ ...prev, [systemId]: nextState }));
    if (viewer) {
      viewer.setSystemVisibility(systemId, nextState);
    }
  };

  const handleExplodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setExplodeFactor(val);
    if (viewer) {
      viewer.setExplodeView(val);
    }
  };

  const toggleClipping = () => {
    const next = !clippingActive;
    setClippingActive(next);
    if (viewer) {
      viewer.setClipping(next, clippingPlaneY);
    }
  };

  const handleClippingYChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setClippingPlaneY(val);
    if (viewer && clippingActive) {
      viewer.setClipping(true, val);
    }
  };

  const handleResetCamera = () => {
    if (viewer) {
      viewer.controls.reset();
      viewer.camera.position.set(0, 1.2, 2.5);
      viewer.controls.target.set(0, 1.1, 0);
      viewer.resetSelection();
      setExplodeFactor(0);
      viewer.setExplodeView(0);
    }
  };

  return (
    <aside className="w-80 bg-card/70 backdrop-blur-md border-l border-border h-full flex flex-col z-20 select-none overflow-y-auto">
      {/* Search Input */}
      <div className="p-3 border-b border-border">
        <div className="relative">
          <Search className="w-4 h-4 text-muted-foreground absolute right-3 top-2.5" />
          <input
            type="text"
            placeholder="جستجوی ساختار (فارسی، English، FMAID)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-muted/60 border border-border rounded-lg pr-9 pl-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-primary transition-colors"
          />
        </div>
      </div>

      {/* Anatomy Interaction Controls */}
      <div className="p-3 border-b border-border space-y-4">
        <div>
          <div className="flex items-center justify-between text-xs font-semibold text-foreground mb-1.5">
            <span className="flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-primary" />
              نمای انفجاری (Explode View)
            </span>
            <span className="font-mono text-primary text-[11px]">{Math.round(explodeFactor * 100)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={explodeFactor}
            onChange={handleExplodeChange}
            className="w-full accent-primary cursor-pointer h-1.5 bg-muted rounded-lg"
          />
          <p className="text-[10px] text-muted-foreground mt-1">
            جداسازی شعاعی قطعات کالبدی جهت مشاهده ساختارهای عمقی
          </p>
        </div>

        {/* Real-time Clipping Plane */}
        <div className="pt-2 border-t border-border/50">
          <div className="flex items-center justify-between text-xs font-semibold text-foreground mb-2">
            <span className="flex items-center gap-1.5">
              <Scissors className="w-3.5 h-3.5 text-rose-500" />
              برش مقطعی بلادرنگ (Cross-Section)
            </span>
            <button
              onClick={toggleClipping}
              className={`text-[11px] px-2 py-0.5 rounded border transition-colors ${
                clippingActive
                  ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                  : 'bg-muted text-muted-foreground border-border'
              }`}
            >
              {clippingActive ? 'فعال' : 'غیرفعال'}
            </button>
          </div>
          {clippingActive && (
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>صفحه برش محوری (Axial Plane)</span>
                <span className="font-mono">{clippingPlaneY.toFixed(2)} m</span>
              </div>
              <input
                type="range"
                min="0.2"
                max="1.8"
                step="0.02"
                value={clippingPlaneY}
                onChange={handleClippingYChange}
                className="w-full accent-rose-500 cursor-pointer h-1.5 bg-muted rounded-lg"
              />
            </div>
          )}
        </div>

        <button
          onClick={handleResetCamera}
          className="w-full flex items-center justify-center gap-1.5 bg-muted hover:bg-muted/80 text-foreground text-xs py-1.5 rounded-lg border border-border transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          تنظیم مجدد زاویه دید و موقعیت دوربین
        </button>
      </div>

      {/* Systems Layers */}
      <div className="p-3 flex-1">
        <h2 className="text-xs font-semibold text-foreground mb-2 flex items-center justify-between">
          <span>لایه‌های سیستم‌های بدن (۱۵ سیستم)</span>
          <span className="text-[10px] text-muted-foreground font-mono">FMA Hierarchy</span>
        </h2>
        <div className="space-y-1.5">
          {SYSTEMS.map((sys) => {
            const isActive = activeSystems[sys.id];
            return (
              <div
                key={sys.id}
                className={`p-2 rounded-lg border transition-all flex items-center justify-between text-xs ${
                  isActive
                    ? 'bg-card border-border text-foreground'
                    : 'bg-muted/20 border-transparent text-muted-foreground/60'
                }`}
              >
                <div>
                  <div className="font-medium text-[12px]">{sys.nameFa}</div>
                  <div className="text-[10px] text-muted-foreground font-mono">{sys.count}</div>
                </div>
                <button
                  onClick={() => toggleSystem(sys.id)}
                  className="p-1 rounded hover:bg-muted transition-colors text-primary"
                >
                  {isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4 text-muted-foreground" />}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
};
