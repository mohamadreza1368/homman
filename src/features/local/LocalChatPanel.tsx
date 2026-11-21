import { useMemo, useRef } from "react";
import { Markdown } from "@/features/chat/Markdown";
import type { GenderModel, UserProfile } from "@/lib/schemas";
import { useLocalChatStore } from "@/stores/localChatStore";
import { useSceneStore } from "@/stores/sceneStore";
import { latinIndex, mentionedStructures } from "./mentions";
import { useOllamaSession } from "./useOllamaSession";

interface LocalChatPanelProps {
  open: boolean;
  engineReady: boolean;
  profile: UserProfile;
  genderModel: GenderModel;
}

export function LocalChatPanel({
  open,
  engineReady,
  profile,
  genderModel,
}: LocalChatPanelProps) {
  const session = useOllamaSession({ open, engineReady, profile, genderModel });
  const {
    model,
    models,
    status,
    messages,
    pendingId,
    inputQuery,
    setInputQuery,
    submitTurn,
    cancelTurn,
  } = session;

  const organs = useSceneStore((s) => s.organs);
  const scrollRef = useRef<HTMLDivElement>(null);

  const availableIndex = useMemo(
    () => (open ? latinIndex(Object.values(organs)) : new Map()),
    [open, organs],
  );

  if (!open) return null;

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100 border-l border-slate-800">
      {/* Privacy Disclosures & Status Banner */}
      <header className="p-3 bg-slate-950/60 border-b border-slate-800/80 text-xs text-slate-400 space-y-1">
        <div className="font-semibold text-slate-200 flex items-center justify-between">
          <span>حالت گفتگوی محلی (Ollama)</span>
          <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/20">
            Offline
          </span>
        </div>
        <p>Nothing you write here is sent anywhere else, and no key is needed.</p>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-400">
          <span>Words only — it cannot move the atlas.</span>
          <span>Local models make more mistakes than the large ones.</span>
          <span>Not saved to your journal.</span>
        </div>

        {status === "absent" && (
          <div role="status" className="p-2 bg-amber-500/10 border border-amber-500/20 rounded text-amber-300 mt-2">
            Ollama is not running. Start it to use models on this computer.
          </div>
        )}
      </header>

      {/* Model Selector */}
      {status === "running" && models.length > 0 && (
        <div className="px-3 py-2 border-b border-slate-800/60 flex items-center gap-2 text-xs">
          <label htmlFor="model-select" className="text-slate-400">مدل فعال:</label>
          <select
            id="model-select"
            value={model ?? ""}
            onChange={(e) => useLocalChatStore.getState().setModel(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs focus:outline-none"
          >
            {models.map((m) => (
              <option key={m.name} value={m.name}>
                {m.name} {m.parameter_size ? `(${m.parameter_size})` : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Conversation Thread */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => {
          const isUser = msg.role === "user";

          if (isUser) {
            return (
              <div key={msg.id} className="flex justify-end">
                <div className="max-w-[85%] whitespace-pre-wrap rounded-lg bg-sky-600 px-3 py-2 text-sm text-white">
                  {msg.content}
                </div>
              </div>
            );
          }

          if (msg.status === "error") {
            return (
              <div key={msg.id} className="max-w-[85%] rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
                {msg.error || "Generation error"}
              </div>
            );
          }

          const mentions = msg.status === "done" ? mentionedStructures(msg.content, availableIndex) : [];

          return (
            <div key={msg.id} className="flex flex-col items-start space-y-2">
              <div className="max-w-[85%] rounded-lg bg-slate-800 border border-slate-700/60 p-3 text-sm text-slate-200 leading-relaxed">
                <Markdown>{msg.content || ""}</Markdown>
                {msg.status === "done" && msg.model && (
                  <p className="mt-2 text-[10px] text-slate-400">
                    {msg.model} · on this computer
                  </p>
                )}
              </div>

              {/* Mentioned Organ Navigation Buttons */}
              {mentions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 max-w-[85%]">
                  {mentions.map((item) => (
                    <button
                      key={item.latin}
                      type="button"
                      onClick={() => {
                        useSceneStore.setState({
                          isolatedOrganIds: item.organIds,
                          selectedOrganIds: item.organIds,
                        });
                      }}
                      className="text-xs bg-slate-800 hover:bg-sky-900/50 text-sky-300 border border-sky-500/30 rounded px-2 py-0.5 transition-colors"
                    >
                      {item.latin}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Composer Input Area */}
      <footer className="p-3 bg-slate-950/80 border-t border-slate-800">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitTurn();
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            placeholder="Ask the local model…"
            disabled={status !== "running" || pendingId !== null}
            className="flex-1 bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500"
          />
          {pendingId !== null ? (
            <button
              type="button"
              onClick={cancelTurn}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-medium"
            >
              Cancel
            </button>
          ) : (
            <button
              type="submit"
              disabled={status !== "running" || !inputQuery.trim()}
              className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white rounded text-xs font-medium"
            >
              Send
            </button>
          )}
        </form>
      </footer>
    </div>
  );
}
