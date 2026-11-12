import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { useInterfaceLanguage } from "@/stores/interfaceLanguage";
import { useSceneStore } from "@/stores/sceneStore";
import { StructureEducation } from "./StructureEducation";

afterEach(cleanup);
it("shows the selected organ profile and its linked conditions", () => {
  useInterfaceLanguage.setState({ language: "fa" });
  useSceneStore.setState({ genderModel: "male", selectedOrganIds: ["liver"], organs: { liver: { organ_id: "liver", name_en: "Liver", ta2_latin: "Hepar", system: "digestive" } } as never });
  render(<StructureEducation />);
  expect(screen.getByRole("heading", { name: "کبد" })).toBeTruthy();
  expect(screen.getByText("سیروز کبدی")).toBeTruthy();
  expect(screen.getByText("homman:liver")).toBeTruthy();
});
