import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSceneStore } from "@/stores/sceneStore";
import { useInterfaceLanguage } from "@/stores/interfaceLanguage";
import { StudioActionDock } from "./StudioActionDock";

describe("StudioActionDock", () => {
  beforeEach(() => {
    useInterfaceLanguage.setState({ language: "en" });
    useSceneStore.setState({
      fitView: vi.fn(),
      orientView: vi.fn(),
      dollyView: vi.fn(),
      glassBody: vi.fn(),
      cycleExplode: vi.fn(),
      showAllSystems: vi.fn(),
      resetView: vi.fn(),
      isolatedOrganIds: null,
      explode: 0,
    });
  });

  it("renders with navigation tabs", () => {
    render(<StudioActionDock />);
    expect(screen.getByRole("navigation", { name: /studio dock/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Views" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Dissect" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Physio" })).toBeTruthy();
  });

  it("switches to Dissect tab and displays dissection controls", () => {
    render(<StudioActionDock />);
    const dissectTab = screen.getByRole("button", { name: "Dissect" });
    fireEvent.click(dissectTab);

    expect(screen.getByRole("button", { name: "Glass" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "All" })).toBeTruthy();
  });

  it("switches to Physio tab and displays simulator controls", () => {
    render(<StudioActionDock />);
    const physioTab = screen.getByRole("button", { name: "Physio" });
    fireEvent.click(physioTab);

    expect(screen.getByRole("button", { name: "Heartbeat" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Breathing" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Scanner" })).toBeTruthy();
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
    expect(screen.getByRole("button", { name: /کادر/i })).toBeTruthy();
  });
});
