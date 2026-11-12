import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { DiseaseDefinition } from "./DiseaseDefinition";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("loads the definition lazily and identifies the source language", async () => {
  const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ definitions: { "MONDO:1": { text: "A sample source definition.", references: "" } } }) });
  vi.stubGlobal("fetch", fetcher);
  render(<DiseaseDefinition id="MONDO:1" fa />);
  expect(fetcher).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText("توضیح بیماری"));
  expect(await screen.findByText("A sample source definition.")).toBeTruthy();
  expect(screen.getByText(/متن اصلی منبع/)).toBeTruthy();
});
