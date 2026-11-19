import { useEffect, useMemo, useRef, useState } from "react";

import { Markdown } from "@/features/chat/Markdown";
import { askLocal, cancelRequest, listLocalModels, newRequestId, onEngineEvent } from "@/lib/ipc";
import type { ChatTurn, GenderModel, OrganContext, UserProfile } from "@/lib/schemas";
import { useLocalChatStore, type LocalMessage } from "@/stores/localChatStore";
import { useSceneStore } from "@/stores/sceneStore";
import { latinIndex, mentionedStructures, type Mention } from "./mentions";

const LOCAL_REQUEST_PREFIX = "local-";

function formatGigabytes(sizeInBytes: number | null | undefined): string | null {
  return typeof sizeInBytes === "number"
    ? `${(sizeInBytes / 1e9).toFixed(1)} GB`
    : null;
}

function extractConversationHistory(messages: readonly LocalMessage[]): ChatTurn[] {
  const turns: ChatTurn[] = [];
  for (let idx = 0; idx < messages.length - 1; idx++) {
    const q = messages[idx]!;
    const a = messages[idx + 1]!;
    if (q.role === "user" && a.role === "assistant" && a.status === "done") {
      turns.push({ role: "user", content: q.content });
      turns.push({ role: "assistant", content: a.content });
    }
  }
  return turns.slice(-100);
}

interface LocalChatPanelProps {
  open: boolean;
  engineReady: boolean;
  profile: UserProfile;
  genderModel: GenderModel;
}

/**
 * On-device Ollama privacy-focused conversational workspace.
 * Guaranteed offline operation: prompts never leave the local machine,
 * cannot manipulate scene geometry unprompted, and remain unlogged.
 */
export function LocalChatPanel({
  open,
  engineReady,
  profile,
  genderModel,
}: LocalChatPanelProps) {
  const localStore = useLocalChatStore();
  const { model, models, status, statusDetail, messages, pendingId } = localStore;

  const organRegistry = useSceneStore((state) => state.organs);
  const hiddenSystems = useSceneStore((state) => state.hiddenSystems);
  const selectedOrganIds = useSceneStore((state) => state.selectedOrganIds);

  const [promptText, setPromptText] = useState("");
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const activeModelsRequestId = useRef<string | null>(null);

  // Build index over structures that are currently loaded and not hidden
  const searchableLatinIndex = useMemo(
    () =>
      latinIndex(
        Object.values(organRegistry).filter((org) => !hiddenSystems.includes(org.system))
      ),
    [organRegistry, hiddenSystems]
  );

  const [isSubscribedToEngine, setIsSubscribedToEngine] = useState(false);
  const [isReadyToListen, setIsReadyToListen] = useState(false);

  useEffect(() => {
    if (open) {
      setIsSubscribedToEngine(true);
    }
  }, [open]);

  useEffect(() => {
    if (!isSubscribedToEngine) return;

    let cleanupListener: (() => void) | undefined;
    let isCancelled = false;

    void onEngineEvent((event) => {
      if (!("request_id" in event) || typeof event.request_id !== "string") return;
      const reqId = event.request_id;
      if (!reqId.startsWith(LOCAL_REQUEST_PREFIX)) return;

      const storeState = useLocalChatStore.getState();

      switch (event.type) {
        case "local_models":
          if (reqId === activeModelsRequestId.current) {
            storeState.receiveModels(event.running, event.models);
          }
          break;
        case "text_delta":
          if (reqId === storeState.pendingId) {
            storeState.append(reqId, event.text);
          }
          break;
        case "done":
          if (reqId === storeState.pendingId) {
            storeState.finish(reqId, event.model);
          }
          break;
        case "error":
          if (reqId === activeModelsRequestId.current) {
            storeState.setStatus("error", event.message);
          } else if (reqId === storeState.pendingId) {
            storeState.fail(reqId, event.message);
          }
          break;
      }
    }).then((unsub) => {
      if (isCancelled) {
        unsub();
        return;
      }
      cleanupListener = unsub;
      setIsReadyToListen(true);
    });

    return () => {
      isCancelled = true;
      cleanupListener?.();
      setIsReadyToListen(false);
    };
  }, [isSubscribedToEngine]);

  const pollModels = () => {
    const id = `${LOCAL_REQUEST_PREFIX}models-${newRequestId()}`;
    activeModelsRequestId.current = id;
    useLocalChatStore.getState().setStatus("checking");
    void listLocalModels({ request_id: id }).catch((err: unknown) =>
      useLocalChatStore.getState().setStatus("error", String(err))
    );
  };

  useEffect(() => {
    if (open && engineReady && isReadyToListen) {
      pollModels();
    }
  }, [open, engineReady, isReadyToListen]);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 120) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  const isModelOperational =
    isReadyToListen && engineReady && status === "running" && model !== null;
  const canSubmitQuery =
    isModelOperational && promptText.trim().length > 0 && pendingId === null;

  const handleSendQuery = () => {
    const trimmed = promptText.trim();
    if (!canSubmitQuery || !model) return;

    const reqId = `${LOCAL_REQUEST_PREFIX}${newRequestId()}`;
    const selectedOrgansSummary: OrganContext[] = selectedOrganIds
      .map((id) => organRegistry[id])
      .filter((o): o is NonNullable<typeof o> => Boolean(o))
      .slice(0, 64)
      .map(({ organ_id, ta2_latin, name_en, system }) => ({
        organ_id,
        ta2_latin,
        name_en,
        system,
      }));

    const conversationHistory = extractConversationHistory(messages);
    localStore.begin(reqId, trimmed);
    setPromptText("");

    void askLocal({
      request_id: reqId,
      query: trimmed.slice(0, 8000),
      history: conversationHistory,
      model,
      profile,
      gender_model: genderModel,
      selection: selectedOrgansSummary,
    }).catch((err: unknown) =>
      useLocalChatStore.getState().fail(reqId, String(err))
    );
  };

  const handleCancelGeneration = () => {
    if (!pendingId) return;
    void cancelRequest(pendingId);
    localStore.fail(pendingId, "Stopped.");
  };

  const handleIsolateMention = (item: Mention) => {
    const apply = useSceneStore.getState().applyCommand;
    apply({ action: "isolate_structures", organ_ids: item.organIds.slice(0, 64) });
    if (item.organIds[0]) {
      apply({ action: "focus_organ", organ_id: item.organIds[0] });
    }
  };

  return (
    <section
      aria-label="Local model"
      aria-hidden={!open}
      className={open ? "absolute inset-0 z-20 flex flex-col bg-slate-950" : "hidden"}
    >
      <header className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-slate-800 px-3 py-2">
        <button
          type="button"
          onClick={() => localStore.setOpen(false)}
          className="whitespace-nowrap rounded border border-slate-700 px-1.5 py-0.5 text-[10px] text-slate-300 hover:border-sky-700 hover:text-sky-200"
          title="Back to the tutor — its conversation is where you left it"
        >
          ← Tutor
        </button>
        <h2 className="text-sm font-semibold tracking-tight text-slate-100">Local</h2>
        <span className="whitespace-nowrap rounded-full bg-violet-500/15 px-1.5 py-0.5 text-[9px] font-medium uppercase text-violet-300">
          on this computer
        </span>

        <div className="ml-auto flex min-w-0 items-center gap-1.5">
          <label className="sr-only" htmlFor="local-model">
            Local model
          </label>
          <select
            id="local-model"
            value={model ?? ""}
            disabled={models.length === 0 || pendingId !== null}
            onChange={(e) => localStore.setModel(e.target.value)}
            className="min-w-0 max-w-40 truncate rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-[11px] text-slate-200 disabled:opacity-50"
          >
            {models.length === 0 && <option value="">No model</option>}
            {models.map((entry) => (
              <option key={entry.name} value={entry.name}>
                {[entry.name, entry.parameter_size, formatGigabytes(entry.size_bytes)]
                  .filter(Boolean)
                  .join(" · ")}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={pollModels}
            disabled={!isReadyToListen || !engineReady || status === "checking"}
            className="whitespace-nowrap rounded border border-slate-700 px-1.5 py-0.5 text-[10px] text-slate-400 hover:text-slate-200 disabled:opacity-40"
            title="Ask Ollama again which models it has"
          >
            {status === "checking" ? "Checking…" : "Check"}
          </button>

          <button
            type="button"
            onClick={localStore.clear}
            disabled={messages.length === 0 || pendingId !== null}
            className="whitespace-nowrap rounded border border-slate-700 px-1.5 py-0.5 text-[10px] text-slate-400 hover:text-slate-200 disabled:opacity-40"
          >
            New
          </button>
        </div>
      </header>

      <StatusLineIndicator
        engineReady={engineReady}
        status={status}
        detail={statusDetail}
        empty={models.length === 0}
      />

      <div ref={scrollContainerRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-3">
        {messages.length === 0 && (
          <div className="mx-auto max-w-sm space-y-2 pt-6 text-center text-xs text-slate-500">
            <p className="text-slate-300">Chat with a model running in Ollama on this computer.</p>
            <p>Nothing you write here is sent anywhere else, and no key is needed.</p>
            <p>
              Words only — it cannot move the atlas. When it names a structure the atlas has, a
              button appears under the answer to show it.
            </p>
            <p className="text-amber-300/80">
              Local models make more mistakes than the large ones. Check anything that matters.
            </p>
            <p className="text-[10px] text-slate-600">Not saved to your journal.</p>
          </div>
        )}

        {messages.map((msg) => (
          <LocalDialogueBubble
            key={msg.id}
            message={msg}
            index={searchableLatinIndex}
            onShow={handleIsolateMention}
          />
        ))}
      </div>

      <div className="border-t border-slate-800 p-2">
        <div className="flex items-end gap-2 rounded-lg border border-slate-700 bg-slate-900/60 p-2 focus-within:border-violet-700">
          <textarea
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendQuery();
              }
            }}
            rows={2}
            maxLength={8000}
            disabled={!isModelOperational}
            placeholder={isModelOperational ? "Ask the local model…" : "Waiting for Ollama…"}
            className="min-h-10 flex-1 resize-none bg-transparent text-[13px] text-slate-100 placeholder:text-slate-600 focus:outline-none disabled:opacity-50"
          />

          {pendingId ? (
            <button
              type="button"
              onClick={handleCancelGeneration}
              className="rounded bg-slate-700 px-3 py-1 text-xs text-slate-100 hover:bg-slate-600"
            >
              Stop
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSendQuery}
              disabled={!canSubmitQuery}
              className="rounded bg-violet-600 px-3 py-1 text-xs text-white hover:bg-violet-500 disabled:opacity-40"
            >
              Send
            </button>
          )}
        </div>
        <p className="mt-1 text-[10px] text-slate-600">
          Educational use only — not for diagnosis or treatment. Runs in Ollama on this computer.
        </p>
      </div>
    </section>
  );
}

interface StatusLineIndicatorProps {
  engineReady: boolean;
  status: string;
  detail: string | null;
  empty: boolean;
}

function StatusLineIndicator({
  engineReady,
  status,
  detail,
  empty,
}: StatusLineIndicatorProps) {
  let messageText: string | null = null;

  if (!engineReady) {
    messageText = "The engine is not running — restart it from the tutor's panel.";
  } else if (status === "absent") {
    messageText =
      "Ollama is not running on this computer. Install it from ollama.com or start it, then press Check.";
  } else if (status === "error") {
    messageText = detail ?? "Ollama could not be asked for its models.";
  } else if (status === "running" && empty) {
    messageText =
      "Ollama has no chat model yet. Pull one — for example: ollama pull gemma3:4b — then press Check.";
  }

  if (!messageText) return null;

  return (
    <p
      role="status"
      className="border-b border-amber-900/40 bg-amber-500/10 px-3 py-1.5 text-[11px] text-amber-200"
    >
      {messageText}
    </p>
  );
}

interface LocalDialogueBubbleProps {
  message: LocalMessage;
  index: ReadonlyMap<string, Mention>;
  onShow: (mention: Mention) => void;
}

function LocalDialogueBubble({
  message,
  index,
  onShow,
}: LocalDialogueBubbleProps) {
  const recognizedMentions = useMemo(
    () =>
      message.role === "assistant" && message.status === "done"
        ? mentionedStructures(message.content, index)
        : [],
    [message.role, message.status, message.content, index]
  );

  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-lg rounded-br-sm bg-violet-600/20 px-3 py-2 text-[13px] text-slate-100">
          {message.content}
        </div>
      </div>
    );
  }

  if (message.status === "error") {
    return (
      <div className="rounded-lg rounded-bl-sm border border-amber-900/50 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-200">
        {message.error}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="rounded-lg rounded-bl-sm bg-slate-900/70 px-3 py-2">
        {message.content.trim().length === 0 ? (
          <span className="inline-flex gap-1 py-1" aria-label="Thinking">
            {[0, 1, 2].map((dot) => (
              <span
                key={dot}
                className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-500"
                style={{ animationDelay: `${dot * 160}ms` }}
              />
            ))}
          </span>
        ) : (
          <Markdown>{message.content}</Markdown>
        )}

        {recognizedMentions.length > 0 && (
          <div className="mt-2 border-t border-slate-800 pt-2">
            <p className="mb-1 text-[10px] uppercase tracking-wider text-slate-500">
              Show in the atlas
            </p>
            <div className="flex flex-wrap gap-1">
              {recognizedMentions.map((mention) => (
                <button
                  key={mention.latin}
                  type="button"
                  onClick={() => onShow(mention)}
                  className="rounded-full border border-violet-800/70 bg-violet-500/10 px-2 py-0.5 text-[11px] text-violet-200 hover:border-violet-500 hover:bg-violet-500/20"
                  title={`Isolate ${mention.latin} in the atlas`}
                >
                  {mention.latin}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {message.model && (
        <p className="text-[10px] text-slate-600">
          {message.model.replace(/^ollama:/, "")} · on this computer
        </p>
      )}
    </div>
  );
}
