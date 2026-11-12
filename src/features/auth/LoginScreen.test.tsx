import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { useInterfaceLanguage } from "@/stores/interfaceLanguage";
import { useSessionAuth } from "@/stores/sessionAuth";

import { LoginScreen } from "./LoginScreen";

afterEach(cleanup);

beforeEach(() => {
  useSessionAuth.setState({ authenticated: false, userName: "", isGuest: false });
  useInterfaceLanguage.setState({ language: "en" });
});

describe("LoginScreen", () => {
  it("renders the HOOMAAN dark brand logo and sign-in controls", () => {
    render(<LoginScreen />);
    const logo = screen.getByAltText("HOOMAAN — هومان") as HTMLImageElement;
    expect(logo.getAttribute("src")).toBe("/brand/hoomaan-logo-dark.png");
    expect(screen.getByRole("button", { name: "Sign in to 3D Atlas" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Continue as Guest" })).toBeTruthy();
  });

  it("validates empty username submission and logs in with entered name", () => {
    render(<LoginScreen />);
    fireEvent.click(screen.getByRole("button", { name: "Sign in to 3D Atlas" }));
    expect(screen.getByRole("alert").textContent).toContain("Please enter your name or email");
    expect(useSessionAuth.getState().authenticated).toBe(false);

    fireEvent.change(screen.getByLabelText("Name or email"), { target: { value: "Dr. Reza" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in to 3D Atlas" }));
    expect(useSessionAuth.getState().authenticated).toBe(true);
    expect(useSessionAuth.getState().userName).toBe("Dr. Reza");
    expect(useSessionAuth.getState().isGuest).toBe(false);
  });

  it("allows instant guest entry and bilingual switching", () => {
    render(<LoginScreen />);
    fireEvent.click(screen.getByRole("button", { name: "فارسی" }));
    expect(screen.getByRole("button", { name: "ورود سریع به‌عنوان مهمان" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "ورود سریع به‌عنوان مهمان" }));
    expect(useSessionAuth.getState().authenticated).toBe(true);
    expect(useSessionAuth.getState().isGuest).toBe(true);
  });
});
