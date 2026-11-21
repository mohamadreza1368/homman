import { explodeScope, MAX_EXPLODE } from "@/features/viewer/explode";
import { useInterfaceLanguage } from "@/stores/interfaceLanguage";
import { useSceneStore } from "@/stores/sceneStore";

export function ExplodedViewSlider() {
  const isPersian = useInterfaceLanguage((state) => state.language === "fa");
  const explodeFactor = useSceneStore((state) => state.explode);
  const updateExplode = useSceneStore((state) => state.setExplode);
  const activeSelectedIds = useSceneStore((state) => state.selectedOrganIds);
  const activeIsolatedIds = useSceneStore((state) => state.isolatedOrganIds);

  const activeScope = explodeScope({
    selectedOrganIds: activeSelectedIds,
    isolatedOrganIds: activeIsolatedIds,
  });

  const subjectScopeDescription =
    activeScope === "selection"
      ? `the ${activeSelectedIds.length} structures you have selected`
      : activeScope === "region"
        ? `the ${activeIsolatedIds?.length ?? 0} parts you are studying`
        : "everything on screen";

  return (
    <section className="space-y-1 border-t border-slate-800 pt-3">
      <div className="flex items-center gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {isPersian ? "نمای بازشده" : "Exploded view"}
        </h2>
        {explodeFactor > 0 && (
          <button
            type="button"
            onClick={() => updateExplode(0)}
            className="ml-auto rounded border border-violet-700/70 bg-violet-600/15 px-2 py-0.5 text-[10px] text-violet-300"
          >
            {isPersian ? "بازگرداندن" : "Reassemble"}
          </button>
        )}
      </div>
      <input
        type="range"
        min={0}
        max={MAX_EXPLODE}
        step={0.05}
        value={explodeFactor}
        aria-label="How far apart to push the parts"
        onChange={(event) => updateExplode(Number(event.target.value))}
        className="w-full accent-violet-500"
      />
      <p className="text-[10px] leading-snug text-slate-600">
        {isPersian ? (
          "اجزای انتخاب‌شده یا ساختارهای نمایش‌داده‌شده از مرکز خود فاصله می‌گیرند. برای بازگشت لغزنده را روی صفر قرار دهید؛ کلید X نیز مراحل را تغییر می‌دهد."
        ) : (
          <>
            Pushes {subjectScopeDescription} apart, away from its own centre, so you can see
            the faces that are normally pressed together. Nothing is hidden and nothing
            moves out of order — slide back to zero for the anatomy exactly as it was.{" "}
            <kbd>X</kbd> steps through it from the keyboard.
          </>
        )}
      </p>
    </section>
  );
}
