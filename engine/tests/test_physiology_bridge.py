import pytest
from hoomaan_engine.physiology_bridge import (
    evaluate_cardiac_action_potential,
    evaluate_patient_physiology,
    evaluate_vessel_hemodynamics,
)


def test_pulse_physiology_snapshots():
    normal = evaluate_patient_physiology("normal")
    assert normal.heart_rate_bpm == 72.0
    assert normal.cardiac_output_l_min == pytest.approx(5.04, rel=1e-2)
    assert normal.map_mmhg == pytest.approx(90.0, rel=1e-2)
    assert normal.spo2_percent > 97.0

    shock = evaluate_patient_physiology("hypovolemic_shock")
    assert shock.heart_rate_bpm > normal.heart_rate_bpm
    assert shock.map_mmhg < 70.0


def test_opencor_cardiac_action_potential_phases():
    # Resting ventricular potential
    assert evaluate_cardiac_action_potential(0.05, "ventricular") == -90.0
    # Phase 0 peak depolarization
    assert evaluate_cardiac_action_potential(0.16, "ventricular") > 0.0
    # Phase 2 plateau
    plateau = evaluate_cardiac_action_potential(0.25, "ventricular")
    assert -10.0 <= plateau <= 10.0
    # SA node pacemaker drift
    assert evaluate_cardiac_action_potential(0.04, "sa_node") > -40.0


def test_simvascular_vessel_hemodynamics():
    aorta_sys = evaluate_vessel_hemodynamics("aorta", 0.24)
    aorta_dias = evaluate_vessel_hemodynamics("aorta", 0.80)
    assert aorta_sys["velocity_cm_s"] > aorta_dias["velocity_cm_s"]
    assert aorta_sys["reynolds_number"] > 1000.0

    # Coronary perfusion peaks in diastole
    coronary_sys = evaluate_vessel_hemodynamics("coronary", 0.22)
    coronary_dias = evaluate_vessel_hemodynamics("coronary", 0.58)
    assert coronary_dias["velocity_cm_s"] > coronary_sys["velocity_cm_s"]
