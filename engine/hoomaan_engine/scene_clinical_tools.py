"""Tools for applying clinical pathology overlays and driving cardiovascular kinematics."""

from __future__ import annotations

from pydantic_ai import Agent, ModelRetry, RunContext

from hoomaan_engine.protocol import (
    ApplyPathologyOverlay,
    ClearPathologyOverlays,
    HeartRhythmId,
    SetHeartRhythm,
)
from hoomaan_engine.scene_context import SceneContext, resolve_organ


def register_clinical_tools(agent: Agent[SceneContext, str]) -> None:
    """Register pathology overlays and cardiac rhythm tools."""

    @agent.tool(sequential=True)
    def apply_pathology_overlay(
        ctx: RunContext[SceneContext],
        organ_id: str,
        pathology: str,
        severity: float,
    ) -> str:
        """Apply a severity-graded pathological tint overlay to a structure."""
        organ = resolve_organ(ctx, organ_id)
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
    def set_heart_rhythm(
        ctx: RunContext[SceneContext],
        rhythm: HeartRhythmId,
        sound: bool | None = None,
    ) -> str:
        """Drive heartbeat kinematics and cardiac acoustic simulation."""
        ctx.deps.dispatch(SetHeartRhythm(rhythm=rhythm, sound=sound))
        audible_str = " with its sounds on" if sound else ""
        return f"The heart is beating in {rhythm.replace('_', ' ')}{audible_str}."
