import { useEffect } from "react";

import { useInterfaceLanguage } from "@/stores/interfaceLanguage";
import { useSceneStore } from "@/stores/sceneStore";

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

  const studying = isolatedOrganIds !== null && isolatedOrganIds.length > 0;

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
    <div className="pointer-events-none absolute bottom-3 right-3">
      <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900/95 px-2 py-1 shadow-lg backdrop-blur">
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
          {fa ? "تنظیم کادر" : "Fit"}
        </Key>

        <span aria-hidden className="mx-0.5 h-4 w-px bg-slate-700" />

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

        <span aria-hidden className="mx-0.5 h-4 w-px bg-slate-700" />

        <Key onClick={() => dollyView(DOLLY_OUT)} title={fa ? "دور شدن — کلید −" : "Move further away — key −"}>
          −
        </Key>
        <Key onClick={() => dollyView(DOLLY_IN)} title={fa ? "نزدیک شدن — کلید +" : "Move closer in — key +"}>
          +
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
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  wide?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`h-6 rounded-full text-[11px] font-medium text-slate-300 transition hover:bg-slate-800 hover:text-sky-300 ${
        wide ? "px-2" : "w-6"
      }`}
    >
      {children}
    </button>
  );
}
