import { memo } from "react";
import type { StudiedOrgan } from "./studied";

interface StudiedOrgansPanelProps {
  associatedOrganList: StudiedOrgan[] | null;
  activeHighlightedOrgan: string | null;
  pinnedOrganNode: string | null;
  isAllOrgansUnfolded: boolean;
  visibleOrganRowCount: number;
  isOrganCameraZoomed: boolean;
  onOrganHover: (id: string | null) => void;
  onOrganPin: (id: string) => void;
  onToggleUnfold: () => void;
  onToggleZoom: () => void;
}

export const StudiedOrgansPanel = memo(function StudiedOrgansPanel({
  associatedOrganList,
  activeHighlightedOrgan,
  pinnedOrganNode,
  isAllOrgansUnfolded,
  visibleOrganRowCount,
  isOrganCameraZoomed,
  onOrganHover,
  onOrganPin,
  onToggleUnfold,
  onToggleZoom,
}: StudiedOrgansPanelProps) {
  if (associatedOrganList === null) {
    return (
      <div className="ml-studied">
        <span>LOCATING…</span>
      </div>
    );
  }

  if (associatedOrganList.length === 0) return null;

  const displayedList = isAllOrgansUnfolded
    ? associatedOrganList
    : associatedOrganList.slice(0, visibleOrganRowCount);

  return (
    <div className="ml-studied" aria-live="polite">
      <span>STUDIED IN THIS MEMORY</span>
      <div className={`ml-studied-list ${isAllOrgansUnfolded ? "ml-all" : ""}`}>
        {displayedList.map((organ) => (
          <button
            type="button"
            key={organ.id}
            className={organ.id === activeHighlightedOrgan ? "ml-on" : ""}
            aria-pressed={organ.id === pinnedOrganNode}
            title={
              organ.id === pinnedOrganNode
                ? "Show them all again"
                : "Show it alone in the figure"
            }
            onPointerEnter={() => onOrganHover(organ.id)}
            onPointerLeave={() => onOrganHover(null)}
            onFocus={() => onOrganHover(organ.id)}
            onBlur={() => onOrganHover(null)}
            onClick={() => onOrganPin(organ.id)}
          >
            {organ.name}
          </button>
        ))}
      </div>

      <div className="ml-studied-tools">
        {associatedOrganList.length > visibleOrganRowCount && (
          <button
            type="button"
            className="ml-tool"
            aria-expanded={isAllOrgansUnfolded}
            onClick={onToggleUnfold}
          >
            {isAllOrgansUnfolded
              ? "SHOW FEWER"
              : `+${associatedOrganList.length - visibleOrganRowCount} MORE`}
          </button>
        )}
        <button
          type="button"
          className="ml-tool"
          aria-pressed={isOrganCameraZoomed}
          title={
            isOrganCameraZoomed
              ? "Back to the whole figure"
              : pinnedOrganNode
                ? "Move in on the chosen structure"
                : "Move in on what was studied"
          }
          onClick={onToggleZoom}
        >
          {isOrganCameraZoomed ? "⊖ WHOLE BODY" : "⊕ ZOOM IN"}
        </button>
      </div>
    </div>
  );
});
