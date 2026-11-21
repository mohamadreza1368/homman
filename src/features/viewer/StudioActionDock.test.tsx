import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSceneStore } from "@/stores/sceneStore";
import { useInterfaceLanguage } from "@/stores/interfaceLanguage";
import { useHeartStore } from "@/stores/heartStore";
import { useBreathStore } from "@/stores/breathStore";
import { useScanStore } from "@/stores/scanStore";
import { usePhysiologyStore } from "@/stores/physiologyStore";
import { useNavigationStore } from "@/stores/navigationStore";
import { StudioActionDock } from "./StudioActionDock";

describe("StudioActionDock", () => {
  beforeEach(() => {
    useInterfaceLanguage.setState({ language: "en" });
    useHeartStore.setState({ enabled: false, sound: false, rhythm: "normal", toggle: vi.fn() });
    useBreathStore.setState({ enabled: false, toggle: vi.fn() });
    useScanStore.setState({ enabled: false, toggle: vi.fn() });
    usePhysiologyStore.setState({ active: false });
    useNavigationStore.setState({ leftPanelTab: "atlas", diseaseSelectedOnly: false });
    useSceneStore.setState({
      fitView: vi.fn(),
      orientView: vi.fn(),
      dollyView: vi.fn(),
      isolateSelection: vi.fn(),
      glassBody: vi.fn(),
      cycleExplode: vi.fn(),
      showAllSystems: vi.fn(),
      resetView: vi.fn(),
      setLightingPreset: vi.fn(),
      setBackground: vi.fn(),
      selectedOrganIds: [],
      isolatedOrganIds: null,
      systemOpacity: {},
      explode: 0,
      lightingPreset: "studio",
      background: "dark",
    });
  });

  it("renders with navigation tabs", () => {
    render(<StudioActionDock />);
    expect(screen.getByRole("navigation", { name: /studio dock/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Views" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Dissect" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Physio" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Studio" })).toBeTruthy();
  });

  it("switches to Dissect tab and activates glass dissection", () => {
    const glassBodySpy = vi.fn();
    useSceneStore.setState({ glassBody: glassBodySpy });

    render(<StudioActionDock />);
    const dissectTab = screen.getByRole("button", { name: "Dissect" });
    fireEvent.click(dissectTab);

    expect(glassBodySpy).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Glass" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "All" })).toBeTruthy();
  });

  it("switches to Physio tab and activates cardiac simulation", () => {
    const toggleHeartSpy = vi.fn();
    useHeartStore.setState({ enabled: false, toggle: toggleHeartSpy });

    render(<StudioActionDock />);
    const physioTab = screen.getByRole("button", { name: "Physio" });
    fireEvent.click(physioTab);

    expect(toggleHeartSpy).toHaveBeenCalled();
    expect(usePhysiologyStore.getState().active).toBe(true);
    expect(screen.getByRole("button", { name: "Heartbeat" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Breathing" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Scanner" })).toBeTruthy();
  });

  it("toggles physiology mode off on second click", () => {
    const toggleHeartSpy = vi.fn();
    const toggleBreathSpy = vi.fn();
    useHeartStore.setState({ enabled: true, toggle: toggleHeartSpy });
    useBreathStore.setState({ enabled: true, toggle: toggleBreathSpy });
    usePhysiologyStore.setState({ active: true });

    render(<StudioActionDock />);
    const physioTab = screen.getByRole("button", { name: "Physio" });
    fireEvent.click(physioTab);

    expect(usePhysiologyStore.getState().active).toBe(false);
    expect(toggleHeartSpy).toHaveBeenCalled();
    expect(toggleBreathSpy).toHaveBeenCalled();
  });

  it("switches to Studio tab and controls lighting presets", () => {
    const setLightingPresetSpy = vi.fn();
    useSceneStore.setState({ setLightingPreset: setLightingPresetSpy });

    render(<StudioActionDock />);
    const studioTab = screen.getByRole("button", { name: "Studio" });
    fireEvent.click(studioTab);

    expect(screen.getByRole("button", { name: "Natural" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Surgical" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Contrast" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Dark" })).toBeTruthy();

    const surgicalBtn = screen.getByRole("button", { name: "Surgical" });
    fireEvent.click(surgicalBtn);
    expect(setLightingPresetSpy).toHaveBeenCalledWith("surgical");
  });

  it("calls fitView when Fit button is clicked in Views tab", () => {
    const fitViewSpy = vi.fn();
    useSceneStore.setState({ fitView: fitViewSpy });

    render(<StudioActionDock />);
    const fitButton = screen.getByRole("button", { name: "Fit" });
    fireEvent.click(fitButton);

    expect(fitViewSpy).toHaveBeenCalled();
  });

  it("renders with Persian labels when language is fa", () => {
    useInterfaceLanguage.setState({ language: "fa" });
    render(<StudioActionDock />);

    expect(screen.getByRole("navigation", { name: /داک ابزار استودیو هومان/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /نماها/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /تشریح/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /فیزیولوژی/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /استودیو/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /کادر/i })).toBeTruthy();
  });

  it("does not render Diseases tab when no organ is selected", () => {
    useSceneStore.setState({ selectedOrganIds: [] });
    render(<StudioActionDock />);
    expect(screen.queryByRole("button", { name: "Diseases" })).toBeNull();
  });

  it("renders Diseases tab when an organ is selected and triggers navigation on click", () => {
    useSceneStore.setState({ selectedOrganIds: ["liver"] });
    render(<StudioActionDock />);

    const diseasesBtn = screen.getByRole("button", { name: "Diseases" });
    expect(diseasesBtn).toBeTruthy();

    fireEvent.click(diseasesBtn);

    expect(useNavigationStore.getState().leftPanelTab).toBe("diseases");
    expect(useNavigationStore.getState().diseaseSelectedOnly).toBe(true);
    expect(screen.getByText(/View in Disease Panel/i)).toBeTruthy();
  });

  it("renders Persian label for Diseases tab when language is fa and organ is selected", () => {
    useInterfaceLanguage.setState({ language: "fa" });
    useSceneStore.setState({ selectedOrganIds: ["liver"] });
    render(<StudioActionDock />);

    expect(screen.getByRole("button", { name: /بیماری‌ها/i })).toBeTruthy();
  });
});
