import { useEffect, useMemo, useState } from "react";
import { useInterfaceLanguage } from "@/stores/interfaceLanguage";

export interface CoverageRow { male: string | null; female: string | null; name: string; system: string; status: "candidate" | "ambiguous" | "unmatched" }
interface CoverageReport { maleCount: number; femaleCount: number; method: string; rows: CoverageRow[] }

export function CoverageAudit() {
  const fa = useInterfaceLanguage((s) => s.language === "fa");
  const [open, setOpen] = useState(false);
  const [report, setReport] = useState<CoverageReport>();
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | CoverageRow["status"]>("all");
  useEffect(() => {
    if (!open || report) return;
    const controller = new AbortController();
    setFailed(false);
    fetch(`${import.meta.env.BASE_URL}anatomy/coverage-report.json`, { signal: controller.signal })
      .then((response) => { if (!response.ok) throw new Error("Coverage unavailable"); return response.json() as Promise<CoverageReport>; })
      .then(setReport).catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [open, report]);
  const needle = query.trim().toLowerCase();
  const rows = useMemo(() => (report?.rows ?? []).filter((row) => (filter === "all" || row.status === filter) &&
    (!needle || [row.name, row.system, row.male, row.female].some((value) => value?.toLowerCase().includes(needle)))), [report, filter, needle]);
  const candidates = report?.rows.filter((row) => row.status === "candidate").length ?? 0;
  return <details onToggle={(e) => setOpen(e.currentTarget.open)} className="rounded-xl border border-slate-700 bg-slate-950/70 p-3">
    <summary className="cursor-pointer text-xs font-semibold text-teal-200">{fa ? "گزارش کامل ساختارهای موجود" : "Full structure coverage audit"}</summary>
    {open && <div className="mt-3 space-y-3 text-xs leading-6 text-slate-300">
      {failed && <p role="alert">{fa ? "دریافت گزارش ممکن نشد." : "Could not load coverage report."}</p>}
      {!report && !failed && <p role="status">{fa ? "در حال دریافت گزارش…" : "Loading report…"}</p>}
      {report && <>
        <p>{fa ? `${report.maleCount} ساختار مرد · ${report.femaleCount} ساختار زن · ${candidates} نام مشترک پیشنهادی` : `${report.maleCount} male structures · ${report.femaleCount} female structures · ${candidates} candidate matches`}</p>
        <p className="text-amber-200/80">{fa ? "نام و دستگاه یکسان فقط پیشنهاد تطبیق است، نه تأیید علمی. موارد بدون تطبیق لزوماً در مدل دیگر غایب نیستند." : "Matching names and systems are candidates, not verified anatomical equivalence. Unmatched does not necessarily mean absent."}</p>
        <label className="block"><span className="sr-only">{fa ? "جست‌وجوی گزارش ساختارها" : "Search structure audit"}</span><input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={fa ? "نام انگلیسی یا شناسهٔ ساختار…" : "English name or structure ID…"} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-slate-100" /></label>
        <label className="block">{fa ? "وضعیت تطبیق" : "Match status"}<select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5"><option value="all">{fa ? "همه" : "All"}</option><option value="candidate">{fa ? "پیشنهاد تطبیق" : "Candidate"}</option><option value="ambiguous">{fa ? "مبهم" : "Ambiguous"}</option><option value="unmatched">{fa ? "بدون پیشنهاد" : "Unmatched"}</option></select></label>
        <p>{fa ? `${rows.length} نتیجه؛ حداکثر ۴۰ نتیجه نمایش داده می‌شود.` : `${rows.length} results; showing at most 40.`}</p>
        <ul className="max-h-72 space-y-1 overflow-y-auto" dir="ltr">{rows.slice(0, 40).map((row) => <li key={`${row.male ?? "-"}:${row.female ?? "-"}`} className="rounded-lg border border-slate-800 p-2 text-left"><p className="text-slate-100">{row.name}</p><p className="text-[10px] text-slate-400">{row.system} · {row.status} · M: {row.male ?? "—"} · F: {row.female ?? "—"}</p></li>)}</ul>
      </>}
    </div>}
  </details>;
}
