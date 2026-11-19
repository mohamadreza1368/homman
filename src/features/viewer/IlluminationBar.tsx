import { useInterfaceLanguage } from "@/stores/interfaceLanguage";
import { organLabel, useSceneStore } from "@/stores/sceneStore";

/**
 * Floating indicator displayed when the AI assistant or user has highlighted/illuminated
 * specific anatomical structures with spotlight illumination in the 3D scene.
 */
export function IlluminationBar() {
  const isPersian = useInterfaceLanguage((state) => state.language === "fa");
  const illuminatedIds = useSceneStore((state) => state.illuminated);
  const organRegistry = useSceneStore((state) => state.organs);
  const dispatchCommand = useSceneStore((state) => state.applyCommand);
  const setHoveredStructure = useSceneStore((state) => state.setHovered);

  const activeIlluminations = illuminatedIds
    .map((id) => organRegistry[id])
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  if (activeIlluminations.length === 0) {
    return null;
  }

  const previewList = activeIlluminations.slice(0, 3);
  const remainingCount = activeIlluminations.length - previewList.length;

  const handleClearIllumination = () => {
    dispatchCommand({ action: "illuminate_structures", organ_ids: [] });
  };

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-28 flex justify-center">
      <div
        role="status"
        aria-label={isPersian ? "ساختارهای روشن‌شده" : "Illuminated structures"}
        className="pointer-events-auto flex max-w-[80%] items-center gap-2 rounded-full border border-amber-700/60 bg-slate-900/95 px-3 py-1.5 shadow-lg backdrop-blur"
      >
        <span className="shrink-0 rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200">
          {isPersian ? "روشن‌شده" : "Lit"}
        </span>

        <div className="flex min-w-0 items-center gap-2">
          {previewList.map((organ) => (
            <span
              key={organ.organ_id}
              onMouseEnter={() => setHoveredStructure(organ.organ_id)}
              onMouseLeave={() => setHoveredStructure(null)}
              className="max-w-48 truncate text-xs italic text-slate-300"
            >
              {organLabel(organ)}
            </span>
          ))}

          {remainingCount > 0 && (
            <span className="shrink-0 text-[10px] text-slate-500">
              +{remainingCount}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={handleClearIllumination}
          title={isPersian ? "خاموش کردن نور راهنما" : "Turn the assistant's light off"}
          className="shrink-0 rounded border border-slate-700 px-2 py-0.5 text-[10px] text-slate-300 transition hover:border-amber-600 hover:text-amber-200"
        >
          {isPersian ? "خاموش" : "Turn off"}
        </button>
      </div>
    </div>
  );
}
