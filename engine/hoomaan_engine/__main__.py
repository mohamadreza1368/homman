"""Main entrypoint loop for the HOOMAAN AI engine sidecar.

Streams incoming NDJSON requests over stdin, spawns asynchronous handler tasks,
emits streaming response frames over stdout, and supervises graceful shutdown.
"""

from __future__ import annotations

import asyncio
import sys

from pydantic import TypeAdapter, ValidationError

from hoomaan_engine.protocol import (
    AgentRequest,
    CancelRequest,
    EngineRequest,
    ErrorEvent,
    ListModelsRequest,
    LocalChatRequest,
    LocalModelsRequest,
    ReadyEvent,
    ShutdownRequest,
)
from hoomaan_engine.transport import StdinReader, Transport, parse_json_line

_request_adapter: TypeAdapter[EngineRequest] = TypeAdapter(EngineRequest)

SpawnedRequest = AgentRequest | ListModelsRequest | LocalChatRequest | LocalModelsRequest

_DRAIN_GRACE_SECONDS = 10.0


class Engine:
    def __init__(self, transport: Transport) -> None:
        self._transport = transport
        self._tasks: dict[str, asyncio.Task[None]] = {}
        self._shutdown = asyncio.Event()
        self._reader = StdinReader()

    async def serve(self) -> None:
        self._transport.emit(ReadyEvent.current())

        async for line in self._reader.lines():
            self._handle_line(line)
            if self._shutdown.is_set():
                self._reader.stop()
                break

        await self._drain()

    def _handle_line(self, line: str) -> None:
        payload = parse_json_line(line)
        if payload is None:
            self._transport.emit(
                ErrorEvent(
                    request_id=None,
                    code="invalid_request",
                    message="Malformed JSON frame on stdin.",
                )
            )
            return

        try:
            parsed_request = _request_adapter.validate_python(payload)
        except ValidationError as exc:
            raw_id = payload.get("request_id")
            self._transport.emit(
                ErrorEvent(
                    request_id=raw_id if isinstance(raw_id, str) else None,
                    code="invalid_request",
                    message=_summarise_validation_error(exc),
                )
            )
            return

        match parsed_request:
            case ShutdownRequest():
                self._shutdown.set()
            case CancelRequest():
                self._cancel(parsed_request.request_id)
            case AgentRequest() | ListModelsRequest() | LocalChatRequest() | LocalModelsRequest():
                self._spawn(parsed_request)

    def _spawn(self, request: SpawnedRequest) -> None:
        rid = request.request_id
        if rid in self._tasks:
            self._transport.emit(
                ErrorEvent(
                    request_id=rid,
                    code="invalid_request",
                    message=f"request_id {rid!r} is already in flight.",
                )
            )
            return

        task = asyncio.create_task(self._run(request), name=f"request:{rid}")
        self._tasks[rid] = task
        task.add_done_callback(lambda _t, key=rid: self._tasks.pop(key, None))

    def _cancel(self, request_id: str) -> None:
        target = self._tasks.get(request_id)
        if target is not None:
            target.cancel()

    async def _run(self, request: SpawnedRequest) -> None:
        try:
            from hoomaan_engine.handlers import (
                handle_agent_request,
                handle_list_models,
                handle_local_chat,
                handle_local_models,
            )

            if isinstance(request, AgentRequest):
                await handle_agent_request(request, self._transport)
            elif isinstance(request, LocalChatRequest):
                await handle_local_chat(request, self._transport)
            elif isinstance(request, LocalModelsRequest):
                await handle_local_models(request, self._transport)
            else:
                await handle_list_models(request, self._transport)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            self._transport.log(f"unhandled error in {request.request_id}: {exc!r}")
            self._transport.emit(
                ErrorEvent(
                    request_id=request.request_id,
                    code="internal_error",
                    message=str(exc),
                )
            )

    async def _drain(self) -> None:
        if not self._tasks:
            return

        in_flight = list(self._tasks.values())
        _done, active = await asyncio.wait(in_flight, timeout=_DRAIN_GRACE_SECONDS)

        for item in active:
            item.cancel()
        if active:
            await asyncio.gather(*active, return_exceptions=True)


def _summarise_validation_error(exc: ValidationError) -> str:
    summary_parts = []
    for error_detail in exc.errors()[:5]:
        loc_str = ".".join(str(elem) for elem in error_detail["loc"]) or "<root>"
        summary_parts.append(f"{loc_str}: {error_detail['msg']}")
    return "; ".join(summary_parts)


def _force_utf8_stdio() -> None:
    for std_stream in (sys.stdin, sys.stdout, sys.stderr):
        reconfig = getattr(std_stream, "reconfigure", None)
        if reconfig is not None:
            reconfig(encoding="utf-8", errors="strict")


def main() -> int:
    _force_utf8_stdio()
    transport = Transport()
    try:
        asyncio.run(Engine(transport).serve())
    except KeyboardInterrupt:
        return 0
    except Exception as err:
        transport.emit(
            ErrorEvent(request_id=None, code="internal_error", message=str(err))
        )
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
