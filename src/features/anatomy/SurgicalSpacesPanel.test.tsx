import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useInterfaceLanguage } from "@/stores/interfaceLanguage";
import { useSceneStore } from "@/stores/sceneStore";
import { SurgicalSpacesPanel } from "./SurgicalSpacesPanel";

afterEach(cleanup);

describe("SurgicalSpacesPanel", () => {
  it("renders surgical spaces list and Calot's triangle detail", () => {
    useInterfaceLanguage.setState({ language: "fa" });
    useSceneStore.setState({
      organs: {
        gallbladder: {
          organ_id: "gallbladder",
          name_en: "Gallbladder",
          ta2_latin: "Vesica biliaris",
          system: "digestive",
        },
      },
      isolatedOrganIds: undefined,
    } as never);

    render(<SurgicalSpacesPanel />);

    expect(screen.getByText("اطلس فضاها و مثلث‌های جراحی")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "مثلث کالوت (مثلث سیستوهپاتیک)" })).toBeTruthy();
    expect(screen.getAllByText(/شریان سیستیک/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Critical View of Safety/)).toBeTruthy();
  });

  it("filters spaces by region when region pill is clicked", () => {
    useInterfaceLanguage.setState({ language: "fa" });
    render(<SurgicalSpacesPanel />);

    const neckBtn = screen.getByRole("button", { name: "گردن" });
    fireEvent.click(neckBtn);

    expect(screen.getByRole("button", { name: "مثلث کاروتید گردن" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "مثلث کالوت (مثلث سیستوهپاتیک)" })).toBeNull();
  });

  it("invokes isolateSurgicalSpace and automatically unhides required systems", () => {
    useInterfaceLanguage.setState({ language: "en" });
    useSceneStore.setState({
      hiddenSystems: ["cardiovascular", "digestive"],
      organs: {
        femoral_artery_l: {
          organ_id: "femoral_artery_l",
          name_en: "Femoral artery",
          ta2_latin: "Arteria femoralis",
          system: "cardiovascular",
        },
      },
    } as never);

    render(<SurgicalSpacesPanel />);
    const femoralPill = screen.getByRole("button", { name: "Femoral Triangle (Scarpa's Triangle)" });
    fireEvent.click(femoralPill);

    expect(screen.getByRole("heading", { name: "Femoral Triangle (Scarpa's Triangle)" })).toBeTruthy();
    expect(screen.getByText("Scarpa's Triangle")).toBeTruthy();
    expect(screen.getByText(/NAVEL/)).toBeTruthy();
    expect(useSceneStore.getState().hiddenSystems).not.toContain("cardiovascular");
    expect(useSceneStore.getState().isolatedOrganIds).toContain("femoral_artery_l");
  });
});
