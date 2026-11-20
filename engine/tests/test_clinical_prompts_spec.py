"""Clean-Room Spec Verification for Hoomaan AI Clinical Prompts Engine.

Derived strictly from specs/ai-engine-clinical-prompts.md.
"""

from __future__ import annotations

import pytest

from hoomaan_engine.prompts import (
    HOOMAAN_SAFETY_DIRECTIVE,
    VIEWPORT_ORCHESTRATION_DIRECTIVE,
    AUDIENCE_CALIBRATION_PROFILES,
    VIRTUAL_PATIENT_SIMULATION_DIRECTIVE,
    build_system_prompt,
)


def test_scenario_1_bilingual_student_tutor_composition() -> None:
    """Verifies layered prompt composition for medical student audience in Persian."""
    prompt = build_system_prompt(
        audience_profile="student",
        session_mode="tutor",
        preferred_language="fa",
    )

    # Core non-negotiable safety guardrails
    assert "HOOMAAN" in prompt
    assert "قوانین ایمنی و اخلاق پزشکی" in prompt
    assert "Medical Device" in prompt

    # Viewport 3D driving instructions
    assert "نمایشگر سه‌بعدی" in prompt

    # Academic student calibration
    assert "دانشجوی علوم پزشکی" in prompt
    assert "خون‌رسانی" in prompt
    assert "عصب‌دهی" in prompt

    # Persian language directive
    assert "زبان فارسی روان" in prompt


def test_scenario_2_safety_guardrails_prevent_medical_prescriptions() -> None:
    """Verifies that regulatory instructions explicitly forbid dosages and enforce 115 referral."""
    safety_text = HOOMAAN_SAFETY_DIRECTIVE

    assert "اورژانس (۱۱۵)" in safety_text
    assert "تجویز دارو" in safety_text
    assert "دوز عددی" in safety_text
    assert "تشخیص اختصاصی، تریاژ بالینی، یا دستور درمانی" in safety_text


def test_scenario_3_virtual_patient_simulation_mode() -> None:
    """Verifies that case mode injects virtual patient simulation directive."""
    prompt = build_system_prompt(
        audience_profile="student",
        session_mode="case",
        preferred_language="fa",
    )

    assert "شبیه‌ساز بالینی بیمار مجازی" in prompt
    assert "در کالبد شخصیت خود بمانید" in prompt
    assert "علائم حیاتی" in prompt


def test_edge_case_layperson_and_clinician_calibration() -> None:
    """Verifies distinct audience depth calibration for laypersons vs clinicians."""
    layperson_prompt = build_system_prompt(audience_profile="layperson")
    assert "زبان ساده، ملموس" in layperson_prompt

    clinician_prompt = build_system_prompt(audience_profile="clinician")
    assert "پزشک، رزیدنت یا متخصص سلامت" in clinician_prompt
    assert "مبتنی بر شواهد روز" in clinician_prompt


def test_edge_case_english_language_directive() -> None:
    """Verifies standardized Latin/English anatomical nomenclature directive."""
    english_prompt = build_system_prompt(preferred_language="en")
    assert "Terminologia Anatomica" in english_prompt
