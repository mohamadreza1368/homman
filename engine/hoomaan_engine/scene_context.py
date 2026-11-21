"""Scene execution context and organ resolution utilities for AI tools."""

from __future__ import annotations

import difflib
from collections.abc import Callable
from dataclasses import dataclass, field

from pydantic import BaseModel
from pydantic_ai import ModelRetry, RunContext

from hoomaan_engine.protocol import (
    AnatomicalSystem,
    Language,
    OrganMeta,
    UserProfile,
)

MAX_ISOLATED = 64
MAX_ILLUMINATED = 24
_MATCH_SUGGESTIONS = 6

MIN_PATHWAY_STOPS = 2
MAX_PATHWAY_STOPS = 24

MIN_STEP_SECONDS = 0.2
MAX_STEP_SECONDS = 10.0
DEFAULT_STEP_SECONDS = 1.2

MIN_GHOST = 0.05
XRAY_OPACITY = 0.16
MAX_SEARCH_RESULTS = 25


@dataclass
class SceneContext:
    """Encapsulates active scene state and outbound dispatch channels."""

    organs: dict[str, OrganMeta]
    systems: set[AnatomicalSystem]
    profile: UserProfile
    language: Language
    emit: Callable[[BaseModel], None]
    emit_verdict: Callable[[int, str], None] | None = None
    groups: set[str] = field(default_factory=set)
    emitted: list[BaseModel] = field(default_factory=list)

    def dispatch(self, command: BaseModel) -> None:
        """Record and broadcast a scene command payload."""
        self.emitted.append(command)
        self.emit(command)


def resolve_organ(ctx: RunContext[SceneContext], organ_id: str) -> OrganMeta:
    """Validate organ identifier or raise a guided ModelRetry with near matches."""
    record = ctx.deps.organs.get(organ_id)
    if record is not None:
        return record

    similar = difflib.get_close_matches(
        organ_id, ctx.deps.organs, n=_MATCH_SUGGESTIONS, cutoff=0.5
    )
    tip = (
        f"Did you mean: {', '.join(similar)}"
        if similar
        else f"Loaded structures include: {', '.join(list(ctx.deps.organs)[:_MATCH_SUGGESTIONS])}"
    )

    raise ModelRetry(
        f"Structure {organ_id!r} is not loaded in the viewport. {tip}. "
        "Select an organ_id exactly matching the loaded manifest inventory."
    )
