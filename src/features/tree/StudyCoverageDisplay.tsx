import { busiestTouches, coverageLegend } from "@/features/viewer/coverage";
import { useInterfaceLanguage } from "@/stores/interfaceLanguage";
import { useStudyStore } from "@/stores/studyStore";

export function StudyCoverageDisplay() {
  const isPersian = useInterfaceLanguage((state) => state.language === "fa");
  const isCoverageActive = useStudyStore((state) => state.coverageVisible);
  const setCoverageActive = useStudyStore((state) => state.setCoverageVisible);
  const coverageData = useStudyStore((state) => state.coverage);

  const maxTouches = busiestTouches(coverageData);
  const totalStudiedOrgans = Object.keys(coverageData).length;

  return (
    <>
      <label className="flex cursor-pointer items-center gap-2 pt-1 text-xs text-slate-300">
        <input
          type="checkbox"
          checked={isCoverageActive}
          onChange={(event) => void setCoverageActive(event.target.checked)}
          className="accent-teal-400"
        />
        <span>{isPersian ? "نمایش بخش‌های مطالعه‌شده" : "Show what I have studied"}</span>
      </label>

      {!isCoverageActive && (
        <p className="text-[10px] leading-snug text-slate-600">
          Colours the body by your own notes and sessions, so the parts you have not
          worked on are the ones that stay grey.
        </p>
      )}

      {isCoverageActive && maxTouches === 0 && (
        <p className="text-[10px] leading-snug text-slate-600">
          Nothing filed against a structure yet. Write a note or ask about something
          with it selected, and it will start to show here.
        </p>
      )}

      {isCoverageActive && maxTouches > 0 && (
        <div className="space-y-1 pt-0.5">
          <div className="flex items-center gap-2">
            {coverageLegend(maxTouches).map(({ label, hex }) => (
              <span key={label} className="flex items-center gap-1">
                <span
                  aria-hidden
                  className="h-2 w-2 rounded-full ring-1 ring-inset ring-black/30"
                  style={{ backgroundColor: hex }}
                />
                <span className="text-[9px] text-slate-500">{label}</span>
              </span>
            ))}
          </div>
          <p className="text-[10px] leading-snug text-slate-600">
            {totalStudiedOrgans} structure{totalStudiedOrgans === 1 ? "" : "s"} touched. The scale is
            relative to your own journal, not to the atlas — the brightest is
            whatever you have worked on most.
          </p>
        </div>
      )}
    </>
  );
}
