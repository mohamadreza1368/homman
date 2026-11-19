"""Local dialogue engine interacting directly with an on-device Ollama instance.

Executes text-only anatomical tutoring using local model weights without telemetry,
third-party API tokens, or external network egress.
"""

from __future__ import annotations

import json
import math
import re
from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Literal

import httpx

from hoomaan_engine.prompts import (
    LOCAL_TRIAGE_PROMPT,
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

# Loopback endpoint for local Ollama daemon
OLLAMA_URL = "http://127.0.0.1:11434"

# Default target context token capacity
NUM_CTX = 16_384

# Maximum proportion of context reserved for system instructions and history
PROMPT_SHARE = 0.6

# Heuristic conversion factor for token estimation
CHARS_PER_TOKEN = 2.5

# Threshold ratio indicating server-side prompt truncation
TRUNCATION_CHARS_PER_TOKEN = 6.0

FALLBACK_LANGUAGE = "English"

SUPPORTED_LANGUAGES = frozenset(
    {
        "Arabic", "Bulgarian", "Chinese", "Croatian", "Czech", "Danish", "Dutch",
        "English", "Finnish", "French", "German", "Greek", "Hebrew", "Hindi",
        "Hungarian", "Indonesian", "Italian", "Japanese", "Korean", "Macedonian",
        "Malay", "Mandarin", "Norwegian", "Persian", "Polish", "Portuguese",
        "Romanian", "Russian", "Serbian", "Slovak", "Slovenian", "Spanish",
        "Swedish", "Thai", "Turkish", "Ukrainian", "Vietnamese",
    }
)

_MIN_LANGUAGE_BYTES = 12
_DETECTION_TURNS = 3
_DETECTION_CHARS = 400

_DETECT_PROMPT = (
    "Name the language this text is written in. Reply with only the English name "
    "of the language, one word. Bulgarian, Russian, Ukrainian and Serbian all use "
    "Cyrillic: tell them apart carefully. Bulgarian uses words like какво, къде, "
    "коя, колко, защо and definite endings such as -та, -то, -ът, -ят. Anatomical "
    "Latin terms alone count as Latin.\n\nText: "
)

_TRIAGE_CHARS = 600
NOTICE_MODEL = "HOOMAAN notice"

MessageKind = Literal["study", "person", "crisis"]

_CONNECT_TIMEOUT_SEC = 3.0
_READ_TIMEOUT_SEC = 180.0


class LocalModelError(Exception):
    """General error encountered while communicating with local Ollama runtime."""


class TruncatedPromptError(LocalModelError):
    """Raised when Ollama truncates earlier context window containing safety constraints."""


class RemoteModelError(LocalModelError):
    """Raised when a specified model tag maps to a cloud/remote proxy rather than local weights."""


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
    """Approximate token consumption from raw character length."""
    return math.ceil(len(text) / CHARS_PER_TOKEN)


def fit_history(
    system: str,
    history: list[TranscriptTurn],
    query: str,
    budget: int = int(NUM_CTX * PROMPT_SHARE),
) -> list[TranscriptTurn]:
    """Trim oldest conversational history turns until prompt satisfies the token budget."""
    baseline_cost = estimate_tokens(system) + estimate_tokens(query)
    retained: list[TranscriptTurn] = []
    accumulated = baseline_cost

    for turn in reversed(history):
        cost = estimate_tokens(turn.content)
        if accumulated + cost > budget:
            break
        retained.append(turn)
        accumulated += cost

    retained.reverse()
    while retained and retained[0].role == "assistant":
        retained.pop(0)

    return retained


def _create_client(transport: httpx.AsyncBaseTransport | None = None) -> httpx.AsyncClient:
    return httpx.AsyncClient(
        base_url=OLLAMA_URL,
        timeout=httpx.Timeout(_READ_TIMEOUT_SEC, connect=_CONNECT_TIMEOUT_SEC),
        transport=transport,
    )


_OLLAMA_OFFLINE_MSG = (
    "Ollama is not running on this computer. Start Ollama, then try again — "
    "nothing here is sent anywhere else."
)


def _check_cloud_suffix(tag_name: str) -> bool:
    segment = tag_name.rpartition(":")[2].lower()
    return segment == "cloud" or segment.endswith("-cloud")


def _is_forwarded_server(manifest_data: dict[str, object]) -> bool:
    return bool(manifest_data.get("remote_host") or manifest_data.get("remote_model"))


def _build_remote_rejection(tag_name: str) -> RemoteModelError:
    return RemoteModelError(
        f"{tag_name} runs on a server, not on this computer, so it is not available here. "
        "Pick a model you have downloaded."
    )


async def _inspect_capabilities(client: httpx.AsyncClient, model_tag: str) -> list[str]:
    if _check_cloud_suffix(model_tag):
        raise _build_remote_rejection(model_tag)

    resp = await client.post("/api/show", json={"model": model_tag})
    if resp.status_code == 404:
        raise LocalModelError(
            f"Ollama has no model named {model_tag!r}. Pull it first, or pick another."
        )
    resp.raise_for_status()

    meta = resp.json()
    if _is_forwarded_server(meta):
        raise _build_remote_rejection(model_tag)

    caps = meta.get("capabilities")
    return [str(c) for c in caps] if isinstance(caps, list) else []


async def list_local_models(
    transport: httpx.AsyncBaseTransport | None = None,
) -> tuple[bool, list[LocalModelInfo]]:
    """Scan local Ollama installation for available chat-capable models."""
    async with _create_client(transport) as client:
        try:
            resp = await client.get("/api/tags")
        except httpx.TransportError:
            return False, []
        resp.raise_for_status()

        available_list: list[LocalModelInfo] = []
        for entry in resp.json().get("models", []):
            name_val = entry.get("name") or entry.get("model")
            if not isinstance(name_val, str) or not name_val:
                continue
            if _check_cloud_suffix(name_val) or _is_forwarded_server(entry):
                continue
            try:
                caps = await _inspect_capabilities(client, name_val)
            except RemoteModelError:
                continue
            if caps and "completion" not in caps:
                continue

            spec = entry.get("details") or {}
            size_val = entry.get("size")
            available_list.append(
                LocalModelInfo(
                    name=name_val,
                    parameter_size=spec.get("parameter_size") or None,
                    size_bytes=size_val if isinstance(size_val, int) and size_val >= 0 else None,
                )
            )

        available_list.sort(key=lambda m: m.name)
        return True, available_list


def _compose_chat_payload(
    model_name: str,
    capabilities: list[str],
    messages: list[dict[str, str]],
    **extra_opts: float,
) -> dict[str, object]:
    payload: dict[str, object] = {
        "model": model_name,
        "messages": messages,
        "options": {"num_ctx": NUM_CTX, **extra_opts},
    }
    if "thinking" in capabilities:
        payload["think"] = False
    return payload


async def _execute_single_prompt(
    client: httpx.AsyncClient,
    model_name: str,
    capabilities: list[str],
    instruction: str,
    **extra_opts: float,
) -> str:
    options = {"num_predict": 12, "temperature": 0, **extra_opts}
    payload = _compose_chat_payload(
        model_name, capabilities, [{"role": "user", "content": instruction}], **options
    )
    res = await client.post("/api/chat", json={**payload, "stream": False})
    res.raise_for_status()
    return str((res.json().get("message") or {}).get("content") or "")


def _extract_language_token(raw_reply: str) -> str | None:
    tokens = [w.capitalize() for w in re.findall(r"[^\W\d_]+", raw_reply)]
    for word in tokens:
        if word in SUPPORTED_LANGUAGES:
            return word
    return tokens[0] if len(tokens) == 1 and tokens[0] != "Latin" else None


async def detect_answer_language(
    *,
    model: str,
    history: list[TranscriptTurn],
    query: str,
    transport: httpx.AsyncBaseTransport | None = None,
) -> AnswerLanguage:
    """Identify the target language of the prompt or fallback to English."""
    candidates = [query, *(t.content for t in reversed(history) if t.role == "user")]
    async with _create_client(transport) as client:
        try:
            caps = await _inspect_capabilities(client, model)
            for snippet in candidates[:_DETECTION_TURNS]:
                chars = "".join(ch for ch in snippet if ch.isalpha())
                if len(chars.encode("utf-8")) < _MIN_LANGUAGE_BYTES:
                    continue
                detect_query = _DETECT_PROMPT + snippet[:_DETECTION_CHARS]
                detected = _extract_language_token(
                    await _execute_single_prompt(client, model, caps, detect_query)
                )
                if detected in SUPPORTED_LANGUAGES:
                    return AnswerLanguage(detected)
                if detected is not None:
                    return AnswerLanguage(FALLBACK_LANGUAGE, unsupported=True)
        except (httpx.HTTPError, LocalModelError, ValueError):
            pass
    return AnswerLanguage(FALLBACK_LANGUAGE)


async def classify_message(
    *,
    model: str,
    history: list[TranscriptTurn],
    query: str,
    transport: httpx.AsyncBaseTransport | None = None,
) -> MessageKind:
    """Classify the user intent into study, real person consultation, or medical crisis."""
    prior = next((t.content for t in reversed(history) if t.role == "user"), None)
    text_sample = query[:_TRIAGE_CHARS]
    if prior:
        text_sample = f"Earlier message: {prior[:_TRIAGE_CHARS]}\nLatest message, to sort: {text_sample}"

    async with _create_client(transport) as client:
        try:
            caps = await _inspect_capabilities(client, model)
            classification = await _execute_single_prompt(
                client, model, caps, LOCAL_TRIAGE_PROMPT + text_sample
            )
        except (httpx.HTTPError, LocalModelError, ValueError):
            return "study"

    matches = re.findall(r"CRISIS|PERSON|STUDY", classification.upper())
    if not matches:
        return "person"
    if matches[0] == "CRISIS":
        return "crisis"
    if matches[0] == "PERSON":
        return "person"
    return "study"


async def _resolve_notice(
    *,
    model: str,
    kind: Literal["person", "crisis"],
    language: str,
    transport: httpx.AsyncBaseTransport | None = None,
) -> str:
    predefined = local_notice(kind, language)
    if predefined is not None:
        return predefined

    base_english = local_notice(kind, FALLBACK_LANGUAGE) or ""
    translate_req = (
        f"Translate this notice into {language}. Reply with the translation only.\n\n{base_english}"
    )
    async with _create_client(transport) as client:
        try:
            caps = await _inspect_capabilities(client, model)
            output = await _execute_single_prompt(
                client, model, caps, translate_req, num_predict=600
            )
        except (httpx.HTTPError, LocalModelError, ValueError):
            return base_english

    cleaned = output.strip()
    return f"{cleaned}\n\n{base_english}" if cleaned else base_english


async def answer_local_turn(
    *,
    model: str,
    history: list[TranscriptTurn],
    query: str,
    profile: UserProfile,
    selection: list[OrganContext],
    gender: GenderModel = "male",
    transport: httpx.AsyncBaseTransport | None = None,
) -> AsyncIterator[LocalText | LocalDone]:
    """Execute a single local conversational interaction."""
    chosen_lang = await detect_answer_language(
        model=model, history=history, query=query, transport=transport
    )
    intent = await classify_message(
        model=model, history=history, query=query, transport=transport
    )
    if intent != "study":
        warning_text = await _resolve_notice(
            model=model, kind=intent, language=chosen_lang.name, transport=transport
        )
        yield LocalText(warning_text)
        yield LocalDone(usage=None, model=NOTICE_MODEL)
        return

    instructions = build_local_instructions(
        profile=profile,
        selection=selection,
        answer_language=chosen_lang.name,
        unsupported_language=chosen_lang.unsupported,
        gender=gender,
    )
    formatted_query = build_local_question(query, answer_language=chosen_lang.name)
    async for item in stream_local_chat(
        model=model,
        system=instructions,
        history=history,
        query=formatted_query,
        transport=transport,
    ):
        yield item


async def stream_local_chat(
    *,
    model: str,
    system: str,
    history: list[TranscriptTurn],
    query: str,
    transport: httpx.AsyncBaseTransport | None = None,
) -> AsyncIterator[LocalText | LocalDone]:
    """Stream token deltas from local Ollama endpoint."""
    fitted = fit_history(system, history, query)
    dialogue: list[dict[str, str]] = [{"role": "system", "content": system}]
    dialogue.extend([{"role": t.role, "content": t.content} for t in fitted])
    dialogue.append({"role": "user", "content": query})

    total_prompt_chars = sum(len(msg["content"]) for msg in dialogue)

    async with _create_client(transport) as client:
        try:
            caps = await _inspect_capabilities(client, model)
        except httpx.TransportError as exc:
            raise LocalModelError(_OLLAMA_OFFLINE_MSG) from exc

        req_body = {**_compose_chat_payload(model, caps, dialogue), "stream": True}
        eval_in: int | None = None
        eval_out: int | None = None

        try:
            async with client.stream("POST", "/api/chat", json=req_body) as resp:
                if resp.status_code >= 400:
                    raw_err = (await resp.aread()).decode("utf-8", "replace")
                    raise LocalModelError(_parse_server_fault(raw_err, resp.status_code))

                async for raw_line in resp.aiter_lines():
                    if not raw_line.strip():
                        continue
                    packet = json.loads(raw_line)
                    if packet.get("error"):
                        raise LocalModelError(str(packet["error"]))

                    delta = (packet.get("message") or {}).get("content") or ""
                    if delta:
                        yield LocalText(delta)

                    if packet.get("done"):
                        eval_in = packet.get("prompt_eval_count")
                        eval_out = packet.get("eval_count")
        except httpx.TransportError as exc:
            raise LocalModelError(_OLLAMA_OFFLINE_MSG) from exc

    if isinstance(eval_in, int) and eval_in < total_prompt_chars / TRUNCATION_CHARS_PER_TOKEN:
        raise TruncatedPromptError(
            "Ollama dropped the start of the conversation, which is where the safety "
            "rules are, so this answer was not shown. Start a new conversation."
        )

    usage_summary = (
        TokenUsage(input_tokens=eval_in, output_tokens=eval_out)
        if isinstance(eval_in, int) and isinstance(eval_out, int)
        else None
    )
    yield LocalDone(usage=usage_summary, model=f"ollama:{model}")


def _parse_server_fault(payload_str: str, code: int) -> str:
    try:
        err_msg = json.loads(payload_str).get("error")
    except (ValueError, AttributeError):
        err_msg = None
    return str(err_msg) if err_msg else f"Ollama refused the request (HTTP {code})."
