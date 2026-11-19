import { VIEW_HINT } from "./cameraViews";
import { domRect, MAIN, panelLayout, type AuxiliaryView } from "./studyLayout";
import { useStudyViewsStore } from "@/stores/studyViewsStore";
import { OVERLAY_CHIP_ACTION, OVERLAY_GROUND } from "./overlayChrome";

/**
 * HOOMAAN Multi-View Study Frame & Viewport Dividers.
 * Renders grid demarcation lines and perspective toggle buttons for
 * orthogonal auxiliary panels (anterior, left, superior).
 */

const VIEWPORT_LETTERS: Record<AuxiliaryView, string> = {
  anterior: "A",
  left: "L",
  superior: "S",
};

function calculateCornerPosition(bounds: ReturnType<typeof domRect>) {
  const clampedX = Math.min(Math.max(0.5, bounds.left), bounds.left + bounds.width);
  const clampedY = Math.min(Math.max(0.5, bounds.top), bounds.top + bounds.height);
  const offset = "0.5rem";

  return {
    left: `${clampedX * 100}%`,
    top: `${clampedY * 100}%`,
    transform: `translate(${clampedX > bounds.left ? `calc(-100% - ${offset})` : offset}, ${
      clampedY > bounds.top ? `calc(-100% - ${offset})` : offset
    })`,
  };
}

export function StudyViewsFrame() {
  const activeViews = useStudyViewsStore((state) => state.active);
  const toggleView = useStudyViewsStore((state) => state.toggleView);
  const panels = panelLayout(activeViews);

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      {panels.map((p) => {
        const r = domRect(p);
        return (
          <div key={`edge-${p.id}`}>
            {r.left > 0 && (
              <div
                className="absolute w-px bg-slate-500/30"
                style={{
                  left: `${r.left * 100}%`,
                  top: `${r.top * 100}%`,
                  height: `${r.height * 100}%`,
                }}
              />
            )}
            {r.top > 0 && (
              <div
                className="absolute h-px bg-slate-500/30"
                style={{
                  top: `${r.top * 100}%`,
                  left: `${r.left * 100}%`,
                  width: `${r.width * 100}%`,
                }}
              />
            )}
          </div>
        );
      })}

      {panels.map((p) => {
        if (p.id === MAIN) return null;
        const auxiliary = p.id as AuxiliaryView;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => toggleView(auxiliary)}
            title={`${VIEW_HINT[auxiliary]} — click to close this panel`}
            style={{ position: "absolute", ...calculateCornerPosition(domRect(p)) }}
            className="pointer-events-auto rounded bg-slate-950/70 px-1.5 py-0.5 font-mono text-[10px] leading-none text-slate-400 transition hover:bg-slate-800 hover:text-slate-100"
          >
            {VIEWPORT_LETTERS[auxiliary]}
          </button>
        );
      })}
    </div>
  );
}

export function ClosedViews() {
  const activeViews = useStudyViewsStore((state) => state.active);
  const toggleView = useStudyViewsStore((state) => state.toggleView);
  const inactiveViews = (Object.keys(VIEWPORT_LETTERS) as AuxiliaryView[]).filter(
    (v) => !activeViews.includes(v),
  );

  if (inactiveViews.length === 0) return null;

  return (
    <div className="pointer-events-auto flex items-center gap-1">
      {inactiveViews.map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => toggleView(v)}
          title={`${VIEW_HINT[v]} — click to open this panel again`}
          className={`rounded ${OVERLAY_GROUND} px-1.5 py-0.5 font-mono text-[10px] leading-none transition ${OVERLAY_CHIP_ACTION}`}
        >
          {VIEWPORT_LETTERS[v]}
        </button>
      ))}
    </div>
  );
}
