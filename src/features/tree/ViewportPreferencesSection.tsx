import { memo } from "react";
import { useSceneStore } from "@/stores/sceneStore";
import { useInterfaceLanguage } from "@/stores/interfaceLanguage";
import { StudyCoverageDisplay } from "./StudyCoverageDisplay";
import { ViewportCaptureButton } from "./ViewportCaptureButton";

export const ViewportPreferencesSection = memo(function ViewportPreferencesSection() {
  const isPersian = useInterfaceLanguage((state) => state.language === "fa");

  const isEyeTrackingActive = useSceneStore((state) => state.eyeTracking);
  const setEyeTrackingActive = useSceneStore((state) => state.setEyeTracking);
  const depthProbeVisible = useSceneStore((state) => state.depthProbeVisible);
  const setDepthProbeVisible = useSceneStore((state) => state.setDepthProbeVisible);
  const labelsVisible = useSceneStore((state) => state.labelsVisible);
  const setLabelsVisible = useSceneStore((state) => state.setLabelsVisible);
  const hideConnective = useSceneStore((state) => state.hideConnective);
  const setHideConnective = useSceneStore((state) => state.setHideConnective);
  const sceneBackground = useSceneStore((state) => state.background);
  const setSceneBackground = useSceneStore((state) => state.setBackground);

  return (
    <section className="space-y-1 border-t border-slate-800 pt-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        {isPersian ? "نمایش" : "View"}
      </h2>

      <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-300">
        <input
          type="checkbox"
          checked={isEyeTrackingActive}
          onChange={(event) => setEyeTrackingActive(event.target.checked)}
          className="accent-sky-500"
        />
        <span>{isPersian ? "حرکت چشم‌ها با دوربین" : "Eyes follow you"}</span>
      </label>
      <p className="text-[10px] leading-snug text-slate-600">
        {isPersian
          ? "چشم‌ها در حد تقریبی ۳۵ درجه در حدقه حرکت می‌کنند."
          : "The globes turn in their orbits, up to about 35°."}
      </p>

      <label className="flex cursor-pointer items-center gap-2 pt-1 text-xs text-slate-300">
        <input
          type="checkbox"
          checked={labelsVisible}
          onChange={(event) => setLabelsVisible(event.target.checked)}
          className="accent-sky-500"
        />
        <span>{isPersian ? "نمایش نام ساختار انتخاب‌شده" : "Label what I select"}</span>
      </label>
      <p className="text-[10px] leading-snug text-slate-600">
        {isPersian
          ? "نام ساختارهای انتخاب‌شده با خط راهنما در کنار مدل نمایش داده می‌شود."
          : "Names in the margins with a leader line to each structure."}
      </p>

      <label className="flex cursor-pointer items-center gap-2 pt-1 text-xs text-slate-300">
        <input
          type="checkbox"
          checked={depthProbeVisible}
          onChange={(event) => setDepthProbeVisible(event.target.checked)}
          className="accent-sky-500"
        />
        <span>{isPersian ? "فهرست ساختارهای زیر نشانگر" : "List what is under the cursor"}</span>
      </label>
      <p className="text-[10px] leading-snug text-slate-600">
        {isPersian
          ? "پنل سمت راست ساختارهای زیر نشانگر را از سطح به عمق فهرست می‌کند."
          : "The panel on the right, naming everything the cursor passes through."}
      </p>

      <label className="flex cursor-pointer items-center gap-2 pt-1 text-xs text-slate-300">
        <input
          type="checkbox"
          checked={hideConnective}
          onChange={(event) => setHideConnective(event.target.checked)}
          className="accent-sky-500"
        />
        <span>{isPersian ? "پنهان‌کردن تاندون‌ها و فاشیا" : "Take off the tendons & fascia"}</span>
      </label>
      <p className="text-[10px] leading-snug text-slate-600">
        {isPersian
          ? "لایه‌های تاندونی و فاشیا روی عضلات قرار دارند؛ با پنهان‌کردن آن‌ها عضلات زیرین دیده می‌شوند."
          : "The muscular system sheets lying on muscles. Take them off to see underneath."}
      </p>

      <div className="flex items-center gap-2 pt-1">
        <span className="text-xs text-slate-300">{isPersian ? "پس‌زمینه" : "Background"}</span>
        <div className="ml-auto flex overflow-hidden rounded border border-slate-700">
          {(["dark", "light"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setSceneBackground(mode)}
              aria-pressed={sceneBackground === mode}
              title={mode === "dark" ? "Easier on eyes" : "For slides and print"}
              className={`px-2 py-0.5 text-[10px] capitalize transition ${
                sceneBackground === mode
                  ? "bg-slate-700/70 text-slate-100"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {isPersian ? (mode === "dark" ? "تیره" : "روشن") : mode}
            </button>
          ))}
        </div>
      </div>

      <StudyCoverageDisplay />
      <ViewportCaptureButton />
    </section>
  );
});
