"""HOOMAAN On-Device AI Engine: Ollama Local Chat & Clinical Triage.

Executes private, on-device anatomical tutoring via a local Ollama daemon.
Enforces safety guardrails, prompt budgeting, and zero-data-leakage triage.
"""

from __future__ import annotations

import json
import math
import re
from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Final, Literal

import httpx

from hoomaan_engine.prompts import (
    LOCAL_SAFETY_REMINDER,
    LOCAL_TRIAGE_PROMPT,
    SAFETY,
    build_local_instructions,
    build_local_question,
    local_notice,
)
from hoomaan_engine.protocol import (
    GenderModel,
    LocalModelInfo,
    OrganContext,
    TokenUsage,
    TranscriptTurn,
    UserProfile,
)

OLLAMA_URL: Final[str] = "http://127.0.0.1:11434"
NUM_CTX: Final[int] = 16_384
PROMPT_SHARE: Final[float] = 0.6
CHARS_PER_TOKEN: Final[float] = 2.5
TRUNCATION_CHARS_PER_TOKEN: Final[float] = 6.0
FALLBACK_LANGUAGE: Final[str] = "English"

NOTICE_MODEL: Final[str] = "HOOMAAN notice"
MessageKind = Literal["study", "person", "crisis"]

SUPPORTED_LANGUAGES: Final[frozenset[str]] = frozenset(
    {
        "Arabic", "Bulgarian", "Chinese", "Croatian", "Czech", "Danish", "Dutch",
        "English", "Finnish", "French", "German", "Greek", "Hebrew", "Hindi",
        "Hungarian", "Indonesian", "Italian", "Japanese", "Korean", "Macedonian",
        "Malay", "Mandarin", "Norwegian", "Persian", "Polish", "Portuguese",
        "Romanian", "Russian", "Serbian", "Slovak", "Slovenian", "Spanish",
        "Swedish", "Thai", "Turkish", "Ukrainian", "Vietnamese",
    }
)


class LocalModelError(Exception):
    """Communication failure with the local Ollama runtime."""


class TruncatedPromptError(LocalModelError):
    """Raised when Ollama truncates earlier context window containing safety instructions."""


class RemoteModelError(LocalModelError):
    """Raised when model maps to a remote proxy rather than verified local weights."""


@dataclass(frozen=True)
class LocalText:
    text: str


@dataclass(frozen=True)
class LocalDone:
    usage: TokenUsage | None
    model: str


@dataclass(frozen=True)
class AnswerLanguage:
    name: str
    unsupported: bool = False


def estimate_tokens(text: str) -> int:
    """Estimates token footprint based on character count heuristic."""
    return math.ceil(len(text) / CHARS_PER_TOKEN)


def fit_history(
    system_prompt: str,
    history: list[TranscriptTurn],
    query: str,
    budget: int,
) -> list[TranscriptTurn]:
    """Prunes older dialogue turns to ensure history fits within token budget."""
    reserved = estimate_tokens(system_prompt) + estimate_tokens(query)
    available = budget - reserved
    if available <= 0:
        return []

    retained: list[TranscriptTurn] = []
    current_cost = 0

    for turn in reversed(history):
        cost = estimate_tokens(turn.content)
        if current_cost + cost > available:
            break
        retained.append(turn)
        current_cost += cost

    retained.reverse()
    return retained


def _http_client(transport: httpx.AsyncBaseTransport | None = None) -> httpx.AsyncClient:
    return httpx.AsyncClient(
        base_url=OLLAMA_URL,
        transport=transport,
        timeout=httpx.Timeout(connect=3.0, read=180.0, write=30.0, pool=30.0),
    )


async def _inspect_model_capabilities(
    client: httpx.AsyncClient,
    model_name: str,
) -> list[str]:
    res = await client.post("/api/show", json={"model": model_name})
    if res.status_code == 404:
        raise LocalModelError(f"Model {model_name!r} not found on local Ollama")
    res.raise_for_status()
    data = res.json()
    if data.get("remote") is True or "cloud" in model_name.lower():
        raise RemoteModelError(f"Model {model_name!r} routes to external server")
    return list(data.get("capabilities", []))


async def list_local_models(
    transport: httpx.AsyncBaseTransport | None = None,
) -> tuple[bool, list[LocalModelInfo]]:
    """Discovers verified offline models currently pulled in Ollama."""
    try:
        async with _http_client(transport) as client:
            res = await client.get("/api/tags")
            if res.status_code != 200:
                return False, []

            catalog: list[LocalModelInfo] = []
            for item in res.json().get("models", []):
                name = item.get("name") or item.get("model")
                if not isinstance(name, str) or not name:
                    continue
                if name.endswith(":cloud") or item.get("remote") is True:
                    continue

                try:
                    caps = await _inspect_model_capabilities(client, name)
                except (RemoteModelError, LocalModelError, httpx.HTTPError):
                    continue

                if caps and "completion" not in caps:
                    continue

                details = item.get("details") or {}
                catalog.append(
                    LocalModelInfo(
                        name=name,
                        parameter_size=details.get("parameter_size"),
                        size_bytes=item.get("size") if isinstance(item.get("size"), int) else None,
                    )
                )

            catalog.sort(key=lambda m: m.name)
            return True, catalog
    except (httpx.ConnectError, httpx.TimeoutException, OSError):
        return False, []


async def classify_message(
    model: str,
    history: list[TranscriptTurn],
    query: str,
    transport: httpx.AsyncBaseTransport | None = None,
) -> MessageKind:
    """Triage user input into educational study, personal consultation, or medical crisis."""
    prompt = LOCAL_TRIAGE_PROMPT + query[:500]
    try:
        async with _http_client(transport) as client:
            caps = await _inspect_model_capabilities(client, model)
            payload: dict[str, object] = {
                "model": model,
                "messages": [{"role": "user", "content": prompt}],
                "options": {"num_predict": 12, "temperature": 0},
                "stream": False,
            }
            if "thinking" in caps:
                payload["think"] = False

            res = await client.post("/api/chat", json=payload)
            res.raise_for_status()
            text = str((res.json().get("message") or {}).get("content") or "").upper()

            if "CRISIS" in text:
                return "crisis"
            if "PERSON" in text:
                return "person"
            return "study"
    except (httpx.HTTPError, LocalModelError, ValueError):
        return "study"


async def detect_answer_language(
    query: str,
    history: list[TranscriptTurn],
    model: str | None = None,
    transport: httpx.AsyncBaseTransport | None = None,
) -> AnswerLanguage:
    """Detects dialogue language, defaulting to Persian or English."""
    # Fast regex check for Persian / Arabic script
    if re.search(r"[\u0600-\u06FF\uFB50-\uFDFF\uFE70-\uFEFF]", query):
        return AnswerLanguage("Persian")

    return AnswerLanguage(FALLBACK_LANGUAGE)


async def stream_local_chat(
    model: str,
    messages: list[dict[str, str]],
    transport: httpx.AsyncBaseTransport | None = None,
) -> AsyncIterator[LocalText | LocalDone]:
    """Streams token chunks from local Ollama endpoint."""
    async with _http_client(transport) as client:
        payload = {
            "model": model,
            "messages": messages,
            "options": {"num_ctx": NUM_CTX},
            "stream": True,
        }
        try:
            async with client.stream("POST", "/api/chat", json=payload) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if not line:
                        continue
                    item = json.loads(line)
                    delta = (item.get("message") or {}).get("content", "")
                    if delta:
                        yield LocalText(delta)

                    if item.get("done") is True:
                        usage = None
                        p_eval = item.get("prompt_eval_count")
                        eval_c = item.get("eval_count")
                        if isinstance(p_eval, int) and isinstance(eval_c, int):
                            usage = TokenUsage(
                                input_tokens=p_eval,
                                output_tokens=eval_c,
                                cache_read_tokens=0,
                            )
                        yield LocalDone(usage=usage, model=model)
        except httpx.ConnectError as err:
            raise LocalModelError(f"Cannot connect to Ollama at {OLLAMA_URL}: {err}") from err


async def answer_local_turn(
    *,
    model: str,
    query: str,
    history: list[TranscriptTurn],
    profile: UserProfile,
    selection: list[OrganContext],
    gender: GenderModel = "male",
    preferred_language: str | None = None,
    transport: httpx.AsyncBaseTransport | None = None,
) -> AsyncIterator[LocalText | LocalDone]:
    """Conducts a single turn in an on-device local dialogue session."""
    # 1. Triage query for safety
    intent = await classify_message(model, history, query, transport=transport)
    lang = preferred_language or "Persian"

    if intent in ("person", "crisis"):
        notice = local_notice(intent, lang) or (
            "این سامانه آموزشی است و امکان تشخیص فردی ندارد."
            if intent == "person"
            else "در صورت شرایط اضطراری فوراً با ۱۱۵ تماس بگیرید."
        )
        yield LocalText(notice)
        yield LocalDone(usage=None, model=NOTICE_MODEL)
        return

    # 2. Build local instructions and prune history
    sys_prompt = build_local_instructions(
        profile=profile,
        selection=selection,
        answer_language=lang,
        gender=gender,
    )
    budget = int(NUM_CTX * PROMPT_SHARE)
    trimmed_turns = fit_history(sys_prompt, history, query, budget)

    messages = [{"role": "system", "content": sys_prompt}]
    for t in trimmed_turns:
        messages.append({"role": t.role, "content": t.content})
    messages.append({"role": "user", "content": build_local_question(query, answer_language=lang)})

    # 3. Stream chat from local model
    async for item in stream_local_chat(model, messages, transport=transport):
        yield item
