import { useEffect, useState } from "react";

import { displayStatus, setStableDisplay, type DisplayStatus } from "@/lib/ipc";
import { useInterfaceLanguage } from "@/stores/interfaceLanguage";

/**
 * Display stability toggle configuration panel for mitigating GPU compositing flicker
 * on specific monitor and graphics driver configurations.
 */
export function DisplaySettings() {
  const isPersian = useInterfaceLanguage((state) => state.language === "fa");
  const [config, setConfig] = useState<DisplayStatus | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    displayStatus()
      .then(setConfig)
      .catch((err: unknown) =>
        setErrorMessage(`Could not read the display setting: ${String(err)}`)
      );
  }, []);

  if (!config?.supported) {
    return null;
  }

  const toggleStability = () => {
    setIsUpdating(true);
    setErrorMessage(null);
    setStableDisplay(!config.stableDisplay)
      .then(setConfig)
      .catch((err: unknown) =>
        setErrorMessage(`Could not save the display setting: ${String(err)}`)
      )
      .finally(() => setIsUpdating(false));
  };

  const hasPendingRestart = config.stableDisplay !== config.active;

  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <p className="text-[10px] uppercase tracking-wider text-slate-500">
          {isPersian ? "نمایش پایدار" : "Stable display"}
        </p>
        <button
          type="button"
          role="switch"
          aria-checked={config.stableDisplay}
          disabled={isUpdating}
          onClick={toggleStability}
          className={`ml-auto rounded border px-2 py-0.5 text-[10px] transition-colors disabled:opacity-40 ${
            config.stableDisplay
              ? "border-sky-500 bg-sky-500/10 text-sky-300"
              : "border-slate-700 text-slate-400 hover:border-slate-600"
          }`}
        >
          {config.stableDisplay
            ? isPersian
              ? "روشن"
              : "On"
            : isPersian
              ? "خاموش"
              : "Off"}
        </button>
      </div>

      <p className="text-[10px] leading-snug text-slate-600">
        {isPersian
          ? "برای صفحاتی که گهگاه برای لحظه‌ای چشمک سیاه می‌زنند. این کلید پنجره را از مسیری پایدارتر رسم می‌کند. در صورت عدم نیاز، خاموش بگذارید."
          : "For a screen that blinks black for an instant now and then. Some monitor, graphics card and driver combinations do this; the switch draws the window by a slightly slower, steadier route. Leave it off unless you see the blink."}
      </p>

      {hasPendingRestart && (
        <p className="mt-1 text-[10px] leading-snug text-amber-300/90">
          {isPersian
            ? "از راه‌اندازی بعدی هومان اعمال می‌شود."
            : "Takes effect the next time HOOMAAN starts."}
        </p>
      )}

      {errorMessage && (
        <p className="mt-2 rounded border border-rose-800/60 bg-rose-900/20 px-2 py-1 text-[10px] leading-snug text-rose-300">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
