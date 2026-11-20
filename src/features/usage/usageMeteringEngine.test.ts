import { describe, it, expect } from 'vitest';
import {
  calculateTurnCost,
  evaluateQuotaStatus,
  createInitialSessionUsage,
  accumulateUsage,
  DEFAULT_PRICING_RATES,
} from './usageMeteringEngine';

describe('UsageMeteringEngine (Spec verification from specs/usage-quota-metering.md)', () => {
  it('Scenario 1: calculates cumulative tokens and monetary cost from rates', () => {
    // 500 prompt, 150 completion tokens
    const cost = calculateTurnCost(500, 150, DEFAULT_PRICING_RATES);
    // (500/1000 * 0.0005) + (150/1000 * 0.0015) = 0.00025 + 0.000225 = 0.000475
    expect(cost).toBe(0.000475);

    let state = createInitialSessionUsage(10_000);
    state = accumulateUsage(state, 500, 150, DEFAULT_PRICING_RATES);

    expect(state.promptTokens).toBe(500);
    expect(state.completionTokens).toBe(150);
    expect(state.totalTokens).toBe(650);
    expect(state.totalCostUsd).toBe(0.000475);
  });

  it('Scenario 2: flags warning status when consumption reaches 90% but under 100%', () => {
    // 9,200 of 10,000 tokens = 92%
    const evaluation = evaluateQuotaStatus(9200, 10_000);

    expect(evaluation.status).toBe('warning');
    expect(evaluation.percentageUsed).toBe(92);
    expect(evaluation.isBlocked).toBe(false);
    expect(evaluation.warningMessageFa).toContain('۹۲٪');
  });

  it('Scenario 3: triggers block when usage exceeds 100% of daily quota', () => {
    // 10,500 of 10,000 tokens = 105%
    const evaluation = evaluateQuotaStatus(10_500, 10_000);

    expect(evaluation.status).toBe('exceeded');
    expect(evaluation.percentageUsed).toBe(105);
    expect(evaluation.isBlocked).toBe(true);
    expect(evaluation.warningMessageFa).toContain('به پایان رسیده');
  });

  it('Edge Case A: clamps negative token values to zero without corrupting state', () => {
    const cost = calculateTurnCost(-50, -100);
    expect(cost).toBe(0);

    let state = createInitialSessionUsage(10_000);
    state = accumulateUsage(state, -50, 100);

    expect(state.promptTokens).toBe(0);
    expect(state.completionTokens).toBe(100);
    expect(state.totalTokens).toBe(100);
  });

  it('Edge Case B: unlimited quota limit (0) never triggers warnings or blocks', () => {
    const evaluation = evaluateQuotaStatus(500_000, 0);

    expect(evaluation.status).toBe('unlimited');
    expect(evaluation.percentageUsed).toBe(0);
    expect(evaluation.isBlocked).toBe(false);
  });

  it('Edge Case C: resets session state cleanly', () => {
    let state = createInitialSessionUsage(10_000);
    state = accumulateUsage(state, 1000, 2000);
    expect(state.totalTokens).toBe(3000);

    const resetState = createInitialSessionUsage(10_000);
    expect(resetState.totalTokens).toBe(0);
    expect(resetState.totalCostUsd).toBe(0);
  });
});
