"""Tools for adjusting whole anatomical system layer visibility and opacity."""

from __future__ import annotations

from pydantic_ai import Agent, ModelRetry, RunContext

from hoomaan_engine.protocol import (
    AnatomicalSystem,
    SetLayerOpacity,
    SetLayerVisibility,
)
from hoomaan_engine.scene_context import (
    MIN_GHOST,
    XRAY_OPACITY,
    SceneContext,
)


def register_layer_tools(agent: Agent[SceneContext, str]) -> None:
    """Register system visibility, opacity, and X-ray tools."""

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
