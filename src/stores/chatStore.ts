import { z } from "zod";
import { create } from "zustand";

import { SceneCommandSchema } from "@/lib/schemas";
import type { SceneCommand, SessionMode, TokenUsage } from "@/lib/schemas";
import type { SessionDetail } from "@/lib/studyDb";

/**
 * Dialogue transcript and session state management for HOOMAAN AI clinical assistant.
 *
 * Tracks user prompts, streaming assistant responses, tool usage, executable scene commands,
 * and token consumption. Maintains independence from viewport rendering lifecycle so that
 * camera reframing does not mutate conversational context.
 */
export type MessageStatus = "streaming" | "complete" | "cancelled" | "error";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  tools: string[];
  commands?: SceneCommand[];
  status: MessageStatus;
  error?: string;
  usage?: TokenUsage;
  model?: string;
  score?: number;
}

export interface CompletedTurn {
  question: string;
  answer: string;
  model?: string;
  usage?: TokenUsage;
  commands?: string;
}

interface ChatState {
  messages: ChatMessage[];
  pendingRequestId: string | null;
  sessionId: string;
  mode: SessionMode;
  sessionRevision: number;

  startTurn: (requestId: string, prompt: string) => void;
  appendDelta: (requestId: string, text: string) => void;
  noteTool: (requestId: string, tool: string) => void;
  noteCommand: (requestId: string, command: SceneCommand) => void;
  finishTurn: (requestId: string, usage?: TokenUsage, model?: string) => void;
  failTurn: (requestId: string, message: string) => void;
  markCancelled: (requestId: string) => void;
  noteScore: (requestId: string, score: number) => void;

  beginSession: (mode: SessionMode) => void;
  loadSession: (detail: SessionDetail) => void;

  turn: (requestId: string) => CompletedTurn | null;
  history: () => { role: "user" | "assistant"; content: string }[];
}

let messageSeq = 0;
const generateMessageId = () => `m${++messageSeq}`;
const generateSessionUUID = () => crypto.randomUUID();

function deserializeSceneCommands(raw: string | undefined): { commands?: SceneCommand[] } {
  if (!raw) return {};
  try {
    const parsed = z.array(SceneCommandSchema).safeParse(JSON.parse(raw));
    return parsed.success && parsed.data.length > 0 ? { commands: parsed.data } : {};
  } catch {
    return {};
  }
}

function updateStreamingAssistant(
  messages: ChatMessage[],
  requestId: string,
  updater: (msg: ChatMessage) => ChatMessage,
): ChatMessage[] {
  let modified = false;
  const updatedList = messages.map((m) => {
    if (m.role !== "assistant" || m.id !== `a:${requestId}` || m.status !== "streaming") {
      return m;
    }
    modified = true;
    return updater(m);
  });
  return modified ? updatedList : messages;
}

export const useChatStore = create<ChatState>()((set, get) => ({
  messages: [],
  pendingRequestId: null,
  sessionId: generateSessionUUID(),
  mode: "tutor",
  sessionRevision: 0,

  startTurn: (requestId: string, prompt: string) =>
    set((state) => ({
      pendingRequestId: requestId,
      messages: [
        ...state.messages,
        {
          id: `u:${requestId}`,
          role: "user",
          content: prompt,
          tools: [],
          status: "complete",
        },
        {
          id: `a:${requestId}`,
          role: "assistant",
          content: "",
          tools: [],
          status: "streaming",
        },
      ],
    })),

  appendDelta: (requestId: string, text: string) =>
    set((state) => ({
      messages: updateStreamingAssistant(state.messages, requestId, (msg) => ({
        ...msg,
        content: msg.content + text,
      })),
    })),

  noteTool: (requestId: string, tool: string) =>
    set((state) => ({
      messages: updateStreamingAssistant(state.messages, requestId, (msg) => ({
        ...msg,
        tools: [...msg.tools, tool],
      })),
    })),

  noteCommand: (requestId: string, command: SceneCommand) =>
    set((state) => ({
      messages: updateStreamingAssistant(state.messages, requestId, (msg) => ({
        ...msg,
        commands: [...(msg.commands ?? []), command],
      })),
    })),

  finishTurn: (requestId: string, usage?: TokenUsage, model?: string) =>
    set((state) => ({
      pendingRequestId: state.pendingRequestId === requestId ? null : state.pendingRequestId,
      messages: updateStreamingAssistant(state.messages, requestId, (msg) => ({
        ...msg,
        status: msg.status === "streaming" ? "complete" : msg.status,
        ...(usage ? { usage } : {}),
        ...(model ? { model } : {}),
      })),
    })),

  failTurn: (requestId: string, message: string) =>
    set((state) => ({
      pendingRequestId: state.pendingRequestId === requestId ? null : state.pendingRequestId,
      messages: updateStreamingAssistant(state.messages, requestId, (msg) => ({
        ...msg,
        status: "error",
        error: message,
      })),
    })),

  markCancelled: (requestId: string) =>
    set((state) => ({
      pendingRequestId: state.pendingRequestId === requestId ? null : state.pendingRequestId,
      messages: updateStreamingAssistant(state.messages, requestId, (msg) => ({
        ...msg,
        status: "cancelled",
      })),
    })),

  noteScore: (requestId: string, score: number) =>
    set((state) => ({
      messages: updateStreamingAssistant(state.messages, requestId, (msg) => ({
        ...msg,
        score,
      })),
    })),

  beginSession: (mode: SessionMode) =>
    set((state) => ({
      messages: [],
      pendingRequestId: null,
      sessionId: generateSessionUUID(),
      mode,
      sessionRevision: state.sessionRevision + 1,
    })),

  loadSession: (detail: SessionDetail) =>
    set({
      sessionRevision: get().sessionRevision + 1,
      pendingRequestId: null,
      sessionId: detail.session.id,
      mode: detail.session.kind,
      messages: detail.messages.map((item) => ({
        id: generateMessageId(),
        role: item.role,
        content: item.content,
        tools: [],
        status: "complete" as const,
        ...deserializeSceneCommands(item.commands),
        ...(item.model ? { model: item.model } : {}),
        ...(item.input_tokens !== null && item.output_tokens !== null
          ? {
              usage: {
                input_tokens: item.input_tokens,
                output_tokens: item.output_tokens,
                cache_read_tokens: item.cache_read_tokens ?? 0,
              },
            }
          : {}),
      })),
    }),

  turn: (requestId: string) => {
    const list = get().messages;
    const userMsg = list.find((m) => m.id === `u:${requestId}`);
    const botMsg = list.find((m) => m.id === `a:${requestId}`);
    if (!userMsg || !botMsg) return null;
    if (botMsg.status !== "complete" || botMsg.content.trim().length === 0) return null;

    return {
      question: userMsg.content,
      answer: botMsg.content,
      ...(botMsg.model ? { model: botMsg.model } : {}),
      ...(botMsg.usage ? { usage: botMsg.usage } : {}),
      ...(botMsg.commands?.length ? { commands: JSON.stringify(botMsg.commands) } : {}),
    };
  },

  history: () => completeHistory(get().messages).slice(-100),
}));

export function completeHistory(
  messages: ChatMessage[],
): { role: "user" | "assistant"; content: string }[] {
  const result: { role: "user" | "assistant"; content: string }[] = [];
  for (let i = 0; i < messages.length - 1; i++) {
    const q = messages[i]!;
    const a = messages[i + 1]!;
    if (
      q.role === "user" &&
      a.role === "assistant" &&
      q.status === "complete" &&
      a.status === "complete" &&
      q.content.trim() &&
      a.content.trim()
    ) {
      result.push({ role: "user", content: q.content }, { role: "assistant", content: a.content });
      i++;
    }
  }
  return result;
}
