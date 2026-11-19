"""Factory for constructing Pydantic AI Model instances per request.

Initializes provider-specific SDK client configurations (Anthropic, OpenAI, Google)
using the caller's transient API key without mutating global process environment variables.
"""

from __future__ import annotations

from pydantic_ai.models import Model

from hoomaan_engine.model_capability import endpoint_for
from hoomaan_engine.protocol import AiProvider

DEFAULT_MODELS: dict[AiProvider, str] = {
    "anthropic": "claude-sonnet-5",
    "openai": "gpt-5.2",
    "google": "gemini-3.1-flash-lite",
}


class ProviderError(RuntimeError):
    """Raised when an AI provider integration fails to initialize."""


def resolve_model_name(provider: AiProvider, model: str | None) -> str:
    """Returns the effective model identifier, substituting provider default when omitted."""
    return model or DEFAULT_MODELS[provider]


def build_model(provider: AiProvider, api_key: str, model: str | None = None) -> Model:
    target_name = resolve_model_name(provider, model)

    try:
        if provider == "anthropic":
            from pydantic_ai.models.anthropic import (
                AnthropicModel,
                AnthropicModelSettings,
            )
            from pydantic_ai.providers.anthropic import AnthropicProvider

            return AnthropicModel(
                target_name,
                provider=AnthropicProvider(api_key=api_key),
                settings=AnthropicModelSettings(
                    anthropic_cache_tool_definitions=True,
                    anthropic_cache_instructions=True,
                ),
            )

        if provider == "openai":
            from pydantic_ai.providers.openai import OpenAIProvider

            if endpoint_for("openai", target_name) == "responses":
                from pydantic_ai.models.openai import (
                    OpenAIResponsesModel,
                    OpenAIResponsesModelSettings,
                )

                return OpenAIResponsesModel(
                    target_name,
                    provider=OpenAIProvider(api_key=api_key),
                    settings=OpenAIResponsesModelSettings(openai_store=False),
                )

            from pydantic_ai.models.openai import OpenAIChatModel

            return OpenAIChatModel(target_name, provider=OpenAIProvider(api_key=api_key))

        from pydantic_ai.models.google import GoogleModel
        from pydantic_ai.providers.google import GoogleProvider

        return GoogleModel(target_name, provider=GoogleProvider(api_key=api_key))

    except ImportError as err:
        raise ProviderError(
            f"The {provider} integration is missing from this build: {err}"
        ) from err
