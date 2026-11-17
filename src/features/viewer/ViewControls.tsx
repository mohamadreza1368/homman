import { GLASS_OPACITY, useSceneStore } from "@/stores/sceneStore";
import { useInterfaceLanguage } from "@/stores/interfaceLanguage";

/**
 * How the model is drawn, as opposed to what is in it.
 */
export function ViewControls() {
  const fa = useInterfaceLanguage((s) => s.language === 'fa');
  const isolatedOrganIds = useSceneStore((s) => s.isolatedOrganIds);
  const clearIsolation = useSceneStore((s) => s.clearIsolation);
  const showAllSystems = useSceneStore((s) => s.showAllSystems);
  const glassBody = useSceneStore((s) => s.glassBody);
  const bodyTone = useSceneStore((s) => s.bodyTone);
  const cycleBodyTone = useSceneStore((s) => s.cycleBodyTone);
  const systemOpacity = useSceneStore((s) => s.systemOpacity);
  const clearGhosting = useSceneStore((s) => s.clearGhosting);
  const resetView = useSceneStore((s) => s.resetView);
  const manifest = useSceneStore((s) => s.manifest);

  const isGlass =
    (manifest?.systems.length ?? 0) > 0 &&
    (manifest?.systems ?? []).every(
      (entry) => systemOpacity[entry.system] === GLASS_OPACITY,
    );

  return (
    <section className="shrink-0 border-t border-slate-800/80 bg-slate-950/40 p-3">
      {isolatedOrganIds !== null && (
        <button
          type="button"
          onClick={clearIsolation}
          className="mb-2 w-full rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-center text-xs font-medium text-amber-300 transition hover:bg-amber-500/20"
        >
          {fa ? `نمایش ${isolatedOrganIds.length} مورد ایزوله — پاک کردن` : `Showing ${isolatedOrganIds.length} isolated — clear`}
        </button>
      )}

      <div className="grid grid-cols-2 gap-1.5">
        <button
          type="button"
          onClick={showAllSystems}
          className="rounded-lg border border-slate-700/80 bg-slate-900/60 px-2 py-1.5 text-center text-[11px] font-medium text-slate-300 transition hover:border-teal-500/50 hover:text-white"
        >
          {fa ? 'همهٔ دستگاه‌ها' : 'All systems'}
        </button>

        <button
          type="button"
          onClick={glassBody}
          title="Turn the whole body to glass"
          aria-pressed={isGlass}
          className={`rounded-lg border px-2 py-1.5 text-center text-[11px] font-medium transition ${
            isGlass
              ? "border-teal-400 bg-teal-500/20 text-teal-200"
              : "border-slate-700/80 bg-slate-900/60 text-slate-300 hover:border-teal-500/50 hover:text-white"
          }`}
        >
          {fa ? 'بدن شفاف' : 'Glass body'}
        </button>

        <button
          type="button"
          onClick={cycleBodyTone}
          title="Tone cycle"
          aria-pressed={bodyTone !== "solid"}
          className={`rounded-lg border px-2 py-1.5 text-center text-[11px] font-medium transition ${
            bodyTone === "carbon"
              ? "border-slate-400 bg-slate-800 text-white"
              : bodyTone === "scan"
                ? "border-cyan-500/60 bg-cyan-950/40 text-cyan-200"
                : "border-slate-700/80 bg-slate-900/60 text-slate-300 hover:border-teal-500/50 hover:text-white"
          }`}
        >
          {bodyTone === "carbon" ? (fa ? 'رنگ کربنی' : 'Carbon') : bodyTone === "scan" ? (fa ? 'رنگ اسکن' : 'Scan') : (fa ? 'رنگ طبیعی' : 'Natural')}
        </button>

        <button
          type="button"
          onClick={resetView}
          className="rounded-lg border border-slate-700/80 bg-slate-900/60 px-2 py-1.5 text-center text-[11px] font-medium text-slate-300 transition hover:border-rose-500/50 hover:text-rose-200"
        >
          {fa ? 'بازنشانی نما' : 'Reset view'}
        </button>
      </div>

      {Object.keys(systemOpacity).length > 0 && (
        <button
          type="button"
          onClick={clearGhosting}
          title="Make every layer solid again"
          className="mt-1.5 w-full rounded-lg border border-sky-600/40 bg-sky-950/30 px-2 py-1 text-center text-[11px] text-sky-300 transition hover:bg-sky-900/40"
        >
          {fa ? 'بازگشت به حالت توپر' : 'Solid again'}
        </button>
      )}
    </section>
  );
}
