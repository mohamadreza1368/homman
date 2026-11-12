import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useInterfaceLanguage } from "@/stores/interfaceLanguage";
import { useSceneStore } from "@/stores/sceneStore";
import { AnatomyQuiz } from "./AnatomyQuiz";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it("checks the selected structure and records one attempt", () => {
  useInterfaceLanguage.setState({ language: "fa" });
  useSceneStore.setState({ genderModel: "male", selectedOrganIds: [], organs: { liver: { organ_id: "liver", system: "digestive" } } as never });
  const onActiveChange = vi.fn();
  render(<AnatomyQuiz onActiveChange={onActiveChange} />);
  fireEvent.click(screen.getByRole("button", { name: "شروع تمرین" }));
  expect(screen.getByText(/«کبد» را/)).toBeTruthy();
  act(() => useSceneStore.getState().selectOrgan("liver"));
  fireEvent.click(screen.getByRole("button", { name: "بررسی پاسخ" }));
  expect(screen.getByRole("status").textContent).toContain("درست است");
  expect(screen.getByText(/۱ پاسخ درست از ۱ تلاش|1 پاسخ درست از 1 تلاش/)).toBeTruthy();
  expect(onActiveChange).toHaveBeenCalledWith(false);
});
