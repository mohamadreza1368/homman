import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { CaseFile } from "@/lib/studyDb";
import { useBreathStore } from "@/stores/breathStore";
import { useHeartStore } from "@/stores/heartStore";
import { useInterfaceLanguage } from "@/stores/interfaceLanguage";
import { ClinicalVitalsHUD, parseClinicalVitals } from "./ClinicalVitalsHUD";

const samplePatient: CaseFile = {
  id: "case-1",
  title: "Jane Doe",
  sex: "female",
  age_years: 45,
  height_cm: 168,
  weight_kg: 62,
  findings: "Patient presents with chest tightness. BP: 145/92 mmHg, HR: 110 bpm, SpO2: 94%, RR: 22, Temp: 38.2 C.",
  sealed_at: 1000,
  revealed_at: null,
  profile: "student",
  language: "en",
  created_at: 1000,
  updated_at: 1000,
  visit_count: 0,
};

describe("parseClinicalVitals", () => {
  it("extracts vitals accurately from medical text", () => {
    const vitals = parseClinicalVitals(samplePatient.findings);
    expect(vitals.bpSystolic).toBe(145);
    expect(vitals.bpDiastolic).toBe(92);
    expect(vitals.hr).toBe(110);
    expect(vitals.spo2).toBe(94);
    expect(vitals.rr).toBe(22);
    expect(vitals.temp).toBe(38.2);
  });

  it("handles Persian notations and default fallbacks", () => {
    const persianNotes = "بیمار با تنگی نفس، فشار خون: 130/85، ضربان: 84، اکسیژن: 97%، تنفس: 18، دما: 37.1";
    const vitals = parseClinicalVitals(persianNotes);
    expect(vitals.bpSystolic).toBe(130);
    expect(vitals.bpDiastolic).toBe(85);
    expect(vitals.hr).toBe(84);
    expect(vitals.spo2).toBe(97);
    expect(vitals.rr).toBe(18);
    expect(vitals.temp).toBe(37.1);

    const emptyVitals = parseClinicalVitals("");
    expect(emptyVitals.bpSystolic).toBe(120);
    expect(emptyVitals.bpDiastolic).toBe(80);
    expect(emptyVitals.hr).toBe(74);
    expect(emptyVitals.spo2).toBe(98);
  });
});

describe("ClinicalVitalsHUD component", () => {
  it("renders compact vitals strip", () => {
    render(<ClinicalVitalsHUD patient={samplePatient} compact />);
    expect(screen.getByTestId("clinical-vitals-hud-compact")).toBeDefined();
    expect(screen.getByText("110")).toBeDefined();
    expect(screen.getByText("145/92")).toBeDefined();
    expect(screen.getByText("94%")).toBeDefined();
  });

  it("renders full bedside monitor HUD and triggers simulation toggles", () => {
    const toggleHeartSpy = vi.spyOn(useHeartStore.getState(), "toggle");
    const toggleBreathSpy = vi.spyOn(useBreathStore.getState(), "toggle");

    render(<ClinicalVitalsHUD patient={samplePatient} compact={false} />);
    expect(screen.getByTestId("clinical-vitals-hud")).toBeDefined();
    expect(screen.getByText("Bedside Clinical Monitor")).toBeDefined();

    // Clicking HR button toggles heart simulation
    const hrBtn = screen.getByTitle("Toggle 3D heartbeat simulation");
    fireEvent.click(hrBtn);
    expect(toggleHeartSpy).toHaveBeenCalled();

    // Clicking RR button toggles breathing simulation
    const rrBtn = screen.getByTitle("Toggle 3D breathing simulation");
    fireEvent.click(rrBtn);
    expect(toggleBreathSpy).toHaveBeenCalled();
  });

  it("renders localized Persian labels when language is fa", () => {
    useInterfaceLanguage.setState({ language: "fa" });
    render(<ClinicalVitalsHUD patient={samplePatient} compact={false} />);
    expect(screen.getByText("مانیتور علائم حیاتی بیمار")).toBeDefined();
    expect(screen.getByText("فشار خون")).toBeDefined();
    expect(screen.getByText("تعداد تنفس")).toBeDefined();
    useInterfaceLanguage.setState({ language: "en" });
  });
});
