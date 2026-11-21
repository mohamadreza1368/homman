"""Clean-Room Spec Verification for HOOMAAN On-Device Local Chat & Triage.

Derived strictly from specs/clinical-chat-safety.md and specs/ai-engine-clinical-prompts.md.
"""

from __future__ import annotations

import httpx
import pytest

from hoomaan_engine.local_chat import (
    NOTICE_MODEL,
    NUM_CTX,
    LocalDone,
    LocalModelError,
    LocalText,
    answer_local_turn,
    classify_message,
    detect_answer_language,
    estimate_tokens,
    fit_history,
    list_local_models,
)
from hoomaan_engine.protocol import (
    LocalChatRequest,
    LocalModelsEvent,
    LocalModelsRequest,
    TextDeltaEvent,
    TranscriptTurn,
)


def _turn(role: str, content: str) -> TranscriptTurn:
    return TranscriptTurn(role=role, content=content)  # type: ignore[arg-type]


# ---------------------------------------------------------------------------
# 1. Context History Budgeting
# ---------------------------------------------------------------------------


def test_fits_everything_when_budget_is_sufficient() -> None:
    history = [_turn("user", "سلام"), _turn("assistant", "درود، چطور می‌توانم در یادگیری آناتومی کمک کنم؟")]
    fitted = fit_history("system prompt", history, "سوال بعدی", budget=1000)
    assert fitted == history


def test_drops_oldest_turns_when_context_budget_exceeded() -> None:
    history = [
        _turn("user", "A" * 600),
        _turn("assistant", "B" * 600),
        _turn("user", "C" * 100),
    ]
    # Small budget only permits the last turn
    fitted = fit_history("sys", history, "next query", budget=200)
    assert len(fitted) == 1
    assert fitted[0].content == "C" * 100


# ---------------------------------------------------------------------------
# 2. Language Detection
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_detects_persian_language_from_script() -> None:
    lang = await detect_answer_language("بطن راست و دهلیز چپ قلب را توضیح بده", [])
    assert lang.name == "Persian"


@pytest.mark.asyncio
async def test_detects_english_language_fallback() -> None:
    lang = await detect_answer_language("Explain the aortic valve structure", [])
    assert lang.name == "English"


# ---------------------------------------------------------------------------
# 3. Clinical Safety Triage (Zero-LLM Interception)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_crisis_input_intercepted_without_llm_generation() -> None:
    """Verifies that crisis symptoms trigger instant safety notice without model generation."""
    handler = httpx.MockTransport(lambda req: httpx.Response(200, json={"message": {"content": "CRISIS"}}))

    events = [
        ev
        async for ev in answer_local_turn(
            model="ollama:gemma3:4b",
            query="درد شدید قفسه سینه دارم و عرق سرد کردم",
            history=[],
            profile="student",
            selection=[],
            preferred_language="Persian",
            transport=handler,
        )
    ]

    assert len(events) == 2
    text_ev, done_ev = events[0], events[1]

    assert isinstance(text_ev, LocalText)
    assert "۱۱۵" in text_ev.text or "اورژانس" in text_ev.text

    assert isinstance(done_ev, LocalDone)
    assert done_ev.model == NOTICE_MODEL
    assert done_ev.usage is None


@pytest.mark.asyncio
async def test_personal_symptom_inquiry_blocked_with_disclaimer() -> None:
    """Verifies that diagnostic questions for a real person trigger educational disclaimer."""
    handler = httpx.MockTransport(lambda req: httpx.Response(200, json={"message": {"content": "PERSON"}}))

    events = [
        ev
        async for ev in answer_local_turn(
            model="ollama:gemma3:4b",
            query="من چه دارویی برای تپش قلب باید مصرف کنم؟",
            history=[],
            profile="layperson",
            selection=[],
            preferred_language="Persian",
            transport=handler,
        )
    ]

    assert len(events) == 2
    assert "آموزشی" in events[0].text
    assert events[1].model == NOTICE_MODEL


@pytest.mark.asyncio
async def test_educational_query_streams_model_response() -> None:
    """Verifies that legitimate anatomical queries stream generated text from model."""
    def fake_ollama(req: httpx.Request) -> httpx.Response:
        url_path = req.url.path
        if "chat" in url_path:
            body = req.read().decode()
            if "LOCAL_TRIAGE" in body or "Classify" in body:
                return httpx.Response(200, json={"message": {"content": "STUDY"}})
            # Streaming chat response
            lines = [
                '{"message": {"content": "بطن چپ "}, "done": false}\n',
                '{"message": {"content": "خون روشن را پمپ می‌کند."}, "done": true, "prompt_eval_count": 25, "eval_count": 18}\n',
            ]
            return httpx.Response(200, content="".join(lines).encode())
        if "show" in url_path:
            return httpx.Response(200, json={"capabilities": ["completion"]})
        return httpx.Response(200, json={})

    handler = httpx.MockTransport(fake_ollama)

    events = [
        ev
        async for ev in answer_local_turn(
            model="ollama:gemma3:4b",
            query="وظیفه بطن چپ چیست؟",
            history=[],
            profile="student",
            selection=[],
            preferred_language="Persian",
            transport=handler,
        )
    ]

    texts = [ev.text for ev in events if isinstance(ev, LocalText)]
    assert "".join(texts) == "بطن چپ خون روشن را پمپ می‌کند."

    dones = [ev for ev in events if isinstance(ev, LocalDone)]
    assert len(dones) == 1
    assert dones[0].usage is not None
    assert dones[0].usage.input_tokens == 25
    assert dones[0].usage.output_tokens == 18


# ---------------------------------------------------------------------------
# 4. Engine IPC Protocol Integration
# ---------------------------------------------------------------------------


class EventRecorder:
    def __init__(self) -> None:
        self.events: list[object] = []

    def emit(self, ev: object) -> None:
        self.events.append(ev)

    def log(self, _msg: str) -> None:
        pass


@pytest.mark.asyncio
async def test_local_chat_handler_dispatches_events(monkeypatch) -> None:
    from hoomaan_engine import handlers, local_chat

    async def mock_turn(**_kwargs):
        yield LocalText("پاسخ تشریحی.")
        yield LocalDone(usage=None, model="ollama:mock")

    monkeypatch.setattr(local_chat, "answer_local_turn", mock_turn)

    req = LocalChatRequest(
        request_id="req-123",
        query="آناتومی کلیه",
        history=[],
        profile="student",
        model="ollama:mock",
        gender_model="male",
        selection=[],
    )
    recorder = EventRecorder()
    await handlers.handle_local_chat(req, recorder)

    kinds = [type(e).__name__ for e in recorder.events]
    assert kinds == ["TextDeltaEvent", "DoneEvent"]
    assert isinstance(recorder.events[0], TextDeltaEvent)
    assert recorder.events[0].text == "پاسخ تشریحی."


@pytest.mark.asyncio
async def test_local_models_handler_dispatches_events(monkeypatch) -> None:
    from hoomaan_engine import handlers, local_chat

    async def mock_models():
        return True, []

    monkeypatch.setattr(local_chat, "list_local_models", mock_models)

    req = LocalModelsRequest(request_id="models-1")
    recorder = EventRecorder()
    await handlers.handle_local_models(req, recorder)

    assert isinstance(recorder.events[0], LocalModelsEvent)
    assert type(recorder.events[-1]).__name__ == "DoneEvent"
