"""Anatomical viewport control tools exposed to Pydantic AI agent.

Every tool strictly validates identifiers against the currently loaded atlas manifest,
preventing fictitious structure hallucination. Viewport mutations are dispatched
sequentially to ensure deterministic scene orchestration.
"""

from __future__ import annotations

import difflib
from collections.abc import Callable
from dataclasses import dataclass, field
from itertools import pairwise
from typing import Literal

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


def _resolve(ctx: RunContext[SceneContext], organ_id: str) -> OrganMeta:
    """Validate organ identifier or raise a guided ModelRetry with near matches."""
    record = ctx.deps.organs.get(organ_id)
    if record is not None:
        return record

    similar = difflib.get_close_matches(organ_id, ctx.deps.organs, n=_MATCH_SUGGESTIONS, cutoff=0.5)
    tip = (
        f"Did you mean: {', '.join(similar)}"
        if similar
        else f"Loaded structures include: {', '.join(list(ctx.deps.organs)[:_MATCH_SUGGESTIONS])}"
    )

    raise ModelRetry(
        f"Structure {organ_id!r} is not loaded in the viewport. {tip}. "
        "Select an organ_id exactly matching the loaded manifest inventory."
    )


def register_scene_tools(agent: Agent[SceneContext, str]) -> None:
    """Register all anatomical viewport control tools onto the given agent."""

    @agent.tool
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
                f"Nothing loaded matches {query!r}. It may belong to a hidden system — "
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

    @agent.tool(sequential=True)
    def focus_organ(ctx: RunContext[SceneContext], organ_id: str) -> str:
        """Center the viewport camera on an anatomical structure and select it."""
        organ = _resolve(ctx, organ_id)
        ctx.deps.dispatch(FocusOrgan(organ_id=organ.organ_id))
        return f"Focused {organ.ta2_latin} ({organ.name_en})."

    @agent.tool(sequential=True)
    def isolate_structures(ctx: RunContext[SceneContext], organ_ids: list[str]) -> str:
        """Isolate a specific set of structures and hide all other anatomy."""
        if not organ_ids:
            raise ModelRetry("isolate_structures requires at least one organ_id.")
        if len(organ_ids) > MAX_ISOLATED:
            raise ModelRetry(
                f"Too many structures requested ({len(organ_ids)}); "
                f"the limit is {MAX_ISOLATED}. Narrow the selection."
            )

        resolved_ids = [_resolve(ctx, oid).organ_id for oid in organ_ids]
        ctx.deps.dispatch(IsolateStructures(organ_ids=resolved_ids))
        return f"Isolated {len(resolved_ids)} structure(s)."

    @agent.tool(sequential=True)
    def illuminate_structures(ctx: RunContext[SceneContext], organ_ids: list[str]) -> str:
        """Illuminate targeted structures without concealing adjacent anatomy."""
        if len(organ_ids) > MAX_ILLUMINATED:
            raise ModelRetry(
                f"Too many structures to light ({len(organ_ids)}); the limit is "
                f"{MAX_ILLUMINATED}. Highlight specific entities rather than entire regions."
            )

        resolved_ids = [_resolve(ctx, oid).organ_id for oid in organ_ids]
        ctx.deps.dispatch(IlluminateStructures(organ_ids=resolved_ids))
        if not resolved_ids:
            return "Turned the light off."
        return f"Lit {len(resolved_ids)} structure(s)."

    @agent.tool(sequential=True)
    def isolate_region(ctx: RunContext[SceneContext], organ_id: str) -> str:
        """Reveal a designated structure alongside all internal sub-structures."""
        organ = _resolve(ctx, organ_id)
        ctx.deps.dispatch(IsolateRegion(organ_id=organ.organ_id))
        return f"Isolated {organ.ta2_latin} and its internal structures."

    @agent.tool(sequential=True)
    def isolate_group(ctx: RunContext[SceneContext], group: str) -> str:
        """Isolate an entire named anatomical branch (e.g., 'Brain', 'Muscles of hand')."""
        target = group.strip()
        if target not in ctx.deps.groups:
            hints = [g for g in sorted(ctx.deps.groups) if target.lower() in g.lower()]
            suggestion_msg = f" Did you mean: {', '.join(hints[:5])}?" if hints else ""
            raise ModelRetry(
                f"{group!r} is not an available hierarchy group.{suggestion_msg} "
                "Provide an exact group string from the prompt inventory or "
                "isolate specific organ_ids using isolate_structures."
            )
        ctx.deps.dispatch(IsolateGroup(group=target))
        return f"Isolated everything under {target}."

    @agent.tool(sequential=True)
    def add_supply(ctx: RunContext[SceneContext], kind: Literal["vascular", "neural"]) -> str:
        """Bring nearby vessels or nerves into the isolated viewport region."""
        ctx.deps.dispatch(AddSupply(kind=kind))
        category = "vessels" if kind == "vascular" else "nerves"
        return (
            f"Asked the viewer to add the {category} whose extent meets the isolated "
            "region. This is proximity, measured against the geometry — it is not "
            "a claim that each one supplies the region, and a long structure "
            "passing nearby is added whole. Say what the reader is now seeing in "
            "those terms, and name what actually supplies it yourself. It may add "
            "nothing, if the region has none nearby or nothing is isolated."
        )

    @agent.tool(sequential=True)
    def show_all_structures(ctx: RunContext[SceneContext]) -> str:
        """Clear active isolation, slicing, and overlays, restoring full visibility."""
        ctx.deps.dispatch(ResetView())
        return (
            "Cleared isolation, section and overlays; the full scene is visible. "
            "The reader's own transparency and colour settings are unchanged."
        )

    @agent.tool(sequential=True)
    def set_layer_visibility(
        ctx: RunContext[SceneContext], system: AnatomicalSystem, visible: bool
    ) -> str:
        """Toggle whole anatomical system visibility on or off."""
        if system not in ctx.deps.systems:
            options = ", ".join(sorted(ctx.deps.systems))
            raise ModelRetry(
                f"The {system} system is not loaded in this atlas. "
                f"Available systems: {options}."
            )
        ctx.deps.dispatch(SetLayerVisibility(system=system, visible=visible))
        return f"{system} is now {'visible' if visible else 'hidden'}."

    @agent.tool(sequential=True)
    def set_layer_opacity(
        ctx: RunContext[SceneContext], system: AnatomicalSystem, opacity: float
    ) -> str:
        """Adjust system transparency to reveal deep internal structures."""
        if system not in ctx.deps.systems:
            options = ", ".join(sorted(ctx.deps.systems))
            raise ModelRetry(
                f"The {system} system is not loaded in this atlas. "
                f"Available systems: {options}."
            )
        if not MIN_GHOST <= opacity <= 1.0:
            raise ModelRetry(
                f"opacity must be between {MIN_GHOST} and 1, got {opacity}. "
                "To remove a layer entirely use set_layer_visibility — an "
                "invisible-but-present layer is a state the reader cannot "
                "interpret."
            )
        ctx.deps.dispatch(SetLayerOpacity(system=system, opacity=opacity))
        if opacity >= 1.0:
            return f"{system} is solid again."
        return f"{system} is now {opacity:.0%} opaque; what is behind it shows through."

    @agent.tool(sequential=True)
    def xray_system(ctx: RunContext[SceneContext], system: AnatomicalSystem) -> str:
        """Faintly ghost all surrounding systems while keeping the target system opaque."""
        if system not in ctx.deps.systems:
            options = ", ".join(sorted(ctx.deps.systems))
            raise ModelRetry(
                f"The {system} system is not loaded. Available systems: {options}."
            )

        faded_systems = sorted(ctx.deps.systems - {system})
        ctx.deps.dispatch(SetLayerOpacity(system=system, opacity=1.0))
        for bg_sys in faded_systems:
            ctx.deps.dispatch(SetLayerOpacity(system=bg_sys, opacity=XRAY_OPACITY))
        return (
            f"{system} is solid; {len(faded_systems)} other system(s) faded back so it "
            "can be followed through them."
        )

    @agent.tool(sequential=True)
    def apply_pathology_overlay(
        ctx: RunContext[SceneContext],
        organ_id: str,
        pathology: str,
        severity: float,
    ) -> str:
        """Apply a severity-graded pathological tint overlay to a structure."""
        organ = _resolve(ctx, organ_id)
        if not 0.0 <= severity <= 1.0:
            raise ModelRetry(
                f"severity must be between 0 and 1, got {severity}. "
                "Use 0.25 for mild, 0.5 for moderate, 0.85 for severe."
            )
        tag = pathology.strip()
        if not tag:
            raise ModelRetry("pathology must name the condition being shown.")

        ctx.deps.dispatch(
            ApplyPathologyOverlay(
                organ_id=organ.organ_id, pathology=tag[:120], severity=severity
            )
        )
        return f"Marked {organ.name_en} with {tag} at severity {severity:.2f}."

    @agent.tool(sequential=True)
    def clear_pathology_overlays(ctx: RunContext[SceneContext]) -> str:
        """Clear all active pathological markings from the viewport."""
        ctx.deps.dispatch(ClearPathologyOverlays())
        return "Cleared all pathology overlays."

    @agent.tool(sequential=True)
    def highlight_pathway(
        ctx: RunContext[SceneContext],
        label: str,
        organ_ids: list[str],
        step_seconds: float = DEFAULT_STEP_SECONDS,
        loop: bool = True,
    ) -> str:
        """Trace and animate a sequential physiological or anatomical path."""
        title = label.strip()
        if not title:
            raise ModelRetry(
                "label must name the process being traced — the reader sees it "
                "over the model."
            )

        if len(organ_ids) < MIN_PATHWAY_STOPS:
            raise ModelRetry(
                f"A pathway needs at least {MIN_PATHWAY_STOPS} structures, got "
                f"{len(organ_ids)}. To point at a single structure use focus_organ."
            )
        if len(organ_ids) > MAX_PATHWAY_STOPS:
            raise ModelRetry(
                f"Too many stops ({len(organ_ids)}); the limit is "
                f"{MAX_PATHWAY_STOPS}. Trace the part of the route that answers "
                "the question, or split it into two pathways."
            )

        if not MIN_STEP_SECONDS <= step_seconds <= MAX_STEP_SECONDS:
            raise ModelRetry(
                f"step_seconds must be between {MIN_STEP_SECONDS} and "
                f"{MAX_STEP_SECONDS}, got {step_seconds}. "
                f"{DEFAULT_STEP_SECONDS} suits most explanations."
            )

        verified_ids = [_resolve(ctx, oid).organ_id for oid in organ_ids]
        for prev_id, next_id in pairwise(verified_ids):
            if prev_id == next_id:
                raise ModelRetry(
                    f"{next_id!r} appears twice in a row. Each step must move to "
                    "a different structure; list the route without repeats."
                )

        ctx.deps.dispatch(
            HighlightPathway(
                label=title[:120],
                organ_ids=verified_ids,
                step_seconds=step_seconds,
                loop=loop,
            )
        )
        return (
            f"Tracing {title!r} through {len(verified_ids)} structures at "
            f"{step_seconds:g}s per step{', looping' if loop else ''}."
        )

    @agent.tool(sequential=True)
    def clear_pathway(ctx: RunContext[SceneContext]) -> str:
        """Halt pathway animation and remove the route visualizer."""
        ctx.deps.dispatch(ClearPathway())
        return "Cleared the pathway."

    @agent.tool(sequential=True)
    def scan_at_structure(
        ctx: RunContext[SceneContext],
        organ_id: str,
        plane: ScannerPlane | None = None,
    ) -> str:
        """Position scanner plane at the vertical elevation of a selected structure."""
        organ = _resolve(ctx, organ_id)
        ctx.deps.dispatch(ScanAtStructure(organ_id=organ.organ_id, plane=plane))
        plane_str = " on a frontal plane" if plane == "coronal" else ""
        return f"Put the scanner at {organ.ta2_latin} ({organ.name_en}){plane_str}."

    @agent.tool(sequential=True)
    def set_heart_rhythm(
        ctx: RunContext[SceneContext],
        rhythm: HeartRhythmId,
        sound: bool | None = None,
    ) -> str:
        """Drive heartbeat kinematics and cardiac acoustic simulation."""
        ctx.deps.dispatch(SetHeartRhythm(rhythm=rhythm, sound=sound))
        audible_str = " with its sounds on" if sound else ""
        return f"The heart is beating in {rhythm.replace('_', ' ')}{audible_str}."

    @agent.tool(sequential=True)
    def set_cross_section(
        ctx: RunContext[SceneContext], plane: SectionPlane, position: float
    ) -> str:
        """Slice through 3D meshes along an anatomical section plane."""
        if not -1.0 <= position <= 1.0:
            raise ModelRetry(
                f"position must be between -1 and 1, got {position}. "
                "0 cuts through the centre."
            )
        ctx.deps.dispatch(SetCrossSection(plane=plane, position=position))
        return f"Cut the model on the {plane} plane at {position:.2f}."
