"""Inspection tool producing a normalized JSON export of the Hoomaan IPC schema.

Executed as `python -m hoomaan_engine.protocol_surface`.
Synchronized with `tests/protocol-contract.test.ts` to verify bidirectional parity
between TypeScript Zod definitions and Python Pydantic structures.
"""

from __future__ import annotations

import json
import sys
from typing import Any, get_args

from pydantic import BaseModel

from hoomaan_engine import protocol as p

# Fields synthesized or injected at the transport/OS level, omitted from parity checks
UNTRACKED_SYSTEM_FIELDS = frozenset({"api_key", "kind"})


def extract_model_schema(model_cls: type[BaseModel]) -> dict[str, str]:
    """Extract required vs optional properties from a Pydantic model."""
    descriptors: dict[str, str] = {}
    for prop_name, prop_meta in model_cls.model_fields.items():
        if prop_name in UNTRACKED_SYSTEM_FIELDS:
            continue
        descriptors[prop_name] = "required" if prop_meta.is_required() else "optional"
    return descriptors


def extract_discriminated_union(union_type: Any, tag_field: str) -> dict[str, dict[str, str]]:
    """Map union variants to their schema, keyed by discriminator value."""
    schema_map: dict[str, dict[str, str]] = {}
    underlying_union = get_args(union_type)[0]
    for variant in get_args(underlying_union):
        tag_val = variant.model_fields[tag_field].default
        fields = extract_model_schema(variant)
        fields[tag_field] = "required"
        schema_map[str(tag_val)] = fields
    return schema_map


def build_surface() -> dict[str, Any]:
    """Assemble complete enum, model, and union surface for contract validation."""
    return {
        "enums": {
            "Language": sorted(get_args(p.Language)),
            "UserProfile": sorted(get_args(p.UserProfile)),
            "GenderModel": sorted(get_args(p.GenderModel)),
            "AiProvider": sorted(get_args(p.AiProvider)),
            "SectionPlane": sorted(get_args(p.SectionPlane)),
            "ScannerPlane": sorted(get_args(p.ScannerPlane)),
            "HeartRhythmId": sorted(get_args(p.HeartRhythmId)),
            "SessionMode": sorted(get_args(p.SessionMode)),
            "AnatomicalSystem": sorted(get_args(p.AnatomicalSystem)),
            "EngineErrorCode": sorted(get_args(p.EngineErrorCode)),
        },
        "models": {
            "OrganMeta": extract_model_schema(p.OrganMeta),
            "OrganContext": extract_model_schema(p.OrganContext),
            "TokenUsage": extract_model_schema(p.TokenUsage),
            "TranscriptTurn": extract_model_schema(p.TranscriptTurn),
            "AgentRequest": extract_model_schema(p.AgentRequest),
            "VirtualPatient": extract_model_schema(p.VirtualPatient),
            "CaseComplaint": extract_model_schema(p.CaseComplaint),
            "CaseVisitSummary": extract_model_schema(p.CaseVisitSummary),
            "CaseRecordUpdate": extract_model_schema(p.CaseRecordUpdate),
            "ScannerContext": extract_model_schema(p.ScannerContext),
            "HeartContext": extract_model_schema(p.HeartContext),
            "BreathContext": extract_model_schema(p.BreathContext),
            "LocalChatRequest": extract_model_schema(p.LocalChatRequest),
            "LocalModelsRequest": extract_model_schema(p.LocalModelsRequest),
            "LocalModelInfo": extract_model_schema(p.LocalModelInfo),
        },
        "unions": {
            "SceneCommand": extract_discriminated_union(p.SceneCommand, "action"),
            "EngineEvent": extract_discriminated_union(p.EngineEvent, "type"),
        },
        "protocol_version": p.PROTOCOL_VERSION,
    }


def main() -> int:
    surface_data = build_surface()
    json.dump(surface_data, sys.stdout, indent=2, sort_keys=True)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
