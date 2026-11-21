"""Tools for searching, focusing, isolating, and illuminating anatomical structures."""

from __future__ import annotations

from typing import Literal

from pydantic_ai import Agent, ModelRetry, RunContext

from hoomaan_engine.protocol import (
    AddSupply,
    FocusOrgan,
    IlluminateStructures,
    IsolateGroup,
    IsolateRegion,
    IsolateStructures,
    ResetView,
)
from hoomaan_engine.scene_context import (
    MAX_ILLUMINATED,
    MAX_ISOLATED,
    MAX_SEARCH_RESULTS,
    SceneContext,
    resolve_organ,
)


def register_selection_tools(agent: Agent[SceneContext, str]) -> None:
    """Register structure search, camera focus, and isolation tools."""

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

    @agent.tool(sequential=True)
    def focus_organ(ctx: RunContext[SceneContext], organ_id: str) -> str:
        """Center the viewport camera on an anatomical structure and select it."""
        organ = resolve_organ(ctx, organ_id)
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

        resolved_ids = [resolve_organ(ctx, oid).organ_id for oid in organ_ids]
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

        resolved_ids = [resolve_organ(ctx, oid).organ_id for oid in organ_ids]
        ctx.deps.dispatch(IlluminateStructures(organ_ids=resolved_ids))
        if not resolved_ids:
            return "Turned the light off."
        return f"Lit {len(resolved_ids)} structure(s)."

    @agent.tool(sequential=True)
    def isolate_region(ctx: RunContext[SceneContext], organ_id: str) -> str:
        """Reveal a designated structure alongside all internal sub-structures."""
        organ = resolve_organ(ctx, organ_id)
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
