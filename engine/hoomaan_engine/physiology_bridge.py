"""
HOOMAAN Unified Physiology, Electrophysiology & Hemodynamics Bridge

Clean-room Python simulation layer aligned with:
- Kitware Pulse Physiology Engine (systemic hemodynamics, Windkessel MAP, SpO2)
- OpenCOR / CellML (SA node & ventricular myocyte action potential phases 0-4)
- SimVascular (0D/1D pulsatile arterial velocity & Reynolds number estimation)
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Literal

ClinicalState = Literal[
    "normal",
    "tachycardia",
    "bradycardia",
    "hypovolemic_shock",
    "cardiogenic_shock",
    "hypoxia",
]

VesselRegion = Literal["aorta", "carotid", "femoral", "coronary", "pulmonary"]


@dataclass(frozen=True)
class PhysiologySnapshot:
    state: ClinicalState
    heart_rate_bpm: float
    stroke_volume_ml: float
    cardiac_output_l_min: float
    systolic_bp_mmhg: float
    diastolic_bp_mmhg: float
    map_mmhg: float
    spo2_percent: float
    respiratory_rate_bpm: float


def evaluate_patient_physiology(state: ClinicalState = "normal") -> PhysiologySnapshot:
    """Evaluates systemic cardiovascular & respiratory vitals for a clinical state."""
    profiles: dict[ClinicalState, tuple[float, float, float, float, float, float]] = {
        # (HR, SV_mL, SBP, DBP, SpO2, RR)
        "normal": (72.0, 70.0, 118.0, 76.0, 98.5, 14.0),
        "tachycardia": (128.0, 58.0, 126.0, 84.0, 97.5, 20.0),
        "bradycardia": (44.0, 82.0, 106.0, 66.0, 97.0, 12.0),
        "hypovolemic_shock": (132.0, 38.0, 84.0, 56.0, 94.0, 26.0),
        "cardiogenic_shock": (115.0, 32.0, 78.0, 54.0, 89.0, 28.0),
        "hypoxia": (108.0, 68.0, 134.0, 86.0, 82.0, 28.0),
    }
    hr, sv, sbp, dbp, spo2, rr = profiles[state]
    co = round((hr * sv) / 1000.0, 2)
    map_val = round(dbp + (sbp - dbp) / 3.0, 1)
    return PhysiologySnapshot(
        state=state,
        heart_rate_bpm=hr,
        stroke_volume_ml=sv,
        cardiac_output_l_min=co,
        systolic_bp_mmhg=sbp,
        diastolic_bp_mmhg=dbp,
        map_mmhg=map_val,
        spo2_percent=spo2,
        respiratory_rate_bpm=rr,
    )


def evaluate_cardiac_action_potential(
    normalized_phase: float,
    cell_type: Literal["ventricular", "sa_node"] = "ventricular",
) -> float:
    """
    Returns membrane potential in mV across normalized cardiac cycle phase [0.0, 1.0].
    Modeled after CellML / Guyton & Hall ventricular myocyte & SA nodal dynamics.
    """
    phase = normalized_phase % 1.0

    if cell_type == "sa_node":
        # Pacemaker potential: -60 mV -> -40 mV threshold -> +10 mV peak -> -60 mV
        if phase < 0.08:
            return round(-60.0 + (phase / 0.08) * 70.0, 2)
        if phase < 0.25:
            return round(10.0 - ((phase - 0.08) / 0.17) * 70.0, 2)
        return round(-60.0 + ((phase - 0.25) / 0.75) * 20.0, 2)

    # Ventricular myocyte: resting -90 mV, phase 0 upstroke at 0.14, plateau to 0.36, repolarization to 0.48
    if phase < 0.14:
        return -90.0
    if phase < 0.16:
        # Phase 0 rapid Na+ depolarization (-90 -> +25 mV)
        return round(-90.0 + ((phase - 0.14) / 0.02) * 115.0, 2)
    if phase < 0.19:
        # Phase 1 early repolarization notch (+25 -> +5 mV)
        return round(25.0 - ((phase - 0.16) / 0.03) * 20.0, 2)
    if phase < 0.36:
        # Phase 2 Ca2+ plateau (+5 -> -5 mV)
        return round(5.0 - ((phase - 0.19) / 0.17) * 10.0, 2)
    if phase < 0.48:
        # Phase 3 rapid K+ repolarization (-5 -> -90 mV)
        t = (phase - 0.36) / 0.12
        return round(-5.0 - math.sin(t * math.pi * 0.5) * 85.0, 2)
    return -90.0


def evaluate_vessel_hemodynamics(
    vessel: VesselRegion,
    normalized_phase: float,
    blood_density_kg_m3: float = 1060.0,
    viscosity_pa_s: float = 0.0035,
) -> dict[str, float]:
    """
    SimVascular-aligned 0D/1D pulsatile arterial velocity (cm/s) & Reynolds number.
    """
    phase = normalized_phase % 1.0
    # Characteristic diameter (m) and peak systolic velocity (cm/s)
    specs: dict[VesselRegion, tuple[float, float, float]] = {
        # (diameter_m, peak_vel_cm_s, diastolic_vel_cm_s)
        "aorta": (0.025, 110.0, 12.0),
        "carotid": (0.0065, 85.0, 24.0),
        "femoral": (0.008, 75.0, 5.0),
        "coronary": (0.0035, 45.0, 18.0),
        "pulmonary": (0.022, 75.0, 10.0),
    }
    diameter_m, v_peak, v_dias = specs[vessel]

    # Coronary flow peaks predominantly during diastole (phase 0.45..0.85)
    if vessel == "coronary":
        pulse = math.exp(-((phase - 0.58) ** 2) / (2 * 0.12**2))
    else:
        # Systolic ejection pulse peaks around phase 0.24
        pulse = math.exp(-((phase - 0.24) ** 2) / (2 * 0.07**2))

    velocity_cm_s = round(v_dias + (v_peak - v_dias) * pulse, 2)
    velocity_m_s = velocity_cm_s / 100.0
    reynolds = round((blood_density_kg_m3 * velocity_m_s * diameter_m) / viscosity_pa_s, 1)

    return {
        "velocity_cm_s": velocity_cm_s,
        "reynolds_number": reynolds,
        "diameter_mm": round(diameter_m * 1000.0, 1),
    }
