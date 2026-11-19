import type { TokenUsage } from "@/lib/schemas";

/**
 * Calculates aggregate token consumption for prompt input and completion output.
 */
export function totalTokens(usage: Pick<TokenUsage, "input_tokens" | "output_tokens">): number {
  return usage.input_tokens + usage.output_tokens;
}

/**
 * Computes uncached billable tokens by subtracting cached context hits from input tokens.
 */
export function uncachedTokens(usage: TokenUsage): number {
  const billablePrompt = Math.max(0, usage.input_tokens - (usage.cache_read_tokens ?? 0));
  return billablePrompt + usage.output_tokens;
}

/** Threshold above which conversation context size warrants an advisory cost banner. */
export const LONG_CONVERSATION_TOKENS = 20_000;

/**
 * Determines whether the un-cached token footprint of a turn meets or exceeds the cost threshold.
 */
export function conversationIsCostly(usage: TokenUsage | null | undefined): boolean {
  if (!usage) return false;
  return uncachedTokens(usage) >= LONG_CONVERSATION_TOKENS;
}

/**
 * Formats token usage summaries for message headers, distinguishing between total and cached amounts.
 */
export function describeTurnCost(usage: TokenUsage): { label: string; detail: string } {
  const sumTokens = totalTokens(usage);
  const paidTokens = uncachedTokens(usage);
  const cachedContext = usage.cache_read_tokens ?? 0;

  const detail =
    cachedContext > 0
      ? `${formatTokens(usage.input_tokens)} of context sent, ${formatTokens(
          cachedContext,
        )} of it re-read from the provider's cache at a reduced rate · ${formatTokens(
          usage.output_tokens,
        )} received`
      : `${formatTokens(usage.input_tokens)} sent · ${formatTokens(
          usage.output_tokens,
        )} received`;

  const label =
    paidTokens < sumTokens
      ? `${formatTokens(paidTokens)} of ${formatTokens(sumTokens)} tokens`
      : `${formatTokens(sumTokens)} tokens`;

  return { label, detail };
}

/**
 * Converts numeric token quantities into formatted strings (e.g. 1,240, 12.4k, 1.2M).
 */
export function formatTokens(count: number): string {
  if (!Number.isFinite(count) || count < 0) return "0";
  const integerVal = Math.round(count);

  if (integerVal < 10_000) {
    return integerVal.toLocaleString("en-US");
  }
  if (integerVal < 1_000_000) {
    return `${sanitizeMetric(integerVal / 1_000)}k`;
  }
  return `${sanitizeMetric(integerVal / 1_000_000)}M`;
}

/** Strips unneeded single zero decimals so 14.0k formats as 14k. */
function sanitizeMetric(metric: number): string {
  return metric.toFixed(1).replace(/\.0$/, "");
}
