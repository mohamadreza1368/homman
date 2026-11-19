"""Model capability heuristics and routing decision logic for AI providers.

Evaluates candidate model identifiers to filter out non-conversational artifacts
(speech, embeddings, vision generation) and selects appropriate endpoint targets
(such as OpenAI chat vs responses APIs).
"""

from __future__ import annotations

from typing import Literal

from hoomaan_engine.protocol import AiProvider

Endpoint = Literal["chat", "responses"]

_NON_CONVERSATIONAL_PATTERNS = (
    "embedding",
    "embed",
    "whisper",
    "tts",
    "dall-e",
    "moderation",
    "image-",
    "-image",
    "audio",
    "realtime",
    "transcribe",
    "aqa",
    "veo",
    "imagen",
)

_SPECIALIZED_NON_STREAMING = (
    "deep-research",
    "search-preview",
    "codex",
    "-pro",
    "chatgpt-",
    "-instruct",
)

_RESPONSES_API_FAMILIES = ("gpt-5.6", "gpt-6")


def _normalize(model_id: str) -> str:
    return model_id.lower()


def is_offered(provider: AiProvider, model_id: str) -> bool:
    """Determines whether a discovered model identifier is eligible for conversation."""
    normalized = _normalize(model_id)
    if any(pat in normalized for pat in _NON_CONVERSATIONAL_PATTERNS):
        return False
    return not (
        provider == "openai"
        and any(pat in normalized for pat in _SPECIALIZED_NON_STREAMING)
    )


def endpoint_for(provider: AiProvider, model_id: str) -> Endpoint:
    """Resolves whether a model requires the Responses or standard Chat completions endpoint."""
    if provider != "openai":
        return "chat"
    normalized = _normalize(model_id)
    return "responses" if any(pat in normalized for pat in _RESPONSES_API_FAMILIES) else "chat"
