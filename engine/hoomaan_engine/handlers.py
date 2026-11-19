"""Dispatches and orchestrates IPC requests received across NDJSON transport.

Directs incoming actions to the AI conversational agent, provider catalogues,
or local Ollama interfaces while converting results into structured events.
"""

from __future__ import annotations

import asyncio

from pydantic import BaseModel

from hoomaan_engine.agent import (
    Completed,
    TextChunk,
    ToolStarted,
    build_scene_context,
    run_agent,
)
from hoomaan_engine.model_discovery import list_models
from hoomaan_engine.protocol import (
    AgentRequest,
    CaseVerdictEvent,
    DoneEvent,
    ErrorEvent,
    ListModelsRequest,
    LocalChatRequest,
    LocalModelsEvent,
    LocalModelsRequest,
    ModelsEvent,
    SceneCommandEvent,
    TextDeltaEvent,
    ToolStartedEvent,
)
from hoomaan_engine.providers import DEFAULT_MODELS, ProviderError
from hoomaan_engine.transport import Transport

_OVERLOAD_RETRIES = 2
_OVERLOAD_BACKOFF_SECONDS = (1.5, 4.0)


async def handle_agent_request(request: AgentRequest, transport: Transport) -> None:
    """Execute conversational turn with live 3D viewport commands and streaming prose."""
    if not request.available_organs:
        transport.emit(
            ErrorEvent(
                request_id=request.request_id,
                code="invalid_request",
                message="No structures are loaded in the viewport.",
            )
        )
        return

    for attempt in range(_OVERLOAD_RETRIES + 1):
        has_streamed_content = False

        def on_scene_command(cmd: BaseModel) -> None:
            nonlocal has_streamed_content
            has_streamed_content = True
            transport.emit(
                SceneCommandEvent(request_id=request.request_id, command=cmd)  # type: ignore[arg-type]
            )

        def on_case_verdict(score: int, verdict: str) -> None:
            nonlocal has_streamed_content
            has_streamed_content = True
            transport.emit(
                CaseVerdictEvent(
                    request_id=request.request_id, score=score, verdict=verdict
                )
            )

        scene_ctx = build_scene_context(request, on_scene_command, on_case_verdict)

        try:
            async for ev in run_agent(request, scene_ctx):
                if isinstance(ev, TextChunk):
                    has_streamed_content = True
                    transport.emit(
                        TextDeltaEvent(request_id=request.request_id, text=ev.text)
                    )
                elif isinstance(ev, ToolStarted):
                    has_streamed_content = True
                    transport.emit(
                        ToolStartedEvent(request_id=request.request_id, tool=ev.tool)
                    )
                elif isinstance(ev, Completed):
                    transport.emit(
                        DoneEvent(
                            request_id=request.request_id,
                            usage=ev.usage,
                            model=ev.model,
                        )
                    )
            return

        except asyncio.CancelledError:
            raise
        except ProviderError as exc:
            transport.emit(
                ErrorEvent(
                    request_id=request.request_id,
                    code="provider_error",
                    message=str(exc),
                )
            )
            return
        except Exception as exc:
            err_code = _classify(exc)
            can_retry = (
                err_code == "service_unavailable"
                and not has_streamed_content
                and attempt < _OVERLOAD_RETRIES
            )
            if can_retry:
                transport.log(
                    f"{request.request_id}: model capacity saturated, retrying "
                    f"({attempt + 1}/{_OVERLOAD_RETRIES})"
                )
                await asyncio.sleep(_OVERLOAD_BACKOFF_SECONDS[attempt])
                continue

            transport.emit(
                ErrorEvent(
                    request_id=request.request_id,
                    code=err_code,
                    message=_overload_hint(exc, err_code, request),
                )
            )
            return


def _overload_hint(exc: Exception, code: str, request: AgentRequest) -> str:
    """Format an actionable diagnostic message for transient capacity limits."""
    if code != "service_unavailable":
        return _readable(exc)
    active_model = request.model or DEFAULT_MODELS[request.provider]
    return (
        f"{active_model} is busy right now (the provider returned 503 after "
        f"{_OVERLOAD_RETRIES + 1} attempts). Pick a different model in Settings, "
        "or try again in a moment — your key is fine."
    )


async def handle_list_models(request: ListModelsRequest, transport: Transport) -> None:
    """Query provider endpoint for accessible models and validate credentials."""
    try:
        discovered = await list_models(request.provider, request.api_key)
    except asyncio.CancelledError:
        raise
    except ProviderError as exc:
        transport.emit(
            ErrorEvent(
                request_id=request.request_id, code="provider_error", message=str(exc)
            )
        )
        return
    except Exception as exc:
        transport.emit(
            ErrorEvent(
                request_id=request.request_id,
                code=_classify(exc),
                message=_readable(exc),
            )
        )
        return

    transport.emit(
        ModelsEvent(
            request_id=request.request_id, provider=request.provider, models=discovered
        )
    )
    transport.emit(DoneEvent(request_id=request.request_id, usage=None, model=None))


async def handle_local_chat(request: LocalChatRequest, transport: Transport) -> None:
    """Stream response from local Ollama runtime without triggering scene actions."""
    from hoomaan_engine.local_chat import (
        LocalDone,
        LocalModelError,
        LocalText,
        answer_local_turn,
    )

    try:
        async for item in answer_local_turn(
            model=request.model,
            history=request.history,
            query=request.query,
            profile=request.profile,
            selection=request.selection,
            gender=request.gender_model,
        ):
            if isinstance(item, LocalText):
                transport.emit(TextDeltaEvent(request_id=request.request_id, text=item.text))
            elif isinstance(item, LocalDone):
                transport.emit(
                    DoneEvent(request_id=request.request_id, usage=item.usage, model=item.model)
                )
    except asyncio.CancelledError:
        raise
    except LocalModelError as exc:
        transport.emit(
            ErrorEvent(request_id=request.request_id, code="provider_error", message=str(exc))
        )
    except Exception as exc:
        transport.emit(
            ErrorEvent(request_id=request.request_id, code="internal_error", message=_readable(exc))
        )


async def handle_local_models(request: LocalModelsRequest, transport: Transport) -> None:
    """Check whether local Ollama server is alive and report available models."""
    from hoomaan_engine.local_chat import list_local_models

    try:
        is_active, model_entries = await list_local_models()
    except asyncio.CancelledError:
        raise
    except Exception as exc:
        transport.emit(
            ErrorEvent(request_id=request.request_id, code="provider_error", message=_readable(exc))
        )
        return

    transport.emit(
        LocalModelsEvent(request_id=request.request_id, running=is_active, models=model_entries)
    )
    transport.emit(DoneEvent(request_id=request.request_id, usage=None, model=None))


_INCOMPATIBLE_MODEL = (
    "not supported for",
    "does not support",
    "is not supported",
    "unsupported",
    "not compatible",
    "does not exist",
)


def _model_is_incompatible(desc: str) -> bool:
    is_client_fault = "invalid_request" in desc or "400" in desc
    return is_client_fault and any(phrase in desc for phrase in _INCOMPATIBLE_MODEL)


def _classify(exc: Exception) -> str:
    """Classify exceptions into well-known engine error codes."""
    raw_info = f"{type(exc).__name__} {exc}".lower()
    if any(k in raw_info for k in ("api key", "unauthorized", "authentication", "401", "403", "permission")):
        return "invalid_api_key"
    if any(k in raw_info for k in ("rate limit", "429", "quota")):
        return "rate_limited"
    if _model_is_incompatible(raw_info):
        return "invalid_request"
    if any(k in raw_info for k in ("503", "unavailable", "overloaded", "high demand", "try again")):
        return "service_unavailable"
    if any(k in raw_info for k in ("connection", "timeout", "network")):
        return "provider_error"
    return "internal_error"


def _readable(exc: Exception) -> str:
    """Format exceptions for user display, highlighting actionable guidance."""
    msg = str(exc).strip() or type(exc).__name__
    if _model_is_incompatible(f"{type(exc).__name__} {msg}".lower()):
        msg = (
            "This model cannot be driven by HOOMAAN's scene tools. "
            "Choose another model under Settings — the one marked as the "
            "default is known to work. Provider said: " + msg
        )
    return msg if len(msg) <= 400 else msg[:397] + "…"
