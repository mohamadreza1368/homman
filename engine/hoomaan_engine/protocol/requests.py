"""Inbound request models accepted over IPC from the desktop host process."""

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import AfterValidator, Field

from hoomaan_engine.protocol.anatomy import (
    BreathContext,
    HeartContext,
    OrganContext,
    OrganMeta,
    ScannerContext,
)
from hoomaan_engine.protocol.cases import VirtualPatient
from hoomaan_engine.protocol.types import (
    AiProvider,
    GenderModel,
    Language,
    SessionMode,
    Strict,
    UserProfile,
)


class TranscriptTurn(Strict):
    role: Literal["user", "assistant"]
    content: str


class AgentRequest(Strict):
    kind: Literal["agent_request"] = "agent_request"
    request_id: str = Field(min_length=1)
    query: str = Field(min_length=1, max_length=8000)
    history: list[TranscriptTurn] = Field(max_length=100)
    provider: AiProvider
    model: str | None = None
    profile: UserProfile
    language: Language
    gender_model: GenderModel
    mode: SessionMode
    selection: list[OrganContext] = Field(max_length=64)
    available_organs: list[OrganMeta]
    available_groups: list[str] = Field(default_factory=list, max_length=400)
    case: VirtualPatient | None = None
    scanner: ScannerContext | None = None
    heart: HeartContext | None = None
    breathing: BreathContext | None = None
    api_key: str = Field(min_length=1, repr=False)


class ListModelsRequest(Strict):
    kind: Literal["list_models"] = "list_models"
    request_id: str = Field(min_length=1)
    provider: AiProvider
    api_key: str = Field(min_length=1, repr=False)


LOCAL_MODEL_PATTERN = r"^[A-Za-z0-9][A-Za-z0-9._:/@-]{0,199}$"


def _validate_local_tag(val: str) -> str:
    if "://" in val or ".." in val:
        raise ValueError("Invalid Ollama model name")
    return val


LocalModelName = Annotated[
    str, Field(pattern=LOCAL_MODEL_PATTERN), AfterValidator(_validate_local_tag)
]


class LocalChatRequest(Strict):
    kind: Literal["local_chat_request"] = "local_chat_request"
    request_id: str = Field(min_length=1)
    query: str = Field(min_length=1, max_length=8000)
    history: list[TranscriptTurn] = Field(default_factory=list, max_length=100)
    model: LocalModelName
    profile: UserProfile
    gender_model: GenderModel = "male"
    selection: list[OrganContext] = Field(default_factory=list, max_length=64)


class LocalModelsRequest(Strict):
    kind: Literal["local_models_request"] = "local_models_request"
    request_id: str = Field(min_length=1)


class CancelRequest(Strict):
    kind: Literal["cancel"] = "cancel"
    request_id: str = Field(min_length=1)


class ShutdownRequest(Strict):
    kind: Literal["shutdown"] = "shutdown"


EngineRequest = Annotated[
    AgentRequest
    | ListModelsRequest
    | LocalChatRequest
    | LocalModelsRequest
    | CancelRequest
    | ShutdownRequest,
    Field(discriminator="kind"),
]
