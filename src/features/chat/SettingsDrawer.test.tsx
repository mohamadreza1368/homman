import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useCustomApiConfig } from "@/stores/customApiConfig";
import { useInterfaceLanguage } from "@/stores/interfaceLanguage";

import { SettingsDrawer } from "./SettingsDrawer";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

beforeEach(() => {
  useInterfaceLanguage.setState({ language: "fa" });
  useCustomApiConfig.setState({ baseUrl: "", apiKey: "", model: "", models: [] });
});

function renderDrawer() {
  return render(
    <SettingsDrawer
      provider="openai"
      onProviderChange={vi.fn()}
      profile="student"
      onProfileChange={vi.fn()}
      language="auto"
      onLanguageChange={vi.fn()}
      spokenLimit={0}
      onSpokenLimitChange={vi.fn()}
      spokenSpeed={1}
      onSpokenSpeedChange={vi.fn()}
      spokenVolume={1}
      onSpokenVolumeChange={vi.fn()}
    />,
  );
}

describe("SettingsDrawer (Custom API only)", () => {
  it("shows only Custom API and removes Gemini, Claude, and GPT buttons", () => {
    renderDrawer();
    expect(screen.getByText("Custom API")).toBeTruthy();
    expect(screen.queryByText("Gemini")).toBeNull();
    expect(screen.queryByText("Claude")).toBeNull();
    expect(screen.queryByText("GPT")).toBeNull();
  });

  it("validates and saves Custom API Base URL, key, and model", () => {
    renderDrawer();
    fireEvent.click(screen.getByRole("button", { name: "ذخیره و فعال‌سازی" }));
    expect(screen.getByText("آدرس Custom API را وارد کنید.")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("آدرس پایه (Base URL)"), {
      target: { value: "https://api.example.com/v1/" },
    });
    fireEvent.change(screen.getByLabelText("کلید API (API Key)"), {
      target: { value: "sk-custom-123" },
    });
    fireEvent.change(screen.getByLabelText("نام مدل"), {
      target: { value: "my-medical-model" },
    });
    fireEvent.click(screen.getByRole("button", { name: "ذخیره و فعال‌سازی" }));

    expect(useCustomApiConfig.getState().baseUrl).toBe("https://api.example.com/v1");
    expect(useCustomApiConfig.getState().apiKey).toBe("sk-custom-123");
    expect(useCustomApiConfig.getState().model).toBe("my-medical-model");
    expect(screen.getByText("متصل")).toBeTruthy();
  });
});
