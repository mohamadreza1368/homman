"""Atlas search and anatomical tree traversal utilities.

Shared across the real-time scene tools and the standalone MCP atlas service.
Standard-library only to ensure isolation across runtime environments.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal, Protocol

# Maximum records yielded per query execution
MAX_RESULTS = 25

# Minimum character length required to initiate anatomical indexing
MIN_QUERY_LENGTH = 2

# Anatomical classification derived from mesh naming conventions
Part = Literal["structure", "origin_marking", "insertion_marking"]

_SUFFIX_PART_MAP: dict[str, Part] = {
    "ol": "origin_marking",
    "or": "origin_marking",
    "el": "insertion_marking",
    "er": "insertion_marking",
}


class Named(Protocol):
    """Structural protocol defining fields required for anatomical lookups."""

    organ_id: str
    ta2_latin: str
    name_en: str


def search(structures: list, query: str) -> list:
    """Retrieve structures matching organ_id, Latin, or English nomenclature.
    
    Results are ranked with shorter English names first for precision.
    """
    token = query.strip().lower()
    if len(token) < MIN_QUERY_LENGTH:
        return []

    matches = [
        item
        for item in structures
        if token in item.ta2_latin.lower()
        or token in item.name_en.lower()
        or token in item.organ_id
    ]
    matches.sort(key=lambda item: len(item.name_en))
    return matches


def part_of(organ_id: str) -> Part:
    """Determine whether an organ identifier represents a belly or attachment marking."""
    tag = organ_id.rsplit("_", 1)[-1]
    return _SUFFIX_PART_MAP.get(tag, "structure")


def belly_id(organ_id: str) -> str | None:
    """Derive parent muscle belly identifier from an attachment marking."""
    tag = organ_id.rsplit("_", 1)[-1]
    if tag not in _SUFFIX_PART_MAP:
        return None
    stem = organ_id[: -len(tag) - 1]
    side = tag[-1]
    return f"{stem}_{side}"


@dataclass(frozen=True)
class Structure:
    """Represents an anatomical entity defined within the manifest."""

    organ_id: str
    ta2_latin: str
    name_en: str
    system: str
    path: tuple[str, ...] = ()
    mesh_file: str = ""
    node: str = ""

    @property
    def part(self) -> Part:
        return part_of(self.organ_id)

    def describe(self) -> str:
        """Formatted summary matching the standard OrganMeta convention."""
        return f"{self.organ_id} — {self.ta2_latin} ({self.name_en})"


@dataclass(frozen=True)
class Atlas:
    """Encapsulates parsed anatomical manifest metadata and structures."""

    version: int
    gender_model: str
    license: str
    credit: str
    attribution: str
    structures: list[Structure] = field(default_factory=list)
    systems: dict[str, int] = field(default_factory=dict)

    def by_id(self, organ_id: str) -> Structure | None:
        return self._lookup.get(organ_id)

    def markings_for(self, organ_id: str) -> list[Structure]:
        """Fetch associated attachment markings for a muscle belly."""
        return self._attachments.get(organ_id, [])

    def __post_init__(self) -> None:
        object.__setattr__(
            self, "_lookup", {item.organ_id: item for item in self.structures}
        )

        attachment_records: dict[str, list[Structure]] = {}
        for item in self.structures:
            parent = belly_id(item.organ_id)
            if parent is not None:
                attachment_records.setdefault(parent, []).append(item)
        for cluster in attachment_records.values():
            cluster.sort(key=lambda s: s.organ_id)
        object.__setattr__(self, "_attachments", attachment_records)


def load_atlas(manifest_path: Path) -> Atlas:
    """Load and parse an anatomical atlas manifest file from disk."""
    payload = json.loads(manifest_path.read_text(encoding="utf-8"))

    parsed_structures = [
        Structure(
            organ_id=entry["organ_id"],
            ta2_latin=entry["ta2_latin"],
            name_en=entry["name_en"],
            system=entry["system"],
            path=tuple(entry.get("path", ())),
            mesh_file=entry.get("mesh_file", ""),
            node=entry.get("node", ""),
        )
        for entry in payload["organs"]
    ]

    return Atlas(
        version=payload.get("version", 0),
        gender_model=payload.get("gender_model", "unknown"),
        license=payload.get("license", ""),
        credit=payload.get("credit", ""),
        attribution=payload.get("attribution", ""),
        structures=parsed_structures,
        systems={s["system"]: s["organ_count"] for s in payload.get("systems", [])},
    )


def systems_map(structures: list[Structure]) -> dict[str, tuple[list[str], int]]:
    """Index primary section headings and count unassigned items per anatomical system."""
    catalog: dict[str, tuple[dict[str, None], list[int]]] = {}
    for item in structures:
        headers, loose_counter = catalog.setdefault(item.system, ({}, [0]))
        if item.path:
            headers[item.path[0]] = None
        else:
            loose_counter[0] += 1
    return {
        sys_key: (list(headers.keys()), loose_counter[0])
        for sys_key, (headers, loose_counter) in catalog.items()
    }


def heading_names(structures: list[Structure]) -> set[str]:
    """Gather all distinct hierarchy branch names across all depth tiers."""
    return {branch for item in structures for branch in item.path}


def headings_at(structures: list[Structure], prefix: tuple[str, ...]) -> list[str]:
    """Retrieve child branches located immediately underneath a path prefix."""
    depth = len(prefix)
    branches: dict[str, None] = {}
    for item in structures:
        if item.path[:depth] == prefix and len(item.path) > depth:
            branches[item.path[depth]] = None
    return list(branches.keys())


def children_of(
    structures: list[Structure], prefix: tuple[str, ...]
) -> tuple[list[str], list[Structure]]:
    """Enumerate branch headers and leaf structures residing at a given prefix."""
    depth = len(prefix)
    sub_headers: dict[str, None] = {}
    leaf_nodes: list[Structure] = []

    for item in structures:
        if item.path[:depth] != prefix:
            continue
        if len(item.path) == depth:
            leaf_nodes.append(item)
        else:
            sub_headers[item.path[depth]] = None

    leaf_nodes.sort(key=lambda elem: elem.name_en)
    return list(sub_headers.keys()), leaf_nodes
