import { useEffect, useMemo } from "react";

import { useInterfaceLanguage } from "@/stores/interfaceLanguage";
import { useUsageStore } from "@/stores/usageStore";

import { byModel, summarise, totals, type Grain } from "./aggregate";
import { formatTokens } from "./tokens";

const GRAINS: { id: Grain; label: string; labelFa: string; window: string; windowFa: string }[] = [
  { id: "day", label: "Daily", labelFa: "روزانه", window: "last 14 days", windowFa: "۱۴ روز گذشته" },
  { id: "week", label: "Weekly", labelFa: "هفتگی", window: "last 12 weeks", windowFa: "۱۲ هفته گذشته" },
  { id: "month", label: "Monthly", labelFa: "ماهانه", window: "last 12 months", windowFa: "۱۲ ماه گذشته" },
];

export function UsagePanel() {
  const fa = useInterfaceLanguage((s) => s.language === "fa");
  const buckets = useUsageStore((s) => s.buckets);
  const grain = useUsageStore((s) => s.grain);
  const loaded = useUsageStore((s) => s.loaded);
  const error = useUsageStore((s) => s.error);
  const refresh = useUsageStore((s) => s.refresh);
  const setGrain = useUsageStore((s) => s.setGrain);
  const dismissError = useUsageStore((s) => s.dismissError);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const periods = useMemo(() => summarise(buckets, grain), [buckets, grain]);
  const models = useMemo(() => byModel(buckets), [buckets]);
  const sum = useMemo(() => totals(buckets), [buckets]);
  const activeGrain = GRAINS.find((entry) => entry.id === grain);
  const windowLabel = (fa ? activeGrain?.windowFa : activeGrain?.window) ?? "";

  return (
    <div dir={fa ? "rtl" : "ltr"} className="flex h-full min-h-0 flex-col text-xs">
      <div className="flex shrink-0 items-center gap-1 border-b border-slate-800 px-3 py-2">
        {GRAINS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => void setGrain(entry.id)}
            aria-pressed={grain === entry.id}
            title={fa ? `${entry.labelFa} — ${entry.windowFa}` : `Group by ${entry.label.toLowerCase().replace("ly", "")} — ${entry.window}`}
            className={`rounded border px-2 py-1 text-[11px] transition ${
              grain === entry.id
                ? "border-sky-500 bg-sky-500/10 text-sky-300"
                : "border-slate-700 text-slate-400 hover:border-slate-600"
            }`}
          >
            {fa ? entry.labelFa : entry.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mx-3 mt-2 flex items-start gap-2 rounded border border-rose-800/60 bg-rose-900/20 px-2 py-1 text-[10px] text-rose-300">
          <span className="flex-1">{error}</span>
          <button type="button" onClick={dismissError} className="text-rose-400">
            ×
          </button>
        </div>
      )}

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-3">
        <Total sum={sum} window={windowLabel} loaded={loaded} fa={fa} />

        {periods.length > 0 && (
          <Section title={fa ? `در بازهٔ ${windowLabel}` : `Over the ${windowLabel}`}>
            <Timeline periods={periods} fa={fa} />
          </Section>
        )}

        {models.length > 0 && (
          <Section title={fa ? "بر اساس مدل" : "By model"}>
            <div className="space-y-1.5">
              {models.map((row) => (
                <div key={`${row.provider}/${row.model}`}>
                  <div className="flex items-baseline gap-2">
                    <span dir="ltr" className="min-w-0 flex-1 truncate text-[11px] text-slate-300">
                      {row.model}
                    </span>
                    <span className="tabular-nums text-[11px] text-slate-400">
                      {formatTokens(row.total)}
                    </span>
                    <span className="w-8 shrink-0 text-right tabular-nums text-[10px] text-slate-600">
                      {Math.round(row.share * 100)}%
                    </span>
                  </div>
                  <Bar fraction={row.share} />
                  <p className="mt-0.5 text-[10px] text-slate-600">
                    {fa
                      ? `${row.turns} پاسخ · ${formatTokens(row.input)} ورودی، ${formatTokens(row.output)} خروجی`
                      : `${row.provider} · ${row.turns} ${row.turns === 1 ? "answer" : "answers"} · ${formatTokens(row.input)} sent, ${formatTokens(row.output)} received`}
                  </p>
                </div>
              ))}
            </div>
          </Section>
        )}

        {loaded && buckets.length === 0 && (
          <p className="pt-4 text-center text-[11px] leading-relaxed text-slate-600">
            {fa
              ? "هنوز مصرفی ثبت نشده است. از اولین پاسخ دستیار به بعد، آمار توکن‌ها اینجا نمایش داده می‌شود."
              : "Nothing yet. Every answer the assistant gives is counted here, from the next one on."}
          </p>
        )}

        <p className="border-t border-slate-800/70 pt-3 text-[10px] leading-relaxed text-slate-600">
          {fa
            ? "اعداد بر اساس گزارش سرویس API شما محاسبه شده و فقط روی دستگاه خودتان نگهداری می‌شوند."
            : "Counts are what your provider reported for each answer, stored on this machine only. No prices: your provider's dashboard is the authority on the bill."}
        </p>
      </div>
    </div>
  );
}

function Total({
  sum,
  window,
  loaded,
  fa,
}: {
  sum: { input: number; output: number; cached: number; total: number; turns: number };
  window: string;
  loaded: boolean;
  fa: boolean;
}) {
  if (!loaded) return <p className="text-[11px] text-slate-500">{fa ? "در حال خواندن…" : "Reading…"}</p>;

  return (
    <div className="rounded border border-slate-800 bg-slate-900/40 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-slate-500">{window}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums text-slate-100">
        {formatTokens(sum.total)}
        <span className="ms-1 text-[11px] font-normal text-slate-500">
          {fa ? "توکن" : "tokens"}
        </span>
      </p>
      <p className="mt-0.5 text-[10px] text-slate-500">
        {fa
          ? `${formatTokens(sum.input)} ارسال · ${formatTokens(sum.output)} دریافت · ${sum.turns} پاسخ`
          : `${formatTokens(sum.input)} sent · ${formatTokens(sum.output)} received · ${sum.turns} ${sum.turns === 1 ? "answer" : "answers"}${sum.turns > 0 ? ` · ${formatTokens(sum.total / sum.turns)} each on average` : ""}`}
      </p>
      {sum.cached > 0 && (
        <p className="mt-0.5 text-[10px] text-slate-500">
          {fa
            ? `${formatTokens(sum.cached)} توکن از حافظهٔ نهان (Cache) بازخوانی شد.`
            : `${formatTokens(sum.cached)} of what was sent came back out of the provider's cache, billed at a reduced rate.`}
        </p>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[10px] uppercase tracking-wider text-slate-500">{title}</p>
      {children}
    </div>
  );
}

function Timeline({
  periods,
  fa,
}: {
  periods: { key: string; label: string; total: number; turns: number }[];
  fa: boolean;
}) {
  const peak = Math.max(...periods.map((period) => period.total), 1);

  return (
    <div className="space-y-1">
      {periods.map((period) => (
        <div key={period.key} className="flex items-center gap-2">
          <span className="w-24 shrink-0 truncate text-[10px] text-slate-500">
            {period.label}
          </span>
          <div className="min-w-0 flex-1">
            <Bar fraction={period.total / peak} />
          </div>
          <span
            className="w-12 shrink-0 text-right tabular-nums text-[10px] text-slate-400"
            title={
              fa
                ? `${period.turns} پاسخ`
                : `${period.turns} ${period.turns === 1 ? "answer" : "answers"}`
            }
          >
            {formatTokens(period.total)}
          </span>
        </div>
      ))}
    </div>
  );
}

function Bar({ fraction }: { fraction: number }) {
  return (
    <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-slate-800">
      <div
        className="h-full rounded-full bg-sky-500/70"
        style={{ width: `${Math.max(fraction * 100, fraction > 0 ? 2 : 0)}%` }}
      />
    </div>
  );
}
