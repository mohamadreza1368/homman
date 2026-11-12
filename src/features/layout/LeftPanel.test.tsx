import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useInterfaceLanguage } from "@/stores/interfaceLanguage";
import { LeftPanel } from "./LeftPanel";

vi.mock("@/features/tree/AnatomyTree", () => ({ AnatomyTree: () => <div>atlas tree</div> }));
vi.mock("@/features/anatomy/StructureEducation", () => ({ StructureEducation: () => <div>education profile</div> }));
vi.mock("@/features/anatomy/AnatomyQuiz", () => ({ AnatomyQuiz: ({ onActiveChange }: { onActiveChange: (active: boolean) => void }) => <button onClick={() => onActiveChange(true)}>begin quiz</button> }));
vi.mock("@/features/anatomy/HeartLearningPath", () => ({ HeartLearningPath: () => <div>heart lesson</div> }));
vi.mock("@/features/study/StudyPanel", () => ({ StudyPanel: () => <div>study notes</div> }));
vi.mock("@/features/usage/UsagePanel", () => ({ UsagePanel: () => null }));
vi.mock("@/features/viewer/ViewControls", () => ({ ViewControls: () => null }));
vi.mock("@/features/diseases/DiseasePanel", () => ({ DiseasePanel: () => null }));
vi.mock("./StorageNotice", () => ({ StorageNotice: () => null }));

afterEach(cleanup);
it("keeps education in its own tab and hides the atlas profile during a quiz", () => {
  useInterfaceLanguage.setState({ language: "fa" });
  render(<LeftPanel />);
  fireEvent.click(screen.getByRole("button", { name: "آموزش" }));
  expect(screen.getByText("heart lesson").closest(".hidden")).toBeNull();
  expect(screen.getByText("education profile").closest(".hidden")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "begin quiz" }));
  expect(screen.queryByText("education profile")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "اطلس" }));
  expect(screen.getByText("atlas tree").closest(".hidden")).toBeNull();
});
