import { beforeEach, describe, expect, it } from "vitest";

import { useUsageStore } from "./usageStore";

describe("useUsageStore in browser mode", () => {
  beforeEach(() => {
    useUsageStore.setState({
      buckets: [],
      grain: "day",
      loaded: false,
      error: null,
    });
  });

  it("refreshes cleanly without error when Tauri internals are absent", async () => {
    const store = useUsageStore.getState();
    await store.refresh();

    const state = useUsageStore.getState();
    expect(state.loaded).toBe(true);
    expect(state.error).toBeNull();
    expect(state.buckets).toEqual([]);
  });

  it("handles record and dismissError gracefully", async () => {
    const store = useUsageStore.getState();
    await store.record({
      session_id: "s1",
      provider: "anthropic",
      model: "claude-3-5-sonnet",
      input_tokens: 100,
      output_tokens: 50,
      cache_read_tokens: 0,
    });

    expect(useUsageStore.getState().error).toBeNull();

    useUsageStore.setState({ error: "Sample error" });
    useUsageStore.getState().dismissError();
    expect(useUsageStore.getState().error).toBeNull();
  });
});
