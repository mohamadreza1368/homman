"""Hoomaan AI Engine - 3D Scene Viewport Tools for Pydantic AI Agent.

Derived strictly from specs/scene-interaction-selection.md.
Provides structure search, camera orientation, organ isolation, X-ray transparency,
cross-section tomographic planes, cardiac rhythm control, and clinical pathway tracing.
"""

from __future__ import annotations

import difflib
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Literal, get_args

from pydantic import BaseModel
from pydantic_ai import Agent, ModelRetry, RunContext

from hoomaan_engine.protocol import (
    AddSupply,
    AnatomicalSystem,
    ApplyPathologyOverlay,
    ClearPathologyOverlays,
    ClearPathway,
    FocusOrgan,
    HeartRhythmId,
    HighlightPathway,
    IlluminateStructures,
    IsolateGroup,
    IsolateRegion,
    IsolateStructures,
    Language,
    OrganMeta,
    ResetView,
    ScanAtStructure,
    ScannerPlane,
    SectionPlane,
    SetCrossSection,
    SetHeartRhythm,
    SetLayerOpacity,
    SetLayerVisibility,
    UserProfile,
)

# -----------------------------------------------------------------------------
# Configuration Bounds & Constraints
# -----------------------------------------------------------------------------

MAX_ISOLATED: int = 64
MAX_ILLUMINATED: int = 24
MIN_PATHWAY_STOPS: int = 2
MAX_PATHWAY_STOPS: int = 24
MIN_STEP_SECONDS: float = 0.2
MAX_STEP_SECONDS: float = 10.0
DEFAULT_STEP_SECONDS: float = 1.2
MIN_GHOST: float = 0.05
XRAY_OPACITY: float = 0.16
MAX_SEARCH_RESULTS: int = 25
_MATCH_SUGGESTIONS: int = 6


# -----------------------------------------------------------------------------
# Scene Execution Context
# -----------------------------------------------------------------------------


@dataclass
class SceneContext:
    """Encapsulates active scene state, loaded organs index, and outbound event channels."""

    organs: dict[str, OrganMeta]
    systems: set[AnatomicalSystem]
    profile: UserProfile
    language: Language
    emit: Callable[[BaseModel], None]
    emit_verdict: Callable[[int, str], None] | None = None
    groups: set[str] = field(default_factory=set)
    emitted: list[BaseModel] = field(default_factory=list)

    def dispatch(self, command: BaseModel) -> None:
        """Broadcasts a scene command and preserves diagnostic event history."""
        self.emitted.append(command)
        self.emit(command)


def resolve_organ(ctx: RunContext[SceneContext], organ_id: str) -> OrganMeta:
    """Verifies that an organ identifier exists in the current atlas, offering close matches if mistyped."""
    record = ctx.deps.organs.get(organ_id)
    if record is not None:
        return record

    similar = difflib.get_close_matches(
        organ_id, ctx.deps.organs.keys(), n=_MATCH_SUGGESTIONS, cutoff=0.5
    )
    if similar:
        hint = ", ".join(f"{s!r} ({ctx.deps.organs[s].name_en})" for s in similar)
        raise ModelRetry(
            f"Unknown organ_id {organ_id!r}. Close matches loaded in the scene: {hint}."
        )

    raise ModelRetry(
        f"Unknown organ_id {organ_id!r}. Call find_structures to search loaded structures."
    )


_resolve = resolve_organ


# -----------------------------------------------------------------------------
# Unified Scene Tool Registry
# -----------------------------------------------------------------------------


class HoomaanSceneToolRegistry:
    """Clean-Room Tool Suite connecting Pydantic AI agent with 3D anatomical viewport."""

    def __init__(self, agent: Agent[SceneContext, str]) -> None:
        self.agent = agent

    def register_all(self) -> None:
        self._register_selection_tools()
        self._register_layer_tools()
        self._register_clinical_tools()
        self._register_pathway_tools()

    def _register_selection_tools(self) -> None:
        @self.agent.tool
        def find_structures(ctx: RunContext[SceneContext], query: str) -> str:
            """Search loaded anatomical structures by English, Latin, or organ_id substring."""
            pattern = query.strip().lower()
            if len(pattern) < 2:
                raise ModelRetry("Search query requires at least two characters.")

            found = [
                item
                for item in ctx.deps.organs.values()
                if pattern in item.ta2_latin.lower()
                or pattern in item.name_en.lower()
                or pattern in item.organ_id
            ]
            if not found:
                return (
                    f"Nothing loaded matches {query!r}. It may belong to a hidden system that is switched off — "
                    "try set_layer_visibility or broaden the search term."
                )

            found.sort(key=lambda s: len(s.name_en))
            clipped = found[:MAX_SEARCH_RESULTS]
            lines = "\n".join(f"  {s.describe()}" for s in clipped)
            remainder = (
                f"\n  …and {len(found) - len(clipped)} more; narrow the query."
                if len(found) > len(clipped)
                else ""
            )
            return f"{len(found)} match(es) for {query!r}:\n{lines}{remainder}"

        @self.agent.tool(sequential=True)
        def focus_organ(ctx: RunContext[SceneContext], organ_id: str) -> str:
            """Center and dolly camera view onto an anatomical structure."""
            organ = resolve_organ(ctx, organ_id)
            ctx.deps.dispatch(FocusOrgan(organ_id=organ.organ_id))
            return f"Focused camera on {organ.describe()}."

        @self.agent.tool(sequential=True)
        def isolate_structures(ctx: RunContext[SceneContext], organ_ids: list[str]) -> str:
            """Isolate an exclusive subset of structures, ghosting or hiding all others."""
            if not organ_ids:
                raise ModelRetry("Provide at least one organ_id to isolate.")
            if len(organ_ids) > MAX_ISOLATED:
                raise ModelRetry(
                    f"At most {MAX_ISOLATED} structures can be isolated; {len(organ_ids)} requested."
                )

            valid = [resolve_organ(ctx, oid) for oid in organ_ids]
            deduped = list(dict.fromkeys(o.organ_id for o in valid))
            ctx.deps.dispatch(IsolateStructures(organ_ids=deduped))
            return f"Isolated {len(deduped)} structure(s): {', '.join(deduped)}."

        @self.agent.tool(sequential=True)
        def isolate_region(ctx: RunContext[SceneContext], organ_id: str) -> str:
            """Isolate an organ along with its immediate regional anatomical neighborhood."""
            organ = resolve_organ(ctx, organ_id)
            ctx.deps.dispatch(IsolateRegion(organ_id=organ.organ_id))
            return f"Isolated anatomical region surrounding {organ.describe()}."

        @self.agent.tool(sequential=True)
        def isolate_group(ctx: RunContext[SceneContext], group: str) -> str:
            """Isolate a named anatomical hierarchy group."""
            if group not in ctx.deps.groups:
                raise ModelRetry(
                    f"Unknown group {group!r}. Available groups: {sorted(ctx.deps.groups)}."
                )
            ctx.deps.dispatch(IsolateGroup(group=group))
            return f"Isolated anatomical group {group!r}."

        @self.agent.tool(sequential=True)
        def add_supply(
            ctx: RunContext[SceneContext], kind: Literal["vascular", "neural"]
        ) -> str:
            """Add regional neurovascular supply pathways to active selection."""
            ctx.deps.dispatch(AddSupply(kind=kind))
            return (
                f"Added {kind} structures found in proximity to the selection; "
                "this reflects spatial proximity, not a claim that each one supplies the target."
            )

        @self.agent.tool(sequential=True)
        def illuminate_structures(
            ctx: RunContext[SceneContext], organ_ids: list[str]
        ) -> str:
            """Briefly illuminate structures without changing isolation or visibility."""
            if len(organ_ids) > MAX_ILLUMINATED:
                raise ModelRetry(f"At most {MAX_ILLUMINATED} structures may be illuminated at once.")

            if not organ_ids:
                ctx.deps.dispatch(IlluminateStructures(organ_ids=[]))
                return "Turned the light off."

            valid = [resolve_organ(ctx, oid) for oid in organ_ids]
            deduped = list(dict.fromkeys(o.organ_id for o in valid))
            ctx.deps.dispatch(IlluminateStructures(organ_ids=deduped))
            return f"Illuminated {len(deduped)} structure(s): {', '.join(deduped)}."

        @self.agent.tool(sequential=True)
        def reset_view(ctx: RunContext[SceneContext]) -> str:
            """Restore camera vantage and reset isolation to complete body view."""
            ctx.deps.dispatch(ResetView())
            return "Reset 3D view and cleared current isolation."

    def _register_layer_tools(self) -> None:
        @self.agent.tool(sequential=True)
        def xray_system(
            ctx: RunContext[SceneContext], system: AnatomicalSystem
        ) -> str:
            """Fade all anatomical systems to translucent X-ray while keeping target system fully opaque."""
            if system not in ctx.deps.systems:
                raise ModelRetry(
                    f"System {system!r} is not loaded. Available systems: {sorted(ctx.deps.systems)}."
                )
            ctx.deps.dispatch(SetLayerOpacity(system=system, opacity=1.0))
            for other in ctx.deps.systems:
                if other != system:
                    ctx.deps.dispatch(SetLayerOpacity(system=other, opacity=XRAY_OPACITY))
            return f"Focused X-ray on {system} system."

        @self.agent.tool(sequential=True)
        def set_layer_visibility(
            ctx: RunContext[SceneContext], system: AnatomicalSystem, visible: bool
        ) -> str:
            """Toggle entire anatomical system visibility (e.g. skeletal, muscular, nervous)."""
            if system not in ctx.deps.systems:
                raise ModelRetry(
                    f"System {system!r} is not loaded in this atlas. Available systems: {sorted(ctx.deps.systems)}."
                )
            ctx.deps.dispatch(SetLayerVisibility(system=system, visible=visible))
            return f"{'Revealed' if visible else 'Concealed'} {system} system."

        @self.agent.tool(sequential=True)
        def set_layer_opacity(
            ctx: RunContext[SceneContext], system: AnatomicalSystem, opacity: float
        ) -> str:
            """Set X-ray opacity factor (0.05 to 1.0) for an anatomical system."""
            if opacity <= 0.0:
                raise ModelRetry(
                    "Opacity cannot be 0.0; to hide an entire layer, call set_layer_visibility(system, visible=False)."
                )
            if opacity < MIN_GHOST:
                raise ModelRetry(
                    f"Opacity {opacity} is too faint. Use {MIN_GHOST} or higher, or call set_layer_visibility."
                )
            if system not in ctx.deps.systems:
                raise ModelRetry(
                    f"System {system!r} is not loaded. Available systems: {sorted(ctx.deps.systems)}."
                )

            ctx.deps.dispatch(SetLayerOpacity(system=system, opacity=opacity))
            return f"Adjusted {system} opacity to {opacity:.2f}."

    def _register_clinical_tools(self) -> None:
        @self.agent.tool(sequential=True)
        def set_cross_section(
            ctx: RunContext[SceneContext], plane: SectionPlane, position: float
        ) -> str:
            """Position tomographic cross-section clipping plane."""
            if plane not in ("axial", "coronal", "sagittal"):
                raise ModelRetry(f"Plane must be axial, coronal, or sagittal; got {plane!r}.")
            ctx.deps.dispatch(SetCrossSection(plane=plane, position=position))
            return f"Positioned {plane} cross-section at normalized offset {position:.2f}."

        @self.agent.tool(sequential=True)
        def scan_at_structure(
            ctx: RunContext[SceneContext],
            organ_id: str,
            plane: ScannerPlane | None = None,
        ) -> str:
            """Align tomographic scanner directly at the centroid of a target organ."""
            organ = resolve_organ(ctx, organ_id)
            ctx.deps.dispatch(ScanAtStructure(organ_id=organ.organ_id, plane=plane))
            return f"Aligned scanner to centroid of {organ.describe()}."

        @self.agent.tool(sequential=True)
        def set_heart_rhythm(
            ctx: RunContext[SceneContext], rhythm: HeartRhythmId, sound: bool | None = None
        ) -> str:
            """Configure cardiac simulation kinematics and rhythm cycle."""
            valid_rhythms = get_args(HeartRhythmId)
            if rhythm not in valid_rhythms:
                raise ModelRetry(
                    f"Unknown heart rhythm {rhythm!r}. Supported rhythms: {sorted(valid_rhythms)}."
                )
            ctx.deps.dispatch(SetHeartRhythm(rhythm=rhythm, sound=sound))
            return f"Configured cardiac simulation to {rhythm!r}."

        @self.agent.tool(sequential=True)
        def apply_pathology_overlay(
            ctx: RunContext[SceneContext],
            organ_id: str,
            pathology: str,
            severity: float,
        ) -> str:
            """Apply visual pathology discoloration overlay onto an organ."""
            organ = resolve_organ(ctx, organ_id)
            if not (0.0 <= severity <= 1.0):
                raise ModelRetry(f"severity must be between 0 and 1, got {severity}")
            truncated_pathology = pathology[:120]
            ctx.deps.dispatch(
                ApplyPathologyOverlay(
                    organ_id=organ.organ_id,
                    pathology=truncated_pathology,
                    severity=severity,
                )
            )
            return f"Applied {truncated_pathology!r} overlay to {organ.describe()} at severity {severity:.2f}."

        @self.agent.tool(sequential=True)
        def clear_pathology_overlays(ctx: RunContext[SceneContext]) -> str:
            """Remove all visual pathology overlays."""
            ctx.deps.dispatch(ClearPathologyOverlays())
            return "Cleared visual pathology overlays."

        @self.agent.tool(sequential=True)
        def record_case_finding(
            ctx: RunContext[SceneContext], score: int, verdict: str
        ) -> str:
            """Conclude clinical case simulation turn and assign evaluation score."""
            clamped = max(0, min(100, score))
            if ctx.deps.emit_verdict:
                ctx.deps.emit_verdict(clamped, verdict)
            return f"Recorded clinical case score {clamped}/100: {verdict[:80]}..."

    def _register_pathway_tools(self) -> None:
        @self.agent.tool(sequential=True)
        def highlight_pathway(
            ctx: RunContext[SceneContext],
            label: str,
            organ_ids: list[str],
            step_seconds: float = DEFAULT_STEP_SECONDS,
            loop: bool = True,
        ) -> str:
            """Animate sequential pathway flow across anatomical structures (e.g. cardiac conduction)."""
            if len(organ_ids) < MIN_PATHWAY_STOPS:
                raise ModelRetry(
                    f"Pathway requires at least {MIN_PATHWAY_STOPS} structures; {len(organ_ids)} given. "
                    "To focus on a single organ, call focus_organ."
                )
            if len(organ_ids) > 32:
                raise ModelRetry(
                    f"Pathway accepts at most 32 stops; {len(organ_ids)} given."
                )

            for a, b in zip(organ_ids, organ_ids[1:]):
                if a == b:
                    raise ModelRetry(
                        f"Pathway visits {a!r} twice in a row; consecutive stops must be distinct."
                    )

            if not (MIN_STEP_SECONDS <= step_seconds <= MAX_STEP_SECONDS):
                raise ModelRetry(
                    f"step_seconds must be between {MIN_STEP_SECONDS} and {MAX_STEP_SECONDS}, got {step_seconds}."
                )

            valid = [resolve_organ(ctx, oid) for oid in organ_ids]
            sequence = [o.organ_id for o in valid]

            ctx.deps.dispatch(
                HighlightPathway(
                    label=label,
                    organ_ids=sequence,
                    step_seconds=step_seconds,
                    loop=loop,
                )
            )
            return f"Tracing pathway {label!r} across {len(sequence)} stops."

        @self.agent.tool(sequential=True)
        def clear_pathway(ctx: RunContext[SceneContext]) -> str:
            """Stop active pathway animation."""
            ctx.deps.dispatch(ClearPathway())
            return "Cleared pathway highlight."


def register_scene_tools(agent: Agent[SceneContext, str]) -> None:
    """Primary entry point to register all anatomical scene tools on an agent."""
    registry = HoomaanSceneToolRegistry(agent)
    registry.register_all()


__all__ = [
    "SceneContext",
    "_resolve",
    "resolve_organ",
    "register_scene_tools",
    "HoomaanSceneToolRegistry",
    "MAX_ISOLATED",
    "MAX_ILLUMINATED",
    "MIN_PATHWAY_STOPS",
    "MAX_PATHWAY_STOPS",
    "MIN_STEP_SECONDS",
    "MAX_STEP_SECONDS",
    "DEFAULT_STEP_SECONDS",
    "MIN_GHOST",
    "XRAY_OPACITY",
    "MAX_SEARCH_RESULTS",
]
