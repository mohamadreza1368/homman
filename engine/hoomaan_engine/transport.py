"""Standard input/output NDJSON communication transport for HOOMAAN engine.

Maintains line-delimited JSON serialization across process boundaries via stdio.
Avoids local network socket exposure, guaranteeing that only the supervisor
Tauri parent process interacts with the Python sidecar.
"""

from __future__ import annotations

import asyncio
import json
import queue
import sys
import threading
from collections.abc import AsyncIterator
from typing import Any

from pydantic import BaseModel

# Sentinel token signaling end-of-stream when stdin terminates.
_STREAM_EOF = object()


class Transport:
    """Thread-safe line-delimited JSON emitter targeting standard output."""

    def __init__(self, output_stream: Any = None) -> None:
        self._target = output_stream if output_stream is not None else sys.stdout
        self._write_lock = threading.Lock()

    def emit(self, event: BaseModel) -> None:
        """Serializes and flushes a Pydantic model frame as a single line."""
        serialized = event.model_dump_json()
        with self._write_lock:
            self._target.write(serialized + "\n")
            self._target.flush()

    def log(self, message: str) -> None:
        """Emits diagnostic statements to stderr to protect stdout framing integrity."""
        print(message, file=sys.stderr, flush=True)


class StdinReader:
    """Asynchronous line reader streaming incoming stdin payloads through a worker thread."""

    def __init__(self) -> None:
        self._buffer: queue.Queue[Any] = queue.Queue()
        self._worker: threading.Thread | None = None

    def start(self) -> None:
        if self._worker is not None:
            return
        self._worker = threading.Thread(
            target=self._worker_loop, name="stdin-pump", daemon=True
        )
        self._worker.start()

    def _worker_loop(self) -> None:
        try:
            for raw_line in sys.stdin:
                self._buffer.put(raw_line)
        except Exception:
            pass
        finally:
            self._buffer.put(_STREAM_EOF)

    def stop(self) -> None:
        """Unblocks pending asynchronous queue reads during shutdown."""
        self._buffer.put(_STREAM_EOF)

    async def lines(self) -> AsyncIterator[str]:
        self.start()
        while True:
            item = await asyncio.to_thread(self._buffer.get)
            if item is _STREAM_EOF:
                return
            cleaned = item.strip()
            if cleaned:
                yield cleaned


def parse_json_line(raw: str) -> dict[str, Any] | None:
    """Parses a raw line, returning a dictionary if valid JSON object, otherwise None."""
    try:
        obj = json.loads(raw)
    except json.JSONDecodeError:
        return None
    return obj if isinstance(obj, dict) else None
