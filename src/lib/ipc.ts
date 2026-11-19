import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

import {
  AgentRequestSchema,
  EngineEventSchema,
  ListModelsRequestSchema,
  LocalChatRequestSchema,
  LocalModelsRequestSchema,
  PROTOCOL_VERSION,
  type AgentRequest,
  type AiProvider,
  type EngineEvent,
  type ListModelsRequest,
  type LocalChatRequest,
  type LocalModelsRequest,
} from "./schemas";

const ENGINE_CHANNEL_TOPIC = "hoomaan://engine-event";

/**
 * Checks whether JavaScript execution context is running under Tauri's native webview.
 */
export function isTauriContext(): boolean {
  return (
    typeof window !== "undefined" &&
    Boolean((window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__)
  );
}

// ---------------------------------------------------------------------------
// Security Credentials
// ---------------------------------------------------------------------------

export function saveApiKey(provider: AiProvider, apiKey: string): Promise<void> {
  if (!isTauriContext()) return Promise.resolve();
  return invoke("save_api_key", { provider, apiKey });
}

export function hasApiKey(provider: AiProvider): Promise<boolean> {
  if (!isTauriContext()) return Promise.resolve(false);
  return invoke("has_api_key", { provider });
}

export function deleteApiKey(provider: AiProvider): Promise<void> {
  if (!isTauriContext()) return Promise.resolve();
  return invoke("delete_api_key", { provider });
}

// ---------------------------------------------------------------------------
// Analysis Engine Communication
// ---------------------------------------------------------------------------

export function askAgent(request: AgentRequest): Promise<void> {
  if (!isTauriContext()) return Promise.resolve();
  return invoke("ask_agent", { request: AgentRequestSchema.parse(request) });
}

export function listModels(request: ListModelsRequest): Promise<void> {
  if (!isTauriContext()) return Promise.resolve();
  return invoke("list_models", { request: ListModelsRequestSchema.parse(request) });
}

export function askLocal(request: LocalChatRequest): Promise<void> {
  if (!isTauriContext()) return Promise.resolve();
  return invoke("ask_local", { request: LocalChatRequestSchema.parse(request) });
}

export function listLocalModels(request: LocalModelsRequest): Promise<void> {
  if (!isTauriContext()) return Promise.resolve();
  return invoke("list_local_models", { request: LocalModelsRequestSchema.parse(request) });
}

export interface EngineStatus {
  ready: boolean;
  error: string | null;
  protocol_version: number | null;
}

export function engineStatus(): Promise<EngineStatus> {
  if (!isTauriContext()) {
    return Promise.resolve({
      ready: true,
      error: null,
      protocol_version: PROTOCOL_VERSION,
    });
  }
  return invoke("engine_status");
}

export function restartEngine(): Promise<void> {
  if (!isTauriContext()) return Promise.resolve();
  return invoke("restart_engine");
}

export function cancelRequest(requestId: string): Promise<void> {
  if (!isTauriContext()) return Promise.resolve();
  return invoke("cancel_request", { requestId });
}

// ---------------------------------------------------------------------------
// Native IPC Control Bridge
// ---------------------------------------------------------------------------

export interface BridgeStatus {
  supported: boolean;
  running: boolean;
  pipe: string | null;
  accepted: number;
  refused: number;
  server: string | null;
}

export function bridgeStatus(): Promise<BridgeStatus> {
  if (!isTauriContext()) {
    return Promise.resolve({
      supported: false,
      running: false,
      pipe: null,
      accepted: 0,
      refused: 0,
      server: null,
    });
  }
  return invoke("bridge_status");
}

export function startBridge(): Promise<BridgeStatus> {
  if (!isTauriContext()) {
    return Promise.resolve({
      supported: false,
      running: false,
      pipe: null,
      accepted: 0,
      refused: 0,
      server: null,
    });
  }
  return invoke("start_bridge");
}

export function stopBridge(): Promise<BridgeStatus> {
  if (!isTauriContext()) {
    return Promise.resolve({
      supported: false,
      running: false,
      pipe: null,
      accepted: 0,
      refused: 0,
      server: null,
    });
  }
  return invoke("stop_bridge");
}

export interface DisplayStatus {
  supported: boolean;
  stableDisplay: boolean;
  active: boolean;
}

export function displayStatus(): Promise<DisplayStatus> {
  if (!isTauriContext()) {
    return Promise.resolve({
      supported: false,
      stableDisplay: false,
      active: false,
    });
  }
  return invoke("display_status");
}

export function setStableDisplay(on: boolean): Promise<DisplayStatus> {
  if (!isTauriContext()) {
    return Promise.resolve({
      supported: false,
      stableDisplay: on,
      active: false,
    });
  }
  return invoke("set_stable_display", { on });
}

// ---------------------------------------------------------------------------
// Sidecar Event Streaming
// ---------------------------------------------------------------------------

export interface EngineListenerOptions {
  onProtocolViolation?: (payload: unknown, issues: string) => void;
}

export function onEngineEvent(
  handler: (event: EngineEvent) => void,
  options: EngineListenerOptions = {},
): Promise<UnlistenFn> {
  const onViolation =
    options.onProtocolViolation ??
    ((_payload, issues) => {
      console.error("[engine] protocol violation", issues);
    });

  if (!isTauriContext()) {
    return Promise.resolve(() => {});
  }

  return listen<unknown>(ENGINE_CHANNEL_TOPIC, (message) => {
    const parsed = EngineEventSchema.safeParse(message.payload);
    if (!parsed.success) {
      onViolation(message.payload, parsed.error.message);
      return;
    }
    handler(parsed.data);
  });
}

export function newRequestId(): string {
  return crypto.randomUUID();
}
