import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { useHeartStore } from "@/stores/heartStore";
import { useScanStore } from "@/stores/scanStore";
import { useSceneStore } from "@/stores/sceneStore";

import { Markdown } from "./Markdown";

afterEach(cleanup);

describe("Markdown", () => {
  it("renders the structure the model teaches with", () => {
    render(
      <Markdown>{`## Pathophysiology\n\n- **Preload** rises\n- Wall stress follows`}</Markdown>,
    );

    expect(screen.getByText("Pathophysiology")).toBeDefined();
    expect(screen.getByText("Preload").tagName).toBe("STRONG");
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  /**
   * Seen in a real answer, at every heading: the model welded the section title
   * to the end of the sentence before it. CommonMark needs an ATX heading to
   * begin a line, so the reader got two literal hashes mid-paragraph and no
   * heading at all. Repaired before parsing — see `repairMarkdown.ts`.
   */
  it("renders a heading the model welded to the previous sentence", () => {
    render(
      <Markdown>{`...durante uno spavento.## 3. Il quadro comando\n\nNel bulbo.`}</Markdown>,
    );

    const heading = screen.getByText("3. Il quadro comando");
    expect(heading.tagName).toMatch(/^H[1-6]$/);
    expect(screen.queryByText(/##/)).toBeNull();
  });

  /**
   * Seen in a real answer: the model wrote `[[heart]]`, which is not an id the
   * atlas has — the heart is seventeen separate meshes — and the raw marker
   * rendered in the prose. The stripping always worked; a `refs.length > 0`
   * guard above it switched it off in exactly the case that needed it, when
   * the invented marker was the only one in the answer.
   */
  it("removes a marker the model invented, even when it is the only one", () => {
    render(<Markdown>{`El corazón [[heart]], como músculo, necesita oxígeno.`}</Markdown>);

    expect(screen.queryByText(/\[\[/)).toBeNull();
    expect(screen.getByText(/como músculo, necesita oxígeno/)).toBeDefined();
  });

  it("renders tables, which clinician answers lean on", () => {
    render(
      <Markdown>{`| Finding | Value |\n| --- | --- |\n| EF | 35% |`}</Markdown>,
    );

    expect(screen.getByRole("table")).toBeDefined();
    expect(screen.getByText("35%")).toBeDefined();
  });

  it("does not execute raw HTML from model output", () => {
    // Model output is untrusted input rendered inside the app's own webview.
    // `react-markdown` ignores raw HTML unless rehype-raw is added; this test
    // exists so nobody adds it without noticing what it opens up.
    const { container } = render(
      <Markdown>{`<img src=x onerror="window.__pwned = true">`}</Markdown>,
    );

    expect(container.querySelector("img")).toBeNull();
    expect((window as unknown as Record<string, unknown>).__pwned).toBeUndefined();
  });

  it("makes a numbered reference a control, not decoration", () => {
    useSceneStore.setState({
      organs: {
        hippocampus: {
          organ_id: "hippocampus",
          ta2_latin: "Hippocampus",
          name_en: "Hippocampus",
          system: "nervous",
          mesh_file: "nervous_male.glb",
          node: "Hippocampus",
          path: [],
        },
      },
    });

    render(<Markdown>{`The hippocampus [[hippocampus]] stores the map.`}</Markdown>);

    const pin = screen.getByRole("button", { name: /hippocampus/i });
    expect(pin.textContent).toBe("1");
  });

  it("still strips a dangerous scheme the model wrote", () => {
    const { container } = render(
      <Markdown>{`[run](javascript:window.__pwned=true)`}</Markdown>,
    );

    expect(container.querySelector("a")).toBeNull();
    expect(container.querySelector("button")).toBeNull();
    expect((window as unknown as Record<string, unknown>).__pwned).toBeUndefined();
  });

  it("renders model links as inert text", () => {
    const { container } = render(
      <Markdown>{`See [the guide](https://example.invalid/x)`}</Markdown>,
    );

    expect(container.querySelector("a")).toBeNull();
    expect(screen.getByText("the guide")).toBeDefined();
  });

  it("renders interactive rhythm pins and triggers cardiac simulation", () => {
    useHeartStore.setState({ enabled: false, rhythm: "normal" });

    render(
      <Markdown>{`The patient exhibits [Atrial Fibrillation](hoomaan-rhythm:atrial_fibrillation).`}</Markdown>,
    );

    const rhythmBtn = screen.getByRole("button", { name: /Atrial Fibrillation/i });
    expect(rhythmBtn).toBeDefined();

    fireEvent.click(rhythmBtn);

    expect(useHeartStore.getState().enabled).toBe(true);
    expect(useHeartStore.getState().rhythm).toBe("atrial_fibrillation");
  });

  it("renders interactive tomography slice pins and triggers scan_to command", () => {
    useScanStore.setState({ enabled: false, axial: false });

    render(
      <Markdown>{`Compare with [Axial Slice T8](hoomaan-slice:vertebra_t8).`}</Markdown>,
    );

    const sliceBtn = screen.getByRole("button", { name: /Axial Slice T8/i });
    expect(sliceBtn).toBeDefined();

    fireEvent.click(sliceBtn);

    expect(useScanStore.getState().enabled).toBe(true);
    expect(useScanStore.getState().axial).toBe(true);
    expect(useSceneStore.getState().scanRequest?.organId).toBe("vertebra_t8");
  });
});
