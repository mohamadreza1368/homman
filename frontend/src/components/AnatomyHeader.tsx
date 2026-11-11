import { useMemo } from 'react';
import { Menu, Search, HelpCircle, Activity, Scissors, Gauge } from 'lucide-react';
import { searchPublishedCatalog } from '../data/anatomyRegistry';
import type { AnatomyRecord } from '../types/anatomy';

interface Props {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onSelectSearchRecord: (record: AnatomyRecord) => void;
  showCrossSection: boolean;
  setShowCrossSection: (show: boolean) => void;
  showPhysiology: boolean;
  setShowPhysiology: (show: boolean) => void;
  liteMode: boolean;
  onToggleLiteMode: () => void;
  onOpenDisclaimer: () => void;
  onToggleSidebar?: () => void;
}

export function AnatomyHeader({
  searchQuery,
  setSearchQuery,
  onSelectSearchRecord,
  showCrossSection,
  setShowCrossSection,
  showPhysiology,
  setShowPhysiology,
  liteMode,
  onToggleLiteMode,
  onOpenDisclaimer,
  onToggleSidebar,
}: Props) {
  const results = useMemo(() => searchPublishedCatalog(searchQuery).slice(0, 8), [searchQuery]);

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
            title="پنل لایه‌های آناتومی"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        <div className="flex items-center gap-2" dir="rtl">
          <span className="text-base font-bold text-white tracking-wide whitespace-nowrap">هومان 3D</span>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 whitespace-nowrap">
            اطلس آموزشی
          </span>
        </div>
      </div>

      {/* Center: Deterministic Search Bar with Dropdown */}
      <div className="flex-1 max-w-md mx-4 relative" dir="rtl">
        <div className="relative flex items-center w-full">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 pointer-events-none" />
          <input
            data-testid="anatomy-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && results.length > 0) {
                onSelectSearchRecord(results[0]);
                setSearchQuery('');
              }
            }}
            placeholder="جستجوی ساختار (مثلاً قلب، Heart، Femur، FMA7088)..."
            className="w-full h-9 pr-9 pl-4 rounded-xl bg-slate-900 border border-slate-700/80 text-xs text-slate-200 placeholder-slate-400 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 transition"
          />
        </div>

        {searchQuery.trim().length > 0 && (
          <div
            data-testid="search-results-dropdown"
            className="absolute left-0 right-0 top-11 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-h-72 overflow-y-auto z-50 divide-y divide-slate-800/70"
            dir="rtl"
          >
            {results.length === 0 ? (
              <div className="p-3 text-xs text-slate-400 text-center">
                ساختاری مطابق «{searchQuery}» در کاتالوگ تاییدشده یافت نشد.
              </div>
            ) : (
              results.map((rec) => (
                <button
                  key={rec.id}
                  data-testid={`search-result-${rec.fmaId ?? rec.id}`}
                  onClick={() => {
                    onSelectSearchRecord(rec);
                    setSearchQuery('');
                  }}
                  className="w-full px-3 py-2 text-right hover:bg-slate-800/90 transition flex items-center justify-between gap-2"
                >
                  <div>
                    <div className="text-xs font-bold text-slate-100">{rec.nameFa}</div>
                    <div className="text-[11px] text-slate-400 font-sans">{rec.nameEn}</div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {rec.fmaId && (
                      <span className="text-[10px] font-mono bg-sky-500/15 text-sky-300 border border-sky-500/30 px-1.5 py-0.5 rounded">
                        {rec.fmaId}
                      </span>
                    )}
                    <span className="text-[9px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                      {rec.system}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Right: Quick Tools & Educational Modes */}
      <div className="flex items-center gap-2">
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

        <button
          onClick={() => setShowPhysiology(!showPhysiology)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
            showPhysiology
              ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
              : 'bg-slate-900/80 text-slate-300 border-slate-700 hover:bg-slate-800'
          }`}
          title="نمایش آموزشی چرخه قلب و نواحی مغزی"
        >
          <Activity className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">نمایش فیزیولوژی</span>
        </button>

        <button
          data-testid="lite-mode-toggle"
          onClick={onToggleLiteMode}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition ${
            liteMode
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
              : 'bg-slate-900/80 text-slate-300 border-slate-700 hover:bg-slate-800'
          }`}
          title="حالت سبک رندرینگ برای موبایل و سخت‌افزارهای ضعیف‌تر"
        >
          <Gauge className="w-3.5 h-3.5" />
          <span className="hidden md:inline">{liteMode ? 'حالت سبک: روشن' : 'حالت سبک'}</span>
        </button>

        <div className="h-4 w-px bg-slate-800 mx-0.5" />

        <button
          data-testid="open-disclaimer-btn"
          onClick={onOpenDisclaimer}
          title="سلب مسئولیت پزشکی، منابع علمی و راهنما"
          className="p-1.5 rounded-lg text-amber-300/90 hover:text-amber-200 hover:bg-slate-800 transition"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
