/**
 * Hoomaan 3D Viewer - Engine IPC Event & Scene Command Dispatcher Hook
 */

import { useEffect, useLayoutEffect, useRef } from "react";
import { onEngineEvent } from "@/lib/ipc";
import type {
  AiProvider,
  EngineEvent,
  ModelInfo,
  SceneCommand,
  TokenUsage,
} from "@/lib/schemas";
import { useSceneStore } from "@/stores/sceneStore";
import { useBridgeStore } from "@/stores/bridgeStore";

export interface SceneCommandBridgeOptions {
  acceptSceneCommand?: (requestId: string) => boolean;
  onTextDelta?: (requestId: string, text: string) => void;
  onToolStarted?: (requestId: string, tool: string) => void;
  onSceneCommand?: (requestId: string, command: SceneCommand) => void;
  onModels?: (requestId: string, provider: AiProvider, models: ModelInfo[]) => void;
  onCaseVerdict?: (requestId: string, score: number, verdict: string) => void;
  onDone?: (requestId: string, usage: TokenUsage | null, model: string | null) => void;
  onError?: (code: string, message: string, requestId: string | null) => void;
  onReady?: (protocolVersion: number) => void;
  onAttached?: () => void;
  onProtocolViolation?: (payload: unknown, issues: string) => void;
}

/**
 * Subscribes to backend IPC events and dispatches scene commands to sceneStore.
 */
export function useSceneCommands(options: SceneCommandBridgeOptions = {}) {
  const applyCommand = useSceneStore((s) => s.applyCommand);
  const latest = useRef(options);
  useLayoutEffect(() => {
    latest.current = options;
  });

  useEffect(() => {
    let stop: (() => void) | undefined;
    let cancelled = false;

    onEngineEvent(
      (event: EngineEvent) => {
        if (cancelled) return;
        const opts = latest.current;

        switch (event.type) {
          case "ready":
            opts.onReady?.(event.protocol_version);
            break;
          case "scene_command":
            if (event.command.action === "say") {
              if (/^bridge-\d+$/.test(event.request_id)) {
                useBridgeStore.getState().receiveProse(event.request_id, event.command.text);
              }
              break;
            }
            if (
              !/^bridge-\d+$/.test(event.request_id) &&
              !opts.acceptSceneCommand?.(event.request_id)
            ) {
              break;
            }
            applyCommand(event.command);
            opts.onSceneCommand?.(event.request_id, event.command);
            break;
          case "text_delta":
            opts.onTextDelta?.(event.request_id, event.text);
            break;
          case "tool_started":
            opts.onToolStarted?.(event.request_id, event.tool);
            break;
          case "models":
            opts.onModels?.(event.request_id, event.provider, event.models);
            break;
          case "case_verdict":
            opts.onCaseVerdict?.(event.request_id, event.score, event.verdict);
            break;
          case "done":
            opts.onDone?.(event.request_id, event.usage, event.model);
            break;
          case "error":
            opts.onError?.(event.code, event.message, event.request_id);
            break;
        }
      },
      {
        onProtocolViolation: (payload, issues) => {
          if (!cancelled) latest.current.onProtocolViolation?.(payload, issues);
        },
      },
    ).then(
      (off) => {
        if (cancelled) {
          off();
          return;
        }
        stop = off;
        latest.current.onAttached?.();
      },
      (err: unknown) => {
        if (cancelled) return;
        latest.current.onError?.(
          "internal_error",
          `Could not subscribe to engine events: ${String(err)}`,
          null,
        );
      },
    );

    return () => {
      cancelled = true;
      stop?.();
    };
  }, [applyCommand]);
}
