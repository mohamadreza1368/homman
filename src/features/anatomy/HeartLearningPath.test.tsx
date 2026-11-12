import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useInterfaceLanguage } from "@/stores/interfaceLanguage";
import { useSceneStore } from "@/stores/sceneStore";
import { anatomyConcepts } from "./concepts";
import { HEART_PATH, HeartLearningPath } from "./HeartLearningPath";

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("shows the selected heart structure and explains the lung transition", () => {
  useInterfaceLanguage.setState({ language: "fa" });
  const apply = vi.fn();
  useSceneStore.setState({ genderModel: "male", organs: { right_atrium: { organ_id: "right_atrium", system: "cardiovascular" } } as never, applyCommand: apply });
  render(<HeartLearningPath />);
  fireEvent.click(screen.getByRole("button", { name: "شروع مسیر" }));
  fireEvent.click(screen.getByRole("button", { name: "نمایش روی مدل" }));
  expect(apply).toHaveBeenCalledWith({ action: "focus_organ", organ_id: "right_atrium" });
  fireEvent.click(screen.getByRole("button", { name: "بعدی" }));
  fireEvent.click(screen.getByRole("button", { name: "بعدی" }));
  expect(screen.getByText(/خون در ریه‌ها اکسیژن می‌گیرد/)).toBeTruthy();
});

it("uses explicitly mapped concepts and does not pretend the female atlas has a complete heart", () => {
  for (const id of HEART_PATH) expect(anatomyConcepts.find((entry) => entry.id === id)?.models.male.length).toBeGreaterThan(0);
  useInterfaceLanguage.setState({ language: "fa" });
  useSceneStore.setState({ genderModel: "female", organs: {} });
  render(<HeartLearningPath />);
  fireEvent.click(screen.getByRole("button", { name: "شروع مسیر" }));
  expect(screen.getByText(/در مدل انتخاب‌شده معادل ثبت نشده/)).toBeTruthy();
  expect(screen.queryByRole("button", { name: "نمایش روی مدل" })).toBeNull();
});

it("restores the last viewed step and saves navigation", () => {
  const setItem = vi.fn();
  vi.stubGlobal("localStorage", { getItem: () => JSON.stringify({ lastStep: 2, visited: [0, 1, 2], attempts: 1, best: 3, last: 3 }), setItem });
  useInterfaceLanguage.setState({ language: "fa" });
  useSceneStore.setState({ genderModel: "female", organs: {} });
  render(<HeartLearningPath />);
  fireEvent.click(screen.getByRole("button", { name: "ادامهٔ مسیر" }));
  expect(screen.getByText("گام 3 از 6")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "بعدی" }));
  expect(JSON.parse(setItem.mock.lastCall![1]).lastStep).toBe(3);
});
