import { Menu, Search, Bell, HelpCircle, Settings, Activity, Scissors } from 'lucide-react';

interface Props {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  showCrossSection: boolean;
  setShowCrossSection: (show: boolean) => void;
  showPhysiology: boolean;
  setShowPhysiology: (show: boolean) => void;
  onToggleSidebar?: () => void;
}

export function AnatomyHeader({
  searchQuery,
  setSearchQuery,
  showCrossSection,
  setShowCrossSection,
  showPhysiology,
  setShowPhysiology,
  onToggleSidebar
}: Props) {
  return (
    <header
      className="h-14 w-full bg-slate-950/90 border-b border-slate-800/80 px-4 flex items-center justify-between z-40 select-none backdrop-blur-md"
      dir="ltr"
    >
      {/* Left: Brand & Menu */}
      <div className="flex items-center gap-3">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        <div className="flex items-center gap-2">
          <span className="text-base font-bold text-white tracking-wide">Anatomy Explorer</span>
          <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-400 border border-sky-500/30">
            PRO 3D
          </span>
        </div>
      </div>

      {/* Center: Search Bar */}
      <div className="flex-1 max-w-md mx-4">
        <div className="relative flex items-center w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search organ, muscle, bone, or FMA ID (e.g. Femur, Heart, Kidney)..."
            className="w-full h-9 pl-9 pr-4 rounded-xl bg-slate-900 border border-slate-700/80 text-xs text-slate-200 placeholder-slate-400 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 transition"
          />
        </div>
      </div>

      {/* Right: Quick Tools & Status */}
      <div className="flex items-center gap-2">
        {/* Cross Section Tool */}
        <button
          onClick={() => setShowCrossSection(!showCrossSection)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
            showCrossSection
              ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
              : 'bg-slate-900/80 text-slate-300 border-slate-700 hover:bg-slate-800'
          }`}
          title="برش ۳ محوره مقطعی (Sagittal, Axial, Coronal)"
        >
          <Scissors className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">برش مقطعی</span>
        </button>

        {/* Physiology Heart Animation Tool */}
        <button
          onClick={() => setShowPhysiology(!showPhysiology)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
            showPhysiology
              ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
              : 'bg-slate-900/80 text-slate-300 border-slate-700 hover:bg-slate-800'
          }`}
          title="تپش قلب و نقشه‌برداری لوب‌های مغز"
        >
          <Activity className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">فیزیولوژی</span>
        </button>

        <div className="h-4 w-px bg-slate-800 mx-1" />

        {/* Header Action Icons */}
        <button className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition">
          <Bell className="w-4 h-4" />
        </button>
        <button className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition">
          <HelpCircle className="w-4 h-4" />
        </button>
        <button className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition">
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
