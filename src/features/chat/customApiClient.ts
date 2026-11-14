import type {
  GenderModel,
  OrganContext,
  SceneCommand,
  SessionMode,
  TokenUsage,
  UserProfile,
} from "@/lib/schemas";
import { normalizeBaseUrl } from "@/stores/customApiConfig";
import {
  convertToolCallToCommand,
  HOOMAAN_ANATOMY_TOOLS,
  HOOMAAN_CASE_TOOL,
} from "./hoomaanTools";

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
  mode?: SessionMode;
  enableTools?: boolean;
  signal?: AbortSignal;
  onDelta?: (chunk: string) => void;
  onToolStarted?: (tool: string) => void;
  onSceneCommand?: (command: SceneCommand) => void;
  onCaseVerdict?: (score: number, verdict: string) => void;
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
      ? "کاربر عمومی و علاقه‌مند (توضیحات روان، واضح و قابل درک بدون ابهام پزشکی)"
      : input.profile === "clinician"
        ? "پزشک / متخصص بالینی (عمق علمی بالا، روابط پاتوفیزیولوژی، آناتومی کاربردی و جراحی)"
        : "دانشجوی پزشکی و علوم زیستی (تمرکز بر کالبدشناسی تشریحی، نام‌گذاری لاتین و جزئیات دقیق)";

  const selectedList =
    input.selection.length > 0
      ? input.selection
          .map((o) => `${o.ta2_latin} (${o.name_en}, system: ${o.system})`)
          .join("; ")
      : "هیچ عضوی انتخاب نشده است";

  const modeNote =
    input.mode === "case"
      ? "شما در حالت شبیه‌ساز کیس بالینی فرضی هستید (Case Drill). شرح حال، علائم و معاینات بالینی یک بیمار آموزشی را طرح کنید یا به استدلال دانشجو پاسخ دهید و در پایان ارزیابی، ابزار record_case_verdict را با نمره (0-100) و نظر نهایی فراخوانی کنید."
      : input.mode === "review"
        ? "شما در حالت مرور و جمع‌بندی مفاهیم کلیدی آناتومی هستید."
        : "شما دستیار و راهنمای تعاملی کالبدشناسی سه‌بعدی هوومان (HOOMAAN) هستید.";

  const languageRule = input.fa
    ? [
        "زبان پاسخ: کاملاً فارسی روان و علمی.",
        "نام‌گذاری: اصطلاحات استاندارد بین‌المللی Terminologia Anatomica (لاتین) را داخل پرانتز ذکر کنید.",
      ].join(" ")
    : "Respond in the user's language, including official Terminologia Anatomica terms where helpful.";

  const toolsGuidance = [
    "دستورالعمل تعامل با صحنه سه‌بعدی هوومان:",
    "۱. هنگام نام بردن یا توضیح هر ساختار آناتومیک مهم، ابزار مناسب (مانند focus_organ برای زوم دوربین یا illuminate_structures برای هایلایت) را فراخوانی کنید تا مدل سه‌بعدی همگام با توضیح شما حرکت کند.",
    "۲. در متن پاسخ خود، همیشه شناسه هر عضو مهم را در براکت دوتایی [[organ_slug]] قرار دهید (مانند [[heart]]، [[liver]]، [[ventriculus_sinister]]، [[aorta]]). این کار باعث می‌شود واژه به صورت پین تعاملی سه‌بعدی در رابط کاربری درآید که کاربر با هاور یا کلیک روی آن مستقیماً به عضو مربوطه هدایت می‌شود.",
    "۳. برای مسیرهای پیوسته (مانند مسیر گردش خون، دستگاه گوارش یا هدایت قلبی) از highlight_pathway استفاده کنید.",
    "۴. برای بررسی مقاطع داخلی از set_cross_section و برای ریتم ضربان قلب از set_heart_rhythm استفاده کنید.",
  ].join("\n");

  return [
    `شما هوومان (HOOMAAN) هستید؛ دستیار هوشمند و تعاملی اطلس سه‌بعدی کالبدشناسی انسان. ${modeNote}`,
    "قانون ایمنی اکید: این نرم‌افزار صرفاً برای اهداف آموزشی و یادگیری کالبدشناسی است. شما وسیله پزشکی نیستید و نباید بیماران واقعی را تشخیص داده یا درمان تجویز کنید.",
    `سطح مخاطب: ${level}.`,
    `اطلس فعال: مدل ${input.genderModel} (شامل ${input.organCount} ساختار آناتومیک لود شده).`,
    `اعضای در حال حاضر انتخاب شده: ${selectedList}.`,
    languageRule,
    toolsGuidance,
  ].join("\n\n");
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

interface AccumulatedToolCall {
  id: string;
  name: string;
  arguments: string;
}

/**
 * Execute tool calls and dispatch them to the HOOMAAN scene store and callbacks.
 */
function dispatchToolCalls(
  toolCalls: AccumulatedToolCall[],
  params: CustomChatParams,
): void {
  for (const tc of toolCalls) {
    if (!tc.name) continue;
    let parsedArgs: Record<string, unknown> = {};
    try {
      if (tc.arguments.trim()) {
        parsedArgs = JSON.parse(tc.arguments) as Record<string, unknown>;
      }
    } catch {
      // If incomplete JSON, fall back to empty args
    }

    const conversion = convertToolCallToCommand(tc.name, parsedArgs);
    if (conversion.command) {
      params.onToolStarted?.(conversion.rawToolName);
      params.onSceneCommand?.(conversion.command);
    }
    if (conversion.verdict) {
      params.onCaseVerdict?.(conversion.verdict.score, conversion.verdict.verdict);
    }
  }
}

/** Stream or fetch a chat completion with full 3D Tool Calling from any OpenAI-compatible Custom API. */
export async function streamCustomChat(params: CustomChatParams): Promise<CustomChatResult> {
  const root = normalizeBaseUrl(params.baseUrl);
  if (!root) throw new Error("آدرس Custom API تنظیم نشده است.");
  const modelId = params.model.trim();
  if (!modelId) throw new Error("نام مدل Custom API وارد نشده است.");

  const tools =
    params.enableTools !== false
      ? [...HOOMAAN_ANATOMY_TOOLS, ...(params.mode === "case" ? [HOOMAAN_CASE_TOOL] : [])]
      : undefined;

  const messages: Array<{ role: string; content: string | null; tool_calls?: unknown; tool_call_id?: string }> = [
    { role: "system", content: params.systemPrompt },
    ...params.history.map((turn) => ({ role: turn.role, content: turn.content })),
    { role: "user", content: params.query },
  ];

  const requestBody: Record<string, unknown> = {
    model: modelId,
    messages,
    stream: true,
  };

  if (tools && tools.length > 0) {
    requestBody.tools = tools;
    requestBody.tool_choice = "auto";
  }

  const response = await fetch(`${root}/chat/completions`, {
    method: "POST",
    headers: authHeaders(params.apiKey),
    ...(params.signal ? { signal: params.signal } : {}),
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`خطای سرور Custom API (${response.status}): ${detail.slice(0, 300) || response.statusText}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  let fullText = "";
  let resolvedModel = modelId;
  let usage: TokenUsage | null = null;
  const accumulatedToolCalls: Map<number, AccumulatedToolCall> = new Map();

  // Non-streaming fallback
  if (!contentType.includes("text/event-stream") || !response.body) {
    const json = (await response.json()) as {
      model?: string;
      choices?: Array<{
        message?: {
          content?: string;
          tool_calls?: Array<{
            id?: string;
            function?: { name?: string; arguments?: string };
          }>;
        };
        text?: string;
      }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };

    const choice = json.choices?.[0];
    const text = choice?.message?.content ?? choice?.text ?? "";
    if (text) {
      fullText = text;
      params.onDelta?.(text);
    }
    resolvedModel = json.model || modelId;
    if (json.usage) {
      usage = {
        input_tokens: json.usage.prompt_tokens ?? 0,
        output_tokens: json.usage.completion_tokens ?? 0,
        cache_read_tokens: 0,
      };
    }

    if (choice?.message?.tool_calls && Array.isArray(choice.message.tool_calls)) {
      const executed: AccumulatedToolCall[] = choice.message.tool_calls.map((tc, idx) => ({
        id: tc.id || `call_${idx}`,
        name: tc.function?.name || "",
        arguments: tc.function?.arguments || "{}",
      }));
      dispatchToolCalls(executed, params);
    }

    return { text: fullText, model: resolvedModel, usage };
  }

  // SSE Streaming
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
          choices?: Array<{
            delta?: {
              content?: string;
              tool_calls?: Array<{
                index?: number;
                id?: string;
                function?: { name?: string; arguments?: string };
              }>;
            };
            message?: { content?: string };
          }>;
          usage?: { prompt_tokens?: number; completion_tokens?: number };
        };

        if (chunk.model) resolvedModel = chunk.model;

        const delta = chunk.choices?.[0]?.delta;
        if (delta?.content) {
          fullText += delta.content;
          params.onDelta?.(delta.content);
        }

        if (delta?.tool_calls && Array.isArray(delta.tool_calls)) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0;
            const existing = accumulatedToolCalls.get(idx) ?? {
              id: tc.id || `call_${idx}`,
              name: tc.function?.name || "",
              arguments: "",
            };
            if (tc.id) existing.id = tc.id;
            if (tc.function?.name) existing.name = tc.function.name;
            if (tc.function?.arguments) existing.arguments += tc.function.arguments;
            accumulatedToolCalls.set(idx, existing);
          }
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

  const toolCallsList = Array.from(accumulatedToolCalls.values());
  if (toolCallsList.length > 0) {
    dispatchToolCalls(toolCallsList, params);

    // If the model produced tool calls but no natural language response,
    // trigger a follow-up completion round so it generates its conversational explanation.
    if (fullText.trim() === "") {
      try {
        const followUpMessages = [
          ...messages,
          {
            role: "assistant",
            content: null,
            tool_calls: toolCallsList.map((tc) => ({
              id: tc.id,
              type: "function",
              function: { name: tc.name, arguments: tc.arguments },
            })),
          },
          ...toolCallsList.map((tc) => ({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify({ status: "success", executed: tc.name }),
          })),
        ];

        const followUpResponse = await fetch(`${root}/chat/completions`, {
          method: "POST",
          headers: authHeaders(params.apiKey),
          ...(params.signal ? { signal: params.signal } : {}),
          body: JSON.stringify({
            model: modelId,
            messages: followUpMessages,
            stream: true,
          }),
        });

        if (followUpResponse.ok && followUpResponse.body) {
          const followReader = followUpResponse.body.getReader();
          let followBuffer = "";
          while (true) {
            const { done, value } = await followReader.read();
            if (done) break;
            followBuffer += decoder.decode(value, { stream: true });
            const followLines = followBuffer.split(/\r?\n/);
            followBuffer = followLines.pop() ?? "";

            for (const rLine of followLines) {
              const l = rLine.trim();
              if (!l || !l.startsWith("data:")) continue;
              const d = l.slice(5).trim();
              if (d === "[DONE]") continue;
              try {
                const c = JSON.parse(d) as {
                  choices?: Array<{ delta?: { content?: string } }>;
                };
                const chunkText = c.choices?.[0]?.delta?.content;
                if (chunkText) {
                  fullText += chunkText;
                  params.onDelta?.(chunkText);
                }
              } catch {
                // Ignore frame parse error
              }
            }
          }
        }
      } catch (err) {
        console.warn("Follow-up completion after tool calls failed:", err);
      }
    }
  }

  return { text: fullText, model: resolvedModel, usage };
}
