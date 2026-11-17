import { useEffect } from "react";

import { useInterfaceLanguage } from "@/stores/interfaceLanguage";
import { GLASS_OPACITY, useSceneStore } from "@/stores/sceneStore";

import {
  DOLLY_IN,
  DOLLY_OUT,
  FIT_KEY,
  VIEW_FOR_KEY,
  VIEW_HINT,
  VIEW_LABEL,
  VIEW_ORDER,
  zoomKeyFor,
  type AnatomicalView,
} from "./cameraViews";
import { viewportKey } from "./viewportKeys";

const VIEW_LABEL_FA: Record<AnatomicalView, string> = {
  anterior: "قدامی",
  posterior: "خلفی",
  left: "چپ",
  right: "راست",
  superior: "فوقانی",
};

const VIEW_HINT_FA: Record<AnatomicalView, string> = {
  anterior: "نمای قدامی (رو به رو) — کلید A",
  posterior: "نمای خلفی (پشت) — کلید P",
  left: "نمای پهلوی چپ — کلید L",
  right: "نمای پهلوی راست — کلید R",
  superior: "نمای فوقانی (از بالا) — کلید S",
};

export function ViewpointBar() {
  const fa = useInterfaceLanguage((s) => s.language === "fa");
  const fitView = useSceneStore((s) => s.fitView);
  const orientView = useSceneStore((s) => s.orientView);
  const dollyView = useSceneStore((s) => s.dollyView);
  const isolatedOrganIds = useSceneStore((s) => s.isolatedOrganIds);
  const glassBody = useSceneStore((s) => s.glassBody);
  const manifest = useSceneStore((s) => s.manifest);
  const systemOpacity = useSceneStore((s) => s.systemOpacity);
  const explode = useSceneStore((s) => s.explode);
  const cycleExplode = useSceneStore((s) => s.cycleExplode);

  const studying = isolatedOrganIds !== null && isolatedOrganIds.length > 0;
  const isGlass =
    (manifest?.systems.length ?? 0) > 0 &&
    (manifest?.systems ?? []).every(
      (entry) => systemOpacity[entry.system] === GLASS_OPACITY,
    );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const key = viewportKey(event);
      if (key === null) return;

      const direction = zoomKeyFor(event);
      if (direction !== null) {
        dollyView(direction === "in" ? DOLLY_IN : DOLLY_OUT);
        event.preventDefault();
        return;
      }

      if (key === FIT_KEY) {
        fitView();
        event.preventDefault();
        return;
      }

      const view = VIEW_FOR_KEY[key];
      if (view === undefined) return;
      orientView(view);
      event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dollyView, fitView, orientView]);

  return (
    <div className="pointer-events-none absolute bottom-3 right-3 z-20">
      <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-teal-500/30 bg-slate-900/90 px-2.5 py-1 shadow-2xl backdrop-blur-xl ring-1 ring-white/10">
        <Key
          onClick={fitView}
          title={
            fa
              ? studying
                ? `تنظیم کادر روی ${isolatedOrganIds.length} ساختار — کلید F`
                : "تنظیم کادر روی کل بدن — کلید F"
              : studying
                ? `Frame the ${isolatedOrganIds.length} structures you are studying — key F`
                : "Frame the whole body — key F"
          }
          wide
        >
          {fa ? "کادر" : "Fit"}
        </Key>

        <span aria-hidden className="mx-0.5 h-4 w-px bg-slate-700/60" />

        <div className="flex items-center gap-0.5">
          {VIEW_ORDER.map((view) => (
            <Key
              key={view}
              onClick={() => orientView(view)}
              title={fa ? VIEW_HINT_FA[view] : `${VIEW_HINT[view]} — key ${VIEW_LABEL[view]}`}
              wide={fa}
            >
              {fa ? VIEW_LABEL_FA[view] : VIEW_LABEL[view]}
            </Key>
          ))}
        </div>

        <span aria-hidden className="mx-0.5 h-4 w-px bg-slate-700/60" />

        <Key onClick={() => dollyView(DOLLY_OUT)} title={fa ? "دور شدن — کلید −" : "Move further away — key −"}>
          −
        </Key>
        <Key onClick={() => dollyView(DOLLY_IN)} title={fa ? "نزدیک شدن — کلید +" : "Move closer in — key +"}>
          +
        </Key>

        <span aria-hidden className="mx-0.5 h-4 w-px bg-slate-700/60" />

        <Key
          onClick={glassBody}
          title={fa ? "حالت بافت شفاف (شیشه‌ای) برای دیدن اعضای عمقی" : "Glass body mode"}
          active={isGlass}
          wide
        >
          {fa ? "شفاف" : "Glass"}
        </Key>

        <Key
          onClick={cycleExplode}
          title={fa ? `انفجار قطعات آناتومیک (${Math.round(explode * 100)}%) — کلید X` : `Explode anatomy (${Math.round(explode * 100)}%) — key X`}
          active={explode > 0}
          wide
        >
          {fa ? "انفجار" : "Explode"}
        </Key>
      </div>
    </div>
  );
}

function Key({
  children,
  onClick,
  title,
  wide = false,
  active = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  wide?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`h-6 rounded-full text-[11px] font-medium transition ${
        active
          ? "bg-teal-500/20 text-teal-300 ring-1 ring-teal-400/40"
          : "text-slate-300 hover:bg-slate-800 hover:text-sky-300"
      } ${wide ? "px-2" : "w-6"}`}
    >
      {children}
    </button>
  );
}
