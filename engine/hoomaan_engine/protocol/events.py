"""Outbound events emitted over stdout stream to the desktop host process."""

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import Field

from hoomaan_engine.protocol.commands import SceneCommand
from hoomaan_engine.protocol.requests import LocalModelName
from hoomaan_engine.protocol.types import (
    ENGINE_VERSION,
    PROTOCOL_VERSION,
    AiProvider,
    EngineErrorCode,
    Strict,
)


class TokenUsage(Strict):
    input_tokens: int = Field(ge=0)
    output_tokens: int = Field(ge=0)
    cache_read_tokens: int = Field(default=0, ge=0)


class ReadyEvent(Strict):
    type: Literal["ready"] = "ready"
    protocol_version: int
    engine_version: str

    @staticmethod
    def current() -> ReadyEvent:
        return ReadyEvent(
            protocol_version=PROTOCOL_VERSION, engine_version=ENGINE_VERSION
        )


class TextDeltaEvent(Strict):
    type: Literal["text_delta"] = "text_delta"
    request_id: str
    text: str


class ToolStartedEvent(Strict):
    type: Literal["tool_started"] = "tool_started"
    request_id: str
    tool: str


class SceneCommandEvent(Strict):
    type: Literal["scene_command"] = "scene_command"
    request_id: str
    command: SceneCommand


class ModelInfo(Strict):
    id: str = Field(min_length=1)
    label: str = Field(min_length=1)
    description: str | None = None
    recommended: bool = False


class ModelsEvent(Strict):
    type: Literal["models"] = "models"
    request_id: str
    provider: AiProvider
    models: list[ModelInfo]


class LocalModelInfo(Strict):
    name: LocalModelName
    parameter_size: str | None = None
    size_bytes: int | None = Field(default=None, ge=0)


class LocalModelsEvent(Strict):
    type: Literal["local_models"] = "local_models"
    request_id: str
    running: bool
    models: list[LocalModelInfo]


class CaseVerdictEvent(Strict):
    type: Literal["case_verdict"] = "case_verdict"
    request_id: str
    score: int = Field(ge=0, le=100)
    verdict: str = Field(min_length=1, max_length=4000)


class DoneEvent(Strict):
    type: Literal["done"] = "done"
    request_id: str
    usage: TokenUsage | None
    model: str | None = None


class ErrorEvent(Strict):
    type: Literal["error"] = "error"
    request_id: str | None
    code: EngineErrorCode
    message: str


EngineEvent = Annotated[
    ReadyEvent
    | TextDeltaEvent
    | ToolStartedEvent
    | SceneCommandEvent
    | ModelsEvent
    | LocalModelsEvent
    | CaseVerdictEvent
    | DoneEvent
    | ErrorEvent,
    Field(discriminator="type"),
]
