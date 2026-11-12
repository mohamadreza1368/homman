import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MondoSearch } from "./MondoSearch";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("searches the offline index and identifies unmapped terminology", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ release: "test", entries: [["MONDO:0001", "asthma"], ["MONDO:0002", "hepatitis"]] }) }));
  render(<MondoSearch query="asth" fa />);
  expect(await screen.findByRole("link", { name: "asthma" })).toBeTruthy();
  expect(screen.queryByText("hepatitis")).toBeNull();
  expect(screen.getByText(/ارتباط با اندام، ترجمه/)).toBeTruthy();
});
