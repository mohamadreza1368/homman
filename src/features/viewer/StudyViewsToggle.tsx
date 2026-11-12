import { useInterfaceLanguage } from "@/stores/interfaceLanguage";
import { useSceneStore } from "@/stores/sceneStore";
import { useStudyViewsStore } from "@/stores/studyViewsStore";
import { OVERLAY_SWITCH_OFF, OVERLAY_SWITCH_ON } from "./overlayChrome";

export function StudyViewsToggle() {
  const fa = useInterfaceLanguage((s) => s.language === "fa");
  const isolatedOrganIds = useSceneStore((s) => s.isolatedOrganIds);
  const studyViews = useStudyViewsStore((s) => s.wanted);
  const setStudyViews = useStudyViewsStore((s) => s.setWanted);

  return (
    <button
      type="button"
      onClick={() => setStudyViews(!studyViews)}
      disabled={isolatedOrganIds === null}
      aria-pressed={studyViews}
      title={
        fa
          ? isolatedOrganIds === null
            ? "ابتدا یک ساختار را ایزوله کنید تا ۴ نمای هم‌زمان فعال شود"
            : "مشاهدهٔ ساختار ایزوله‌شده از سه زاویهٔ ثابت به‌همراه نمای اصلی"
          : isolatedOrganIds === null
            ? "Isolate a structure first — four views of the whole atlas will not hold a frame rate"
            : "See what is isolated from three fixed angles at once, beside the view you drive"
      }
      className={`pointer-events-auto rounded border px-2 py-1 text-xs disabled:cursor-not-allowed disabled:border-slate-800 disabled:text-slate-500 ${
        studyViews ? OVERLAY_SWITCH_ON.sky : OVERLAY_SWITCH_OFF
      }`}
    >
      {fa ? "نماهای مطالعه" : "Study views"}
    </button>
  );
}
