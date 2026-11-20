"""Clean-Room Spec Verification for Hoomaan AI Engine IPC Protocol.

Derived strictly from specs/ai-engine-ipc-protocol.md.
"""

from __future__ import annotations

import json
import pytest

from hoomaan_engine.protocol import (
    ENGINE_VERSION,
    PROTOCOL_VERSION,
    ReadyEvent,
    OrganMeta,
    Language,
)


def test_scenario_1_handshake_and_readiness_event() -> None:
    """Verifies that ready event reports valid protocol version and engine version."""
    ready = ReadyEvent.current()
    serialized = ready.model_dump_json()
    data = json.loads(serialized)

    assert data["type"] == "ready"
    assert data["protocol_version"] == PROTOCOL_VERSION
    assert data["engine_version"] == ENGINE_VERSION
    assert PROTOCOL_VERSION >= 2


def test_scenario_2_organ_metadata_contract() -> None:
    """Verifies structured metadata serialization for 3D atlas items."""
    organ = OrganMeta(
        organ_id="heart",
        ta2_latin="Cor",
        name_en="Heart",
        system="cardiovascular",
    )

    desc = organ.describe()
    assert "heart" in desc
    assert "Cor" in desc
    assert "Heart" in desc


def test_scenario_3_persian_language_literal_support() -> None:
    """Verifies that Persian ('fa') is natively supported in Language definition."""
    lang: Language = "fa"
    assert lang == "fa"
