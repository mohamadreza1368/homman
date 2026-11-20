/**
 * Usage Metering & Quota Tracking Engine
 *
 * Implemented strictly from specs/usage-quota-metering.md
 * Independent Clean-Room implementation for token aggregation,
 * cost estimation, and quota guardrails.
 */

export type QuotaStatus = 'normal' | 'warning' | 'exceeded' | 'unlimited';

export interface PricingRates {
  readonly promptCostPer1k: number;
  readonly completionCostPer1k: number;
}

export interface SessionUsageState {
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly totalTokens: number;
  readonly totalCostUsd: number;
  readonly dailyQuotaLimitTokens: number;
}

export interface QuotaEvaluation {
  readonly status: QuotaStatus;
  readonly percentageUsed: number;
  readonly isBlocked: boolean;
  readonly warningMessageFa?: string;
}

export const DEFAULT_PRICING_RATES: PricingRates = {
  promptCostPer1k: 0.0005,
  completionCostPer1k: 0.0015,
};

/**
 * Calculates financial cost of token batch based on per-thousand rates.
 */
export function calculateTurnCost(
  promptTokens: number,
  completionTokens: number,
  rates: PricingRates = DEFAULT_PRICING_RATES
): number {
  const safePrompt = Math.max(0, promptTokens);
  const safeCompletion = Math.max(0, completionTokens);

  const promptCost = (safePrompt / 1000) * rates.promptCostPer1k;
  const completionCost = (safeCompletion / 1000) * rates.completionCostPer1k;

  return Math.round((promptCost + completionCost) * 1e8) / 1e8;
}

/**
 * Converts English digits to Persian digits for localized UI notifications.
 */
export function toPersianDigits(input: number | string): string {
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(input).replace(/[0-9]/g, (d) => persianDigits[parseInt(d, 10)] ?? d);
}

/**
 * Evaluates current consumption against quota threshold.
 * 0 limit signifies unlimited quota.
 */
export function evaluateQuotaStatus(
  consumedTokens: number,
  dailyQuotaLimit: number
): QuotaEvaluation {
  const safeConsumed = Math.max(0, consumedTokens);

  if (dailyQuotaLimit <= 0) {
    return {
      status: 'unlimited',
      percentageUsed: 0,
      isBlocked: false,
    };
  }

  const ratio = safeConsumed / dailyQuotaLimit;
  const percentage = Math.round(ratio * 100);

  if (ratio >= 1.0) {
    return {
      status: 'exceeded',
      percentageUsed: percentage,
      isBlocked: true,
      warningMessageFa: 'سقف سهمیه روزانه مصرف توکن به پایان رسیده است.',
    };
  }

  if (ratio >= 0.9) {
    return {
      status: 'warning',
      percentageUsed: percentage,
      isBlocked: false,
      warningMessageFa: `هشدار: شما به ${toPersianDigits(percentage)}٪ از سقف سهمیه روزانه خود رسیده‌اید.`,
    };
  }

  return {
    status: 'normal',
    percentageUsed: percentage,
    isBlocked: false,
  };
}

/**
 * Initializes a clean session state.
 */
export function createInitialSessionUsage(dailyQuotaLimit: number = 0): SessionUsageState {
  return {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    totalCostUsd: 0,
    dailyQuotaLimitTokens: Math.max(0, dailyQuotaLimit),
  };
}

/**
 * Accumulates new tokens and returns updated immutable state. Clamps negatives.
 */
export function accumulateUsage(
  currentState: SessionUsageState,
  addedPrompt: number,
  addedCompletion: number,
  rates: PricingRates = DEFAULT_PRICING_RATES
): SessionUsageState {
  const safePrompt = Math.max(0, addedPrompt);
  const safeCompletion = Math.max(0, addedCompletion);

  const newPromptTokens = currentState.promptTokens + safePrompt;
  const newCompletionTokens = currentState.completionTokens + safeCompletion;
  const turnCost = calculateTurnCost(safePrompt, safeCompletion, rates);

  return {
    ...currentState,
    promptTokens: newPromptTokens,
    completionTokens: newCompletionTokens,
    totalTokens: newPromptTokens + newCompletionTokens,
    totalCostUsd: Math.round((currentState.totalCostUsd + turnCost) * 1e8) / 1e8,
  };
}
