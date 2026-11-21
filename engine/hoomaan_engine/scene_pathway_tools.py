"""Tools for sequential physiological pathways and cross-section plane cutting."""

from __future__ import annotations

from itertools import pairwise

from pydantic_ai import Agent, ModelRetry, RunContext

from hoomaan_engine.protocol import (
    ClearPathway,
    HighlightPathway,
    ScanAtStructure,
    ScannerPlane,
    SectionPlane,
    SetCrossSection,
)
from hoomaan_engine.scene_context import (
    DEFAULT_STEP_SECONDS,
    MAX_PATHWAY_STOPS,
    MAX_STEP_SECONDS,
    MIN_PATHWAY_STOPS,
    MIN_STEP_SECONDS,
    SceneContext,
    resolve_organ,
)


def register_pathway_tools(agent: Agent[SceneContext, str]) -> None:
    """Register pathway tracing, scanner elevation, and cross-section slicing tools."""

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

        verified_ids = [resolve_organ(ctx, oid).organ_id for oid in organ_ids]
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
        organ = resolve_organ(ctx, organ_id)
        ctx.deps.dispatch(ScanAtStructure(organ_id=organ.organ_id, plane=plane))
        plane_str = " on a frontal plane" if plane == "coronal" else ""
        return f"Put the scanner at {organ.ta2_latin} ({organ.name_en}){plane_str}."

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
