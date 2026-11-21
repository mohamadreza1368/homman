"""Core types, literals, and configuration constants for Hoomaan IPC protocol."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict

PROTOCOL_VERSION: int = 2
ENGINE_VERSION: str = "0.1.0"

Language = Literal["auto", "fa", "en", "bg", "es"]
UserProfile = Literal["layperson", "student", "clinician"]
GenderModel = Literal["male", "female"]
AiProvider = Literal["anthropic", "openai", "google"]
SectionPlane = Literal["axial", "coronal", "sagittal"]
ScannerPlane = Literal["axial", "coronal"]

HeartRhythmId = Literal[
    "normal",
    "sinus_tachycardia",
    "sinus_bradycardia",
    "av_block_1",
    "mobitz_1",
    "mobitz_2",
    "av_block_3",
    "atrial_fibrillation",
    "atrial_flutter",
    "premature_ventricular",
    "ventricular_tachycardia",
    "ventricular_fibrillation",
    "asystole",
    "aortic_stenosis",
    "mitral_regurgitation",
    "aortic_regurgitation",
    "mitral_stenosis",
    "third_heart_sound",
    "fourth_heart_sound",
]

SessionMode = Literal["tutor", "case", "review"]

AnatomicalSystem = Literal[
    "cardiovascular",
    "respiratory",
    "renal",
    "digestive",
    "nervous",
    "endocrine",
    "lymphatic",
    "skeletal",
    "muscular",
    "articular",
    "reproductive",
    "integumentary",
    "regional",
]

EngineErrorCode = Literal[
    "missing_api_key",
    "invalid_api_key",
    "provider_error",
    "rate_limited",
    "service_unavailable",
    "guardrail_triggered",
    "invalid_request",
    "internal_error",
]


class Strict(BaseModel):
    """Base schema disallowing extraneous or untyped fields."""

    model_config = ConfigDict(extra="forbid")
