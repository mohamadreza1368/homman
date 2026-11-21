"""Anatomical viewport control tools exposed to Pydantic AI agent.

Every tool strictly validates identifiers against the currently loaded atlas manifest,
preventing fictitious structure hallucination. Viewport mutations are dispatched
sequentially to ensure deterministic scene orchestration.
"""

from __future__ import annotations

from pydantic_ai import Agent

from hoomaan_engine.scene_clinical_tools import register_clinical_tools
from hoomaan_engine.scene_context import (
    DEFAULT_STEP_SECONDS,
    MAX_ILLUMINATED,
    MAX_ISOLATED,
    MAX_PATHWAY_STOPS,
    MAX_SEARCH_RESULTS,
    MAX_STEP_SECONDS,
    MIN_GHOST,
    MIN_PATHWAY_STOPS,
    MIN_STEP_SECONDS,
    XRAY_OPACITY,
    SceneContext,
    resolve_organ,
)
from hoomaan_engine.scene_layer_tools import register_layer_tools
from hoomaan_engine.scene_pathway_tools import register_pathway_tools
from hoomaan_engine.scene_selection_tools import register_selection_tools

# Alias for backward compatibility with external references and tests
_resolve = resolve_organ


def register_scene_tools(agent: Agent[SceneContext, str]) -> None:
    """Register all anatomical viewport control tools onto the given agent."""
    register_selection_tools(agent)
    register_layer_tools(agent)
    register_clinical_tools(agent)
    register_pathway_tools(agent)


__all__ = [
    "SceneContext",
    "_resolve",
    "resolve_organ",
    "register_scene_tools",
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
