import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildCustomSystemPrompt,
  fetchCustomModels,
  streamCustomChat,
} from "./customApiClient";
import {
  convertToolCallToCommand,
  HOOMAAN_ANATOMY_TOOLS,
  HOOMAAN_CASE_TOOL,
} from "./hoomaanTools";

describe("hoomaanTools", () => {
  it("exports comprehensive 3D scene and clinical tools", () => {
    expect(HOOMAAN_ANATOMY_TOOLS.length).toBeGreaterThanOrEqual(10);
    const names = HOOMAAN_ANATOMY_TOOLS.map((t) => t.function.name);
    expect(names).toContain("focus_organ");
    expect(names).toContain("illuminate_structures");
    expect(names).toContain("isolate_structures");
    expect(names).toContain("isolate_region");
    expect(names).toContain("highlight_pathway");
    expect(names).toContain("set_cross_section");
    expect(names).toContain("scan_at_structure");
    expect(names).toContain("set_heart_rhythm");
    expect(names).toContain("set_layer_visibility");
    expect(names).toContain("reset_view");
    expect(HOOMAAN_CASE_TOOL.function.name).toBe("record_case_verdict");
  });

  it("converts focus_organ and validation correctly", () => {
    const res = convertToolCallToCommand("focus_organ", { organ_id: "heart" });
    expect(res.command).toEqual({ action: "focus_organ", organ_id: "heart" });

    const blank = convertToolCallToCommand("focus_organ", { organ_id: "" });
    expect(blank.command).toBeUndefined();
  });

  it("converts illuminate_structures correctly", () => {
    const res = convertToolCallToCommand("illuminate_structures", {
      organ_ids: ["heart", "aorta"],
    });
    expect(res.command).toEqual({
      action: "illuminate_structures",
      organ_ids: ["heart", "aorta"],
    });
  });

  it("converts highlight_pathway correctly", () => {
    const res = convertToolCallToCommand("highlight_pathway", {
      label: "Blood circulation",
      organ_ids: ["vena_cava", "right_atrium", "right_ventricle"],
      step_seconds: 1.5,
      loop: true,
    });
    expect(res.command).toEqual({
      action: "highlight_pathway",
      label: "Blood circulation",
      organ_ids: ["vena_cava", "right_atrium", "right_ventricle"],
      step_seconds: 1.5,
      loop: true,
    });
  });

  it("converts set_cross_section correctly", () => {
    const res = convertToolCallToCommand("set_cross_section", {
      plane: "coronal",
      position: 0.35,
    });
    expect(res.command).toEqual({
      action: "set_cross_section",
      plane: "coronal",
      position: 0.35,
    });
  });

  it("converts set_heart_rhythm correctly", () => {
    const res = convertToolCallToCommand("set_heart_rhythm", {
      rhythm: "sinus_tachycardia",
      sound: true,
    });
    expect(res.command).toEqual({
      action: "set_heart_rhythm",
      rhythm: "sinus_tachycardia",
      sound: true,
    });
  });

  it("converts record_case_verdict correctly", () => {
    const res = convertToolCallToCommand("record_case_verdict", {
      score: 88,
      verdict: "تشخیص صحیح نارسایی میترال با استدلال بالینی مناسب.",
    });
    expect(res.verdict).toEqual({
      score: 88,
      verdict: "تشخیص صحیح نارسایی میترال با استدلال بالینی مناسب.",
    });
  });
});

describe("customApiClient", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("builds rich Hoomaan prompt with 3D pins and guidelines", () => {
    const prompt = buildCustomSystemPrompt({
      fa: true,
      profile: "student",
      genderModel: "male",
      mode: "tutor",
      selection: [{ organ_id: "cor", ta2_latin: "Cor", name_en: "Heart", system: "cardiovascular" }],
      organCount: 450,
    });
    expect(prompt).toContain("HOOMAAN");
    expect(prompt).toContain("[[organ_slug]]");
    expect(prompt).toContain("focus_organ");
    expect(prompt).toContain("Cor (Heart, system: cardiovascular)");
  });

  it("fetches available models from /models endpoint", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [{ id: "model-a" }, { id: "model-b" }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const models = await fetchCustomModels("http://127.0.0.1:8000/v1", "secret-key");
    expect(models).toEqual(["model-a", "model-b"]);
  });

  it("streams chat and dispatches 3D tool calls", async () => {
    const sseLines = [
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"c1","function":{"name":"focus_organ","arguments":"{\\"organ_id\\":\\"heart\\"}"}}]}}]}',
      'data: {"choices":[{"delta":{"content":"قلب ("}}]}',
      'data: {"choices":[{"delta":{"content":"[[heart]]) پمپ اصلی گردش خون است."}}]}',
      "data: [DONE]",
    ].join("\n\n");

    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(
      new Response(sseLines, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      }),
    );

    const deltas: string[] = [];
    const toolsStarted: string[] = [];
    const commands: unknown[] = [];

    const result = await streamCustomChat({
      baseUrl: "http://127.0.0.1:8000/v1",
      apiKey: "test-key",
      model: "test-model",
      systemPrompt: "sys",
      history: [],
      query: "قلب را نشان بده",
      onDelta: (d) => deltas.push(d),
      onToolStarted: (t) => toolsStarted.push(t),
      onSceneCommand: (c) => commands.push(c),
    });

    expect(deltas.join("")).toBe("قلب ([[heart]]) پمپ اصلی گردش خون است.");
    expect(toolsStarted).toEqual(["focus_organ"]);
    expect(commands).toEqual([{ action: "focus_organ", organ_id: "heart" }]);
    expect(result.text).toBe("قلب ([[heart]]) پمپ اصلی گردش خون است.");
  });

  it("handles non-streaming fallback with tool calls", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: "ریتم تاکی‌کاردی فعال شد.",
                tool_calls: [
                  {
                    id: "c2",
                    function: {
                      name: "set_heart_rhythm",
                      arguments: JSON.stringify({ rhythm: "sinus_tachycardia", sound: true }),
                    },
                  },
                ],
              },
            },
          ],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const commands: unknown[] = [];
    const result = await streamCustomChat({
      baseUrl: "http://127.0.0.1:8000/v1",
      apiKey: "test-key",
      model: "test-model",
      systemPrompt: "sys",
      history: [],
      query: "ریتم تند قلب را شبیه‌سازی کن",
      onSceneCommand: (c) => commands.push(c),
    });

    expect(result.text).toBe("ریتم تاکی‌کاردی فعال شد.");
    expect(commands).toEqual([
      { action: "set_heart_rhythm", rhythm: "sinus_tachycardia", sound: true },
    ]);
  });
});
