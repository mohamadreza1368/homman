import { create } from "zustand";
import { readLocal, writeLocal } from "@/lib/localStore";
import type { LocalModelInfo } from "@/lib/schemas";

const PERSISTED_MODEL_STORAGE_KEY = "hoomaan.localChat.model";

export interface LocalMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  status: "streaming" | "done" | "error";
  error?: string;
  model?: string;
}

export type OllamaStatus = "unknown" | "checking" | "running" | "absent" | "error";

interface LocalChatStoreInterface {
  open: boolean;
  model: string | null;
  models: LocalModelInfo[];
  status: OllamaStatus;
  statusDetail: string | null;
  messages: LocalMessage[];
  pendingId: string | null;

  setOpen: (isOpen: boolean) => void;
  setModel: (targetModel: string) => void;
  receiveModels: (isDaemonActive: boolean, catalog: LocalModelInfo[]) => void;
  setStatus: (nextStatus: OllamaStatus, detailInfo?: string | null) => void;
  begin: (correlationId: string, promptText: string) => void;
  append: (correlationId: string, chunk: string) => void;
  finish: (correlationId: string, resolvedModel: string | null) => void;
  fail: (correlationId: string, errorMessage: string) => void;
  clear: () => void;
}

export function preferredModel(
  availableModels: readonly LocalModelInfo[],
  previouslySelected: string | null
): string | null {
  const matchPrevious = availableModels.find((m) => m.name === previouslySelected);
  if (matchPrevious) return matchPrevious.name;

  const nonCoding = availableModels.find((m) => !/(?:coder|code\b)/i.test(m.name));
  return nonCoding ? nonCoding.name : availableModels[0]?.name ?? null;
}

function mutateMessage(
  list: LocalMessage[],
  targetId: string,
  transform: (entry: LocalMessage) => LocalMessage
): LocalMessage[] {
  return list.map((msg) => (msg.id === targetId ? transform(msg) : msg));
}

export const useLocalChatStore = create<LocalChatStoreInterface>()((set) => ({
  open: false,
  model: readLocal(PERSISTED_MODEL_STORAGE_KEY),
  models: [],
  status: "unknown",
  statusDetail: null,
  messages: [],
  pendingId: null,

  setOpen: (isOpen) => set({ open: isOpen }),

  setModel: (targetModel) => {
    writeLocal(PERSISTED_MODEL_STORAGE_KEY, targetModel);
    set({ model: targetModel });
  },

  receiveModels: (isDaemonActive, catalog) =>
    set((prev) => ({
      models: catalog,
      status: isDaemonActive ? "running" : "absent",
      statusDetail: null,
      model: preferredModel(catalog, prev.model),
    })),

  setStatus: (nextStatus, detailInfo = null) =>
    set({ status: nextStatus, statusDetail: detailInfo }),

  begin: (correlationId, promptText) =>
    set((prev) => {
      const userTurn: LocalMessage = {
        id: `${correlationId}:q`,
        role: "user",
        content: promptText,
        status: "done",
      };
      const assistantTurn: LocalMessage = {
        id: correlationId,
        role: "assistant",
        content: "",
        status: "streaming",
      };
      return {
        pendingId: correlationId,
        messages: prev.messages.concat([userTurn, assistantTurn]),
      };
    }),

  append: (correlationId, chunk) =>
    set((prev) => ({
      messages: mutateMessage(prev.messages, correlationId, (item) => ({
        ...item,
        content: item.content + chunk,
      })),
    })),

  finish: (correlationId, resolvedModel) =>
    set((prev) => ({
      pendingId: prev.pendingId === correlationId ? null : prev.pendingId,
      messages: mutateMessage(prev.messages, correlationId, (item) => ({
        ...item,
        status: "done",
        ...(resolvedModel ? { model: resolvedModel } : {}),
      })),
    })),

  fail: (correlationId, errorMessage) =>
    set((prev) => ({
      pendingId: prev.pendingId === correlationId ? null : prev.pendingId,
      messages: mutateMessage(prev.messages, correlationId, (item) => ({
        ...item,
        status: "error",
        content: "",
        error: errorMessage,
      })),
    })),

  clear: () => set({ messages: [], pendingId: null }),
}));
