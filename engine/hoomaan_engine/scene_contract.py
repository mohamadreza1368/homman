"""Atlas reference verification contract for external and internal scene commands.

Inspects scene command arguments against the anatomical atlas manifest to verify
that referenced structure IDs or hierarchical group names exist in the dataset.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Literal

from hoomaan_engine.atlas_search import Atlas, heading_names

Reference = Literal["id", "ids", "group"]

ATLAS_REFERENCES: dict[str, tuple[str, Reference] | None] = {
    "say": None,
    "focus_organ": ("organ_id", "id"),
    "isolate_region": ("organ_id", "id"),
    "apply_pathology_overlay": ("organ_id", "id"),
    "isolate_structures": ("organ_ids", "ids"),
    "highlight_pathway": ("organ_ids", "ids"),
    "illuminate_structures": ("organ_ids", "ids"),
    "isolate_group": ("group", "group"),
    "scan_at_structure": ("organ_id", "id"),
    "set_heart_rhythm": None,
    "set_layer_visibility": None,
    "set_layer_opacity": None,
    "add_supply": None,
    "clear_pathology_overlays": None,
    "clear_pathway": None,
    "set_cross_section": None,
    "reset_view": None,
}

XRAY_OPACITY = 0.16


class UnclassifiedActionError(ValueError):
    """Raised when encountering an action unrecognized by ATLAS_REFERENCES."""


def unknown_references(atlas: Atlas, command: Mapping[str, object]) -> list[str]:
    """Identifies any structure IDs or group headings named by the command that do not exist in the atlas."""
    action = command.get("action")
    if not isinstance(action, str) or action not in ATLAS_REFERENCES:
        raise UnclassifiedActionError(f"No atlas-reference classification for action {action!r}.")

    mapping = ATLAS_REFERENCES[action]
    if mapping is None:
        return []

    target_field, ref_kind = mapping
    raw_val = command.get(target_field)

    if ref_kind == "group":
        is_known = isinstance(raw_val, str) and raw_val in heading_names(atlas.structures)
        return [] if is_known else [str(raw_val)]

    items = [raw_val] if ref_kind == "id" else raw_val
    if isinstance(items, str) or not isinstance(items, Sequence):
        items = [items]

    return [str(elem) for elem in items if not isinstance(elem, str) or atlas.by_id(elem) is None]
