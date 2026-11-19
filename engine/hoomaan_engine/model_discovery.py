"""Provider model catalog enumeration and credential verification.

Queries model lists from AI providers, filters out specialized or non-chat models,
and validates API key credentials live against upstream endpoints.
"""

from __future__ import annotations

import asyncio

from hoomaan_engine.model_capability import is_offered
from hoomaan_engine.protocol import AiProvider, ModelInfo
from hoomaan_engine.providers import DEFAULT_MODELS, ProviderError


def _finish(provider: AiProvider, models: list[ModelInfo]) -> list[ModelInfo]:
    """Sorts discovered models descending by identifier and marks verified defaults."""
    default_target = DEFAULT_MODELS[provider]

    deduped: dict[str, ModelInfo] = {}
    for entry in models:
        deduped.setdefault(entry.id, entry)

    sorted_list = sorted(deduped.values(), key=lambda m: m.id, reverse=True)
    for entry in sorted_list:
        entry.recommended = entry.id == default_target
    return sorted_list


def _list_google(api_key: str) -> list[ModelInfo]:
    from google import genai

    genai_client = genai.Client(api_key=api_key)
    discovered: list[ModelInfo] = []
    for model_meta in genai_client.models.list():
        supported_ops = getattr(model_meta, "supported_actions", None) or []
        if supported_ops and "generateContent" not in supported_ops:
            continue
        cleaned_id = (model_meta.name or "").removeprefix("models/")
        if not cleaned_id or not is_offered("google", cleaned_id):
            continue
        discovered.append(
            ModelInfo(
                id=cleaned_id,
                label=getattr(model_meta, "display_name", None) or cleaned_id,
                description=getattr(model_meta, "description", None),
            )
        )
    return discovered


def _list_anthropic(api_key: str) -> list[ModelInfo]:
    import anthropic

    anthropic_client = anthropic.Anthropic(api_key=api_key)
    discovered: list[ModelInfo] = []
    for model_record in anthropic_client.models.list(limit=100):
        if not is_offered("anthropic", model_record.id):
            continue
        discovered.append(
            ModelInfo(
                id=model_record.id,
                label=getattr(model_record, "display_name", None) or model_record.id,
            )
        )
    return discovered


def _list_openai(api_key: str) -> list[ModelInfo]:
    import openai

    openai_client = openai.OpenAI(api_key=api_key)
    discovered: list[ModelInfo] = []
    for model_item in openai_client.models.list():
        m_id = model_item.id
        if not m_id.startswith(("gpt-", "o1", "o3", "o4", "chatgpt-")):
            continue
        if not is_offered("openai", m_id):
            continue
        discovered.append(ModelInfo(id=m_id, label=m_id))
    return discovered


async def list_models(provider: AiProvider, api_key: str) -> list[ModelInfo]:
    """Fetches eligible conversational models for the given provider credentials."""
    registry = {
        "google": _list_google,
        "anthropic": _list_anthropic,
        "openai": _list_openai,
    }
    try:
        results = await asyncio.to_thread(registry[provider], api_key)
    except ImportError as err:
        raise ProviderError(
            f"The {provider} integration is missing from this build: {err}"
        ) from err

    return _finish(provider, results)
