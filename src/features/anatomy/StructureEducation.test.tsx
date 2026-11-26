import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { useInterfaceLanguage } from "@/stores/interfaceLanguage";
import { useSceneStore } from "@/stores/sceneStore";
import { StructureEducation } from "./StructureEducation";

afterEach(cleanup);

it("shows the selected organ profile and its linked conditions", () => {
  useInterfaceLanguage.setState({ language: "fa" });
  useSceneStore.setState({
    genderModel: "male",
    selectedOrganIds: ["liver"],
    organs: {
      liver: { organ_id: "liver", name_en: "Liver", ta2_latin: "Hepar", system: "digestive" },
    },
  } as never);
  render(<StructureEducation />);
  expect(screen.getByRole("heading", { name: "کبد" })).toBeTruthy();
  expect(screen.getByText("سیروز کبدی")).toBeTruthy();
  expect(screen.getByText("homman:liver")).toBeTruthy();
  expect(screen.queryByTestId("muscle-oiia-card")).toBeNull();
});

it("renders clinical O/I/I/A muscle functional profile and spinal roots for skeletal muscle", () => {
  useInterfaceLanguage.setState({ language: "fa" });
  useSceneStore.setState({
    genderModel: "male",
    selectedOrganIds: ["biceps_brachii_left"],
    organs: {
      biceps_brachii_left: {
        organ_id: "biceps_brachii_left",
        name_en: "Biceps brachii left",
        ta2_latin: "Musculus biceps brachii",
        system: "muscular",
      },
    },
  } as never);
  render(<StructureEducation />);
  expect(screen.getByTestId("muscle-oiia-card")).toBeTruthy();
  expect(screen.getByText("شناسنامه عملکردی عضله (O / I / I / A)")).toBeTruthy();
  expect(screen.getByText("C5")).toBeTruthy();
  expect(screen.getByText("C6")).toBeTruthy();
  expect(screen.getByText(/توبروزیته استخوان رادیوس/)).toBeTruthy();
  expect(screen.getByText(/قوی‌ترین سوپیناتور ساعد/)).toBeTruthy();
  expect(screen.getByText(/تست رفلکس دو سر/)).toBeTruthy();
});

it("renders muscle profile in English when interface language is English", () => {
  useInterfaceLanguage.setState({ language: "en" });
  useSceneStore.setState({
    genderModel: "male",
    selectedOrganIds: ["gastrocnemius_right"],
    organs: {
      gastrocnemius_right: {
        organ_id: "gastrocnemius_right",
        name_en: "Gastrocnemius right",
        ta2_latin: "Musculus gastrocnemius",
        system: "muscular",
      },
    },
  } as never);
  render(<StructureEducation />);
  expect(screen.getByTestId("muscle-oiia-card")).toBeTruthy();
  expect(screen.getByText("Muscle Functional Profile (O/I/I/A)")).toBeTruthy();
  expect(screen.getByText("S1")).toBeTruthy();
  expect(screen.getByText("S2")).toBeTruthy();
  expect(screen.getByText(/Tibial nerve/)).toBeTruthy();
  expect(screen.getByText(/Achilles tendon reflex/)).toBeTruthy();
});
