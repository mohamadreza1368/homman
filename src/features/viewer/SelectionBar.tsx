import { useEffect, type ReactNode } from "react";

import { useInterfaceLanguage } from "@/stores/interfaceLanguage";
import { organLabel, organSubtitle, useSceneStore } from "@/stores/sceneStore";
import { viewportKey } from "./viewportKeys";

/**
 * Bottom-docked floating action bar displayed whenever organs are actively selected
 * or hidden in the viewport. Provides immediate keyboard shortcuts and mouse actions
 * to isolate, hide, restore, or clear selections.
 */
export function SelectionBar() {
  const isPersian = useInterfaceLanguage((state) => state.language === "fa");
  const selectedIds = useSceneStore((state) => state.selectedOrganIds);
  const hiddenIds = useSceneStore((state) => state.hiddenOrganIds);
  const catalog = useSceneStore((state) => state.organs);
  const isolateCurrent = useSceneStore((state) => state.isolateSelection);
  const hideCurrent = useSceneStore((state) => state.hideSelection);
  const clearCurrent = useSceneStore((state) => state.clearSelection);
  const restoreHidden = useSceneStore((state) => state.unhideAll);
  const setHoveredId = useSceneStore((state) => state.setHovered);

  // Keyboard shortcut listener for active selection management
  useEffect(() => {
    const handleKeyShortcut = (event: KeyboardEvent) => {
      const code = viewportKey(event);
      if (!code) return;

      switch (code) {
        case "i":
          isolateCurrent();
          event.preventDefault();
          break;
        case "h":
          hideCurrent();
          event.preventDefault();
          break;
        case "u":
          restoreHidden();
          event.preventDefault();
          break;
        case "c":
          clearCurrent();
          event.preventDefault();
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyShortcut);
    return () => window.removeEventListener("keydown", handleKeyShortcut);
  }, [isolateCurrent, hideCurrent, restoreHidden, clearCurrent]);

  const activeOrgans = selectedIds
    .map((id) => catalog[id])
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  if (activeOrgans.length === 0 && hiddenIds.length === 0) {
    return null;
  }

  const recentSelections = activeOrgans.slice(-3);

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-16 flex justify-center">
      <nav
        aria-label={isPersian ? "مدیریت انتخاب‌ها" : "Selection controls"}
        className="pointer-events-auto flex max-w-[85%] items-center gap-2 rounded-full border border-teal-500/30 bg-slate-900/90 px-3.5 py-1.5 shadow-2xl backdrop-blur-xl ring-1 ring-white/10"
      >
        {activeOrgans.length > 0 && (
          <>
            <span className="shrink-0 rounded-full bg-slate-700/60 px-2 py-0.5 text-[10px] font-semibold text-slate-200">
              {isPersian
                ? `${activeOrgans.length} انتخاب‌شده`
                : `${activeOrgans.length} selected`}
            </span>

            <div className="flex min-w-0 items-center gap-1">
              {recentSelections.map((organ) => (
                <span
                  key={organ.organ_id}
                  title={organSubtitle(organ)}
                  onMouseEnter={() => setHoveredId(organ.organ_id)}
                  onMouseLeave={() => setHoveredId(null)}
                  className="max-w-44 truncate text-xs italic text-slate-300"
                >
                  {organLabel(organ)}
                </span>
              ))}
            </div>

            <ActionButton onClick={isolateCurrent} hotkeyHint="I">
              {isPersian ? "ایزوله" : "Isolate"}
            </ActionButton>
            <ActionButton onClick={hideCurrent} hotkeyHint="H">
              {isPersian ? "پنهان" : "Hide"}
            </ActionButton>
            <ActionButton onClick={clearCurrent} hotkeyHint="C">
              {isPersian ? "پاک کردن" : "Clear"}
            </ActionButton>
          </>
        )}

        {hiddenIds.length > 0 && (
          <ActionButton onClick={restoreHidden} hotkeyHint="U" variant="amber">
            {isPersian
              ? `بازگردانی ${hiddenIds.length} پنهان`
              : `Restore ${hiddenIds.length} hidden`}
          </ActionButton>
        )}
      </nav>
    </div>
  );
}

interface ActionButtonProps {
  children: ReactNode;
  onClick: () => void;
  hotkeyHint?: string;
  variant?: "slate" | "amber";
}

function ActionButton({
  children,
  onClick,
  hotkeyHint,
  variant = "slate",
}: ActionButtonProps) {
  const themeClasses =
    variant === "amber"
      ? "border-amber-700/60 text-amber-300 hover:border-amber-500"
      : "border-slate-700 text-slate-300 hover:border-sky-600 hover:text-sky-200";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex shrink-0 items-center gap-1 rounded border px-2 py-0.5 text-[10px] transition-colors ${themeClasses}`}
    >
      {children}
      {hotkeyHint && (
        <kbd className="rounded bg-slate-800 px-1 text-[9px] text-slate-500">
          {hotkeyHint}
        </kbd>
      )}
    </button>
  );
}
