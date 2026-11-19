import type { UsageBucket } from "@/lib/studyDb";
import { totalTokens } from "./tokens";

/**
 * Aggregation granularity for consumption metrics.
 */
export type Grain = "day" | "week" | "month";

export interface Period {
  key: string;
  label: string;
  input: number;
  output: number;
  total: number;
  turns: number;
}

export interface ModelShare {
  provider: string;
  model: string;
  input: number;
  output: number;
  total: number;
  turns: number;
  share: number;
}

export interface UsageTotals {
  input: number;
  output: number;
  cached: number;
  total: number;
  turns: number;
}

const SHORT_MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * Parses YYYY-MM-DD string into a localized Date at 00:00:00 local time.
 * Returns null if format is invalid or values overflow calendar limits.
 */
export function parseDay(dayString: string): Date | null {
  const dateParts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayString);
  if (!dateParts) return null;

  const numericYear = Number(dateParts[1]);
  const numericMonth = Number(dateParts[2]);
  const numericDay = Number(dateParts[3]);

  const targetDate = new Date(numericYear, numericMonth - 1, numericDay);
  if (targetDate.getMonth() !== numericMonth - 1 || targetDate.getDate() !== numericDay) {
    return null;
  }
  return targetDate;
}

const formatTwoDigits = (val: number) => String(val).padStart(2, "0");

const toIsoDateString = (d: Date) =>
  `${d.getFullYear()}-${formatTwoDigits(d.getMonth() + 1)}-${formatTwoDigits(d.getDate())}`;

/**
 * Identifies the Monday corresponding to the start of the week for a given local date.
 */
export function weekStart(sourceDate: Date): Date {
  const resultMonday = new Date(
    sourceDate.getFullYear(),
    sourceDate.getMonth(),
    sourceDate.getDate(),
  );
  const weekdayIndex = resultMonday.getDay();
  const shiftFromMonday = (weekdayIndex + 6) % 7;
  resultMonday.setDate(resultMonday.getDate() - shiftFromMonday);
  return resultMonday;
}

function formatPeriodHeader(anchorDate: Date, granularity: Grain): string {
  if (granularity === "month") {
    return `${SHORT_MONTH_NAMES[anchorDate.getMonth()]} ${anchorDate.getFullYear()}`;
  }
  if (granularity === "day") {
    return `${anchorDate.getDate()} ${SHORT_MONTH_NAMES[anchorDate.getMonth()]}`;
  }

  const weekEndBound = new Date(
    anchorDate.getFullYear(),
    anchorDate.getMonth(),
    anchorDate.getDate() + 6,
  );

  return anchorDate.getMonth() === weekEndBound.getMonth()
    ? `${anchorDate.getDate()}–${weekEndBound.getDate()} ${SHORT_MONTH_NAMES[weekEndBound.getMonth()]}`
    : `${anchorDate.getDate()} ${SHORT_MONTH_NAMES[anchorDate.getMonth()]} – ${weekEndBound.getDate()} ${SHORT_MONTH_NAMES[weekEndBound.getMonth()]}`;
}

function constructPeriodKey(calendarDate: Date, granularity: Grain): string {
  if (granularity === "day") {
    return toIsoDateString(calendarDate);
  }
  if (granularity === "month") {
    return `${calendarDate.getFullYear()}-${formatTwoDigits(calendarDate.getMonth() + 1)}`;
  }
  return `W${toIsoDateString(weekStart(calendarDate))}`;
}

/**
 * Aggregates daily usage records into grouped timeline periods, sorted in descending chronological order.
 */
export function summarise(usageList: UsageBucket[], granularity: Grain): Period[] {
  const intervalMap = new Map<string, Period>();

  for (const item of usageList) {
    const parsedMoment = parseDay(item.day);
    if (!parsedMoment) continue;

    const baseReference = granularity === "week" ? weekStart(parsedMoment) : parsedMoment;
    const bucketKey = constructPeriodKey(parsedMoment, granularity);

    const activePeriod = intervalMap.get(bucketKey) ?? {
      key: bucketKey,
      label: formatPeriodHeader(granularity === "month" ? parsedMoment : baseReference, granularity),
      input: 0,
      output: 0,
      total: 0,
      turns: 0,
    };

    activePeriod.input += item.input_tokens;
    activePeriod.output += item.output_tokens;
    activePeriod.total += totalTokens(item);
    activePeriod.turns += item.turns;
    intervalMap.set(bucketKey, activePeriod);
  }

  return [...intervalMap.values()].sort((alpha, beta) => beta.key.localeCompare(alpha.key));
}

/**
 * Computes model-by-model token attribution and fractional share across all recorded activity.
 */
export function byModel(usageList: UsageBucket[]): ModelShare[] {
  const modelMap = new Map<string, ModelShare>();

  for (const item of usageList) {
    const compoundKey = `${item.provider}/${item.model}`;
    const modelProfile = modelMap.get(compoundKey) ?? {
      provider: item.provider,
      model: item.model,
      input: 0,
      output: 0,
      total: 0,
      turns: 0,
      share: 0,
    };

    modelProfile.input += item.input_tokens;
    modelProfile.output += item.output_tokens;
    modelProfile.total += totalTokens(item);
    modelProfile.turns += item.turns;
    modelMap.set(compoundKey, modelProfile);
  }

  const overallTokens = totals(usageList).total;
  const modelsSorted = [...modelMap.values()];

  for (const candidate of modelsSorted) {
    candidate.share = overallTokens > 0 ? candidate.total / overallTokens : 0;
  }

  return modelsSorted.sort((a, b) => b.total - a.total);
}

/**
 * Calculates absolute totals for input, output, cached context, and turn count.
 */
export function totals(usageList: UsageBucket[]): UsageTotals {
  return usageList.reduce<UsageTotals>(
    (accumulator, entry) => ({
      input: accumulator.input + entry.input_tokens,
      output: accumulator.output + entry.output_tokens,
      cached: accumulator.cached + entry.cache_read_tokens,
      total: accumulator.total + totalTokens(entry),
      turns: accumulator.turns + entry.turns,
    }),
    { input: 0, output: 0, cached: 0, total: 0, turns: 0 },
  );
}
