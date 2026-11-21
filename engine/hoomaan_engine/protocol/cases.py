"""Clinical simulation cases, synthetic patients, and assessment models."""

from __future__ import annotations

from typing import Literal

from pydantic import Field

from hoomaan_engine.protocol.types import Strict


class CaseComplaint(Strict):
    """User-annotated clinical symptom localized on a structure."""

    organ_id: str = Field(min_length=1)
    label: str = Field(min_length=1)
    symptom: str = Field(min_length=1, max_length=200)
    severity: int | None = Field(default=None, ge=0, le=10)


class CaseVisitSummary(Strict):
    """Evaluation record summary of a previous patient visit."""

    visit_no: int = Field(ge=1)
    score: int | None = Field(default=None, ge=0, le=100)
    verdict: str | None = Field(default=None, max_length=4000)


class CaseRecordUpdate(Strict):
    """Interval clinical update added to the longitudinal patient record."""

    visit_no: int = Field(ge=1)
    body: str = Field(min_length=1, max_length=20_000)


class VirtualPatient(Strict):
    """Synthetic clinical patient profile for simulated diagnostics."""

    title: str = Field(min_length=1, max_length=200)
    sex: Literal["male", "female"]
    age_years: int | None = Field(default=None, ge=0, le=130)
    height_cm: int | None = Field(default=None, ge=30, le=260)
    weight_kg: float | None = Field(default=None, gt=0, le=400)
    findings: str = Field(default="", max_length=20_000)
    record_updates: list[CaseRecordUpdate] = Field(default_factory=list, max_length=200)
    ground_truth: str = Field(default="", max_length=20_000)
    visit_no: int = Field(ge=1)
    complaints: list[CaseComplaint] = Field(default_factory=list, max_length=200)
    earlier_visits: list[CaseVisitSummary] = Field(default_factory=list, max_length=20)
