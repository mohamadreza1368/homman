"""Agent runner: synchronizes conversational tutoring with dynamic 3D viewport actions.

Commands are emitted in real time as tool executions occur, allowing the 3D scene
to orient and highlight structures contemporaneously with the generated narrative.
"""

from __future__ import annotations

import sys
from collections.abc import AsyncIterator
from dataclasses import dataclass

from pydantic_ai import Agent, AgentRunResultEvent
from pydantic_ai.messages import (
    FunctionToolCallEvent,
    ModelMessage,
    ModelRequest,
    ModelResponse,
    PartDeltaEvent,
    PartStartEvent,
    TextPart,
    TextPartDelta,
    UserPromptPart,
)

from hoomaan_engine.case_tools import register_case_tools
from hoomaan_engine.prompts import build_instructions
from hoomaan_engine.protocol import (
    AgentRequest,
    AnatomicalSystem,
    TokenUsage,
    TranscriptTurn,
)
from hoomaan_engine.providers import build_model, resolve_model_name
from hoomaan_engine.scene_tools import SceneContext, register_scene_tools

# Allow up to two retries if the model passes a non-existent organ ID
MAX_TOOL_RETRIES = 2


@dataclass
class TextChunk:
    text: str


@dataclass
class ToolStarted:
    tool: str


@dataclass
class Completed:
    usage: TokenUsage | None
    model: str


AgentEvent = TextChunk | ToolStarted | Completed


def build_agent(request: AgentRequest, scene: SceneContext) -> Agent[SceneContext, str]:
    """Instantiate a Pydantic AI agent configured with context, tools, and prompts."""
    model_instance = build_model(request.provider, request.api_key, request.model)
    system_instructions = build_instructions(
        profile=request.profile,
        language=request.language,
        organs=list(scene.organs.values()),
        selection=request.selection,
        mode=request.mode,
        patient=request.case,
        gender=request.gender_model,
        groups=request.available_groups,
        scanner=request.scanner,
        heart=request.heart,
        breathing=request.breathing,
    )
    
    agent: Agent[SceneContext, str] = Agent(
        model_instance,
        deps_type=SceneContext,
        instructions=system_instructions,
        retries=MAX_TOOL_RETRIES,
    )
    
    register_scene_tools(agent)
    if request.mode == "case":
        register_case_tools(agent)
        
    return agent


def build_scene_context(request: AgentRequest, emit, emit_verdict=None) -> SceneContext:
    """Build the shared SceneContext dependency injected into all tool invocations."""
    discovered_systems: set[AnatomicalSystem] = {o.system for o in request.available_organs}
    return SceneContext(
        organs={o.organ_id: o for o in request.available_organs},
        groups=set(request.available_groups),
        systems=discovered_systems,
        profile=request.profile,
        language=request.language,
        emit=emit,
        emit_verdict=emit_verdict if request.mode == "case" else None,
    )


def build_history(history_turns: list[TranscriptTurn]) -> list[ModelMessage]:
    """Convert conversational turns into Pydantic AI message structures."""
    reconstructed: list[ModelMessage] = []
    for turn in history_turns:
        body = turn.content.strip()
        if not body:
            continue
        if turn.role == "user":
            reconstructed.append(ModelRequest(parts=[UserPromptPart(content=body)]))
        else:
            reconstructed.append(ModelResponse(parts=[TextPart(content=body)]))
    return reconstructed


async def run_agent(
    request: AgentRequest, scene: SceneContext
) -> AsyncIterator[AgentEvent]:
    """Stream model output chunks, tool activations, and execution completion."""
    agent_inst = build_agent(request, scene)
    dialogue_history = build_history(request.history)
    resolved_model_name = resolve_model_name(request.provider, request.model)

    async with agent_inst.run_stream_events(
        request.query, deps=scene, message_history=dialogue_history
    ) as stream_handle:
        async for stream_ev in stream_handle:
            if isinstance(stream_ev, PartStartEvent) and isinstance(stream_ev.part, TextPart):
                if stream_ev.part.content:
                    yield TextChunk(stream_ev.part.content)

            elif isinstance(stream_ev, PartDeltaEvent) and isinstance(
                stream_ev.delta, TextPartDelta
            ):
                if stream_ev.delta.content_delta:
                    yield TextChunk(stream_ev.delta.content_delta)

            elif isinstance(stream_ev, FunctionToolCallEvent):
                yield ToolStarted(stream_ev.part.tool_name)

            elif isinstance(stream_ev, AgentRunResultEvent):
                yield Completed(extract_token_usage(stream_ev), resolved_model_name)


def extract_token_usage(event: AgentRunResultEvent) -> TokenUsage | None:
    """Safely extract token consumption metrics across varied SDK versions."""
    raw_usage = getattr(event.result, "usage", None)
    if callable(raw_usage):
        raw_usage = raw_usage()
    if raw_usage is None:
        return None

    in_count = _parse_token_num(getattr(raw_usage, "input_tokens", None))
    out_count = _parse_token_num(getattr(raw_usage, "output_tokens", None))
    if in_count is None or out_count is None:
        print(
            f"[hoomaan_engine] {type(raw_usage).__name__} lacks valid token counts; reporting as uncosted",
            file=sys.stderr,
            flush=True,
        )
        return None

    cached_count = _parse_token_num(getattr(raw_usage, "cache_read_tokens", None)) or 0
    return TokenUsage(
        input_tokens=in_count,
        output_tokens=out_count,
        cache_read_tokens=min(cached_count, in_count),
    )


def _parse_token_num(raw_val: object) -> int | None:
    """Validate and coerce non-negative integer token values."""
    if isinstance(raw_val, bool) or not isinstance(raw_val, (int, float)):
        return None
    as_int = int(raw_val)
    return as_int if as_int >= 0 else None
