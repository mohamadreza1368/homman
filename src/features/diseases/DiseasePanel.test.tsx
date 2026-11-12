import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useInterfaceLanguage } from "@/stores/interfaceLanguage";
import { useSceneStore } from "@/stores/sceneStore";
import { DiseasePanel } from "./DiseasePanel";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("disease library", () => {
  it("filters in Persian and reveals the mapped structure", () => {
    useInterfaceLanguage.setState({ language: "fa" });
    const apply = vi.fn();
    useSceneStore.setState({ genderModel: "female", organs: { gallbladder: { organ_id: "gallbladder", system: "digestive" } } as never, applyCommand: apply });
    render(<DiseasePanel />);
    fireEvent.change(screen.getByRole("searchbox", { name: "جست‌وجوی بیماری" }), { target: { value: "صفرا" } });
    expect(screen.getByText("سنگ کیسهٔ صفرا")).toBeTruthy();
    expect(screen.queryByText("آسم")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "نمایش کیسهٔ صفرا در مدل" }));
    expect(apply).toHaveBeenCalledWith({ action: "set_layer_visibility", system: "digestive", visible: true });
    expect(apply).toHaveBeenCalledWith({ action: "focus_organ", organ_id: "gallbladder" });
  });
});
