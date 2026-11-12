import type {
  GenderModel,
  OrganContext,
  SessionMode,
  TokenUsage,
  UserProfile,
} from "@/lib/schemas";
import { normalizeBaseUrl } from "@/stores/customApiConfig";

export interface CustomHistoryTurn {
  role: "user" | "assistant";
  content: string;
}

export interface CustomChatParams {
  baseUrl: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
  history: CustomHistoryTurn[];
  query: string;
  signal?: AbortSignal;
  onDelta?: (chunk: string) => void;
}

export interface CustomChatResult {
  text: string;
  model: string;
  usage: TokenUsage | null;
}

/** Build an educational anatomy system prompt from the live 3D viewer context. */
export function buildCustomSystemPrompt(input: {
  fa: boolean;
  profile: UserProfile;
  genderModel: GenderModel;
  mode: SessionMode;
  selection: OrganContext[];
  organCount: number;
}): string {
  const level =
    input.profile === "layperson"
      ? "general learner (clear, accessible explanations)"
      : input.profile === "clinician"
        ? "advanced clinical & anatomical depth"
        : "medical / health sciences student";

  const selectedList =
    input.selection.length > 0
      ? input.selection
          .map((o) => `${o.ta2_latin} (${o.name_en}, system: ${o.system})`)
          .join("; ")
      : "none selected";

  const modeNote =
    input.mode === "case"
      ? "You are running a simulated educational anatomy/clinical case drill for practice (purely fictional scenario)."
      : input.mode === "review"
        ? "You are summarising key anatomical concepts and reasoning gaps for study review."
        : "You are an interactive 3D human anatomy study tutor.";

  const languageRule = input.fa
    ? "Respond clearly in natural Persian (فارسی) unless the user writes in another language, keeping official Terminologia Anatomica Latin terms in parentheses where helpful."
    : "Respond in the user's language, including Terminologia Anatomica terms where helpful.";

  return [
    `You are HOOMAAN (هومان), an educational 3D anatomy assistant. ${modeNote}`,
    "Strict boundary: educational use only — you are NOT a medical device and must decline diagnosing or advising real patients.",
    `Target depth: ${level}.`,
    `Active atlas: ${input.genderModel} model (${input.organCount} loaded structures).`,
    `Currently selected structures: ${selectedList}.`,
    languageRule,
  ].join("\n");
}

function authHeaders(apiKey: string): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const cleanKey = apiKey.trim();
  if (cleanKey) headers.Authorization = `Bearer ${cleanKey}`;
  return headers;
}

/** Fetch available models from an OpenAI-compatible `/models` endpoint. */
export async function fetchCustomModels(
  baseUrl: string,
  apiKey: string,
  signal?: AbortSignal,
): Promise<string[]> {
  const root = normalizeBaseUrl(baseUrl);
  if (!root) throw new Error("Custom API Base URL is empty.");

  const response = await fetch(`${root}/models`, {
    method: "GET",
    headers: authHeaders(apiKey),
    ...(signal ? { signal } : {}),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`HTTP ${response.status}: ${detail.slice(0, 200) || response.statusText}`);
  }

  const payload = (await response.json()) as {
    data?: Array<{ id?: unknown }>;
    models?: Array<{ id?: unknown; name?: unknown }>;
  };

  const list = Array.isArray(payload.data)
    ? payload.data.map((m) => (typeof m?.id === "string" ? m.id : "")).filter(Boolean)
    : Array.isArray(payload.models)
      ? payload.models
          .map((m) => (typeof m?.id === "string" ? m.id : typeof m?.name === "string" ? m.name : ""))
          .filter(Boolean)
      : [];

  return [...new Set(list)];
}

/** Stream or fetch a chat completion from any OpenAI-compatible Custom API. */
export async function streamCustomChat(params: CustomChatParams): Promise<CustomChatResult> {
  const root = normalizeBaseUrl(params.baseUrl);
  if (!root) throw new Error("آدرس Custom API تنظیم نشده است.");
  const modelId = params.model.trim();
  if (!modelId) throw new Error("نام مدل Custom API وارد نشده است.");

  const messages = [
    { role: "system", content: params.systemPrompt },
    ...params.history.map((turn) => ({ role: turn.role, content: turn.content })),
    { role: "user", content: params.query },
  ];

  const response = await fetch(`${root}/chat/completions`, {
    method: "POST",
    headers: authHeaders(params.apiKey),
    ...(params.signal ? { signal: params.signal } : {}),
    body: JSON.stringify({
      model: modelId,
      messages,
      stream: true,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`خطای سرور Custom API (${response.status}): ${detail.slice(0, 300) || response.statusText}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  let fullText = "";
  let resolvedModel = modelId;
  let usage: TokenUsage | null = null;

  if (!contentType.includes("text/event-stream") || !response.body) {
    const json = (await response.json()) as {
      model?: string;
      choices?: Array<{ message?: { content?: string }; text?: string }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const text = json.choices?.[0]?.message?.content ?? json.choices?.[0]?.text ?? "";
    if (text) params.onDelta?.(text);
    resolvedModel = json.model || modelId;
    if (json.usage) {
      usage = {
        input_tokens: json.usage.prompt_tokens ?? 0,
        output_tokens: json.usage.completion_tokens ?? 0,
        cache_read_tokens: 0,
      };
    }
    return { text, model: resolvedModel, usage };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || !line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (data === "[DONE]") continue;
      try {
        const chunk = JSON.parse(data) as {
          model?: string;
          choices?: Array<{ delta?: { content?: string }; message?: { content?: string } }>;
          usage?: { prompt_tokens?: number; completion_tokens?: number };
        };
        if (chunk.model) resolvedModel = chunk.model;
        const delta = chunk.choices?.[0]?.delta?.content ?? chunk.choices?.[0]?.message?.content ?? "";
        if (delta) {
          fullText += delta;
          params.onDelta?.(delta);
        }
        if (chunk.usage) {
          usage = {
            input_tokens: chunk.usage.prompt_tokens ?? 0,
            output_tokens: chunk.usage.completion_tokens ?? 0,
            cache_read_tokens: 0,
          };
        }
      } catch {
        // Ignore partial or non-JSON keep-alive frames.
      }
    }
  }

  return { text: fullText, model: resolvedModel, usage };
}
