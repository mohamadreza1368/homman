import { useCallback, useEffect, useState } from "react";

import { clearLog, logLocation, readLog, saveLogCopy, type LogEntry } from "@/lib/appLog";
import { APP_VERSION_LABEL } from "@/lib/appVersion";
import { engineStatus } from "@/lib/ipc";
import { storageFailure } from "@/lib/localStore";
import { useSceneStore } from "@/stores/sceneStore";
import { useStudyStore } from "@/stores/studyStore";
import { useInterfaceLanguage } from "@/stores/interfaceLanguage";

/**
 * What state the application is actually in, and what has gone wrong with it.
 *
 * # Why it exists
 *
 * Because the answer to "it is not working" used to live in three places a
 * reader cannot reach: a console with no way to open it, a browser engine's
 * private database, and a process that took its knowledge with it when the
 * window closed. Diagnosing one storage fault from the outside took a morning
 * of reading leveldb files with a script.
 *
 * Everything here was already known by the application. None of it was
 * sayable.
 *
 * # Why it is behind the version number
 *
 * Because that is what somebody already clicks, or reads out, when reporting a
 * problem — "I'm on 0.2.2" is the first line of every bug report ever written.
 * Putting the rest of the report behind the same label costs no new chrome and
 * needs no explaining.
 *
 * # Why nothing here changes anything
 *
 * Two exceptions, both about the log itself: emptying it and saving a copy.
 * Everything else is read-only on purpose. The moment this window grows a
 * switch it stops being a description of the application and becomes a second
 * settings panel, with its own state to keep in step.
 */

function Row({ label, value, bad }: { label: string; value: string; bad?: boolean }) {
  return (
    <>
      <dt className="text-slate-500">{label}</dt>
      <dd className={`text-right tabular-nums ${bad ? "text-amber-300" : "text-slate-300"}`}>
        {value}
      </dd>
    </>
  );
}

const LEVEL_COLOUR: Record<LogEntry["level"], string> = {
  info: "text-slate-500",
  warn: "text-amber-400",
  error: "text-rose-400",
};

/** `14:32:07`, in the reader's own timezone. */
function clockTime(at: number): string {
  return new Date(at).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function StatusWindow({ onClose }: { onClose: () => void }) {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const fa = useInterfaceLanguage((s) => s.language === "fa");
  const [path, setPath] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const stats = useStudyStore((s) => s.stats);
  const manifest = useSceneStore((s) => s.manifest);
  const organs = useSceneStore((s) => s.organs);
  // Asked here rather than read from a store, because the chat panel keeps
  // readiness in its own state and because a status window should report what
  // is true when it opens, not what was true when something else last looked.
  const [engine, setEngine] = useState("asking…");
  const storage = storageFailure();

  const refresh = useCallback(() => {
    void readLog().then(setEntries, () => setEntries([]));
  }, []);

  useEffect(() => {
    refresh();
    void logLocation().then(setPath, () => setPath(null));
    void engineStatus().then(
      (status) => setEngine(status.ready ? "ready" : (status.error ?? "not ready")),
      () => setEngine("could not be asked"),
    );
    // Not on a timer. The window is opened to look at a problem that has
    // already happened, and a list that reordered itself while being read is
    // harder to report from than one that holds still.
  }, [refresh]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  /** The whole report as text, which is what a reader actually sends. */
  const asText = useCallback(() => {
    const facts = [
      `HOOMAAN ${APP_VERSION_LABEL}`,
      `settings storage: ${storage ?? "working"}`,
      `journal: ${stats ? `${stats.sessions} sessions, ${stats.cases} cases, ${stats.notes} notes` : "not read"}`,
      `atlas: ${manifest ? `${Object.keys(organs).length} structures loaded` : "not loaded"}`,
      `assistant engine: ${engine}`,
      `log file: ${path ?? "unavailable"}`,
      "",
    ];
    const lines = entries.map(
      (entry) =>
        `${new Date(entry.at).toISOString()}  ${entry.level.padEnd(5)} ${entry.source}: ${entry.message}`,
    );
    return [...facts, ...lines].join("\n");
  }, [engine, entries, manifest, organs, path, stats, storage]);

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-6"
      onClick={onClose}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-slate-700 bg-slate-900 shadow-xl"
      >
        <header className="flex shrink-0 items-center justify-between border-b border-slate-800 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-100">
            {fa ? "وضعیت و گزارش سیستم" : "Status and log"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-400 transition hover:border-slate-600 hover:text-slate-200"
          >
            {fa ? "بستن · Esc" : "Close · Esc"}
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-[11px]">
            <Row label={fa ? "نسخه" : "Version"} value={APP_VERSION_LABEL} />
            <Row
              label={fa ? "فضای ذخیره‌سازی تنظیمات" : "Settings storage"}
              value={storage ?? (fa ? "فعال" : "working")}
              bad={storage !== null}
            />
            <Row
              label={fa ? "دفترچهٔ یادداشت و جلسات" : "Journal"}
              value={
                stats
                  ? (fa ? `${stats.sessions} جلسه · ${stats.cases} پرونده · ${stats.notes} یادداشت` : `${stats.sessions} sessions · ${stats.cases} cases · ${stats.notes} notes`)
                  : (fa ? "خوانده نشده" : "not read")
              }
              bad={!stats}
            />
            <Row
              label={fa ? "اطلس آناتومی" : "Atlas"}
              value={
                manifest
                  ? (fa ? `${Object.keys(organs).length.toLocaleString("fa-IR")} ساختار بارگذاری‌شده` : `${Object.keys(organs).length.toLocaleString("en-US")} structures loaded`)
                  : (fa ? "بارگذاری نشده" : "not loaded")
              }
              bad={!manifest}
            />
            <Row label={fa ? "موتور دستیار هوشمند" : "Assistant engine"} value={fa && engine === "ready" ? "آماده" : engine} bad={engine !== "ready"} />
            <Row label={fa ? "فایل گزارش (لاگ)" : "Log file"} value={path ?? (fa ? "در دسترس نیست" : "unavailable")} bad={path === null} />
          </dl>

          <div className="mt-4 border-t border-slate-800 pt-3">
            <p className="mb-2 text-[10px] uppercase tracking-wider text-slate-500">
              {fa ? `رویدادهای ثبت‌شده (${entries.length})` : `What has happened (${entries.length})`}
            </p>
            {entries.length === 0 ? (
              <p className="text-[11px] text-slate-500">
                {fa ? "هیچ رویدادی ثبت نشده است. این نشانهٔ وضعیت مطلوب سیستم است." : "Nothing recorded. That is the good case."}
              </p>
            ) : (
              <ol className="space-y-0.5 font-mono text-[10px] leading-snug">
                {[...entries].reverse().map((entry, index) => (
                  <li key={`${entry.at}-${index}`} className="flex gap-2">
                    <span className="shrink-0 text-slate-600">{clockTime(entry.at)}</span>
                    <span className={`shrink-0 ${LEVEL_COLOUR[entry.level]}`}>
                      {entry.source}
                    </span>
                    <span className="text-slate-400">{entry.message}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>

        <footer className="flex shrink-0 flex-wrap items-center gap-2 border-t border-slate-800 px-4 py-3">
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(asText()).then(
                () => setCopied(true),
                () => setCopied(false),
              );
            }}
            className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300 transition hover:border-slate-600"
          >
            {copied ? (fa ? "کپی شد" : "Copied") : (fa ? "کپی گزارش" : "Copy report")}
          </button>
          <button
            type="button"
            onClick={() => {
              void saveLogCopy(asText()).then(setSaved, () => setSaved(null));
            }}
            className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300 transition hover:border-slate-600"
          >
            {fa ? "ذخیرهٔ یک نسخه…" : "Save a copy…"}
          </button>
          <button
            type="button"
            onClick={() => {
              void clearLog().then(refresh, refresh);
            }}
            title={fa ? "پاک‌سازی فایل گزارش. یادداشت‌ها، جلسات و تنظیمات شما محفوظ خواهند ماند." : "Empty the log. Your notes, sessions and settings are untouched."}
            className="ml-auto rounded border border-slate-700 px-2 py-1 text-xs text-slate-400 transition hover:border-amber-600 hover:text-amber-300"
          >
            {fa ? "پاک‌سازی لاگ" : "Empty the log"}
          </button>
          {saved && (
            <p className="w-full text-[10px] text-slate-500">{fa ? `در ${saved} ذخیره شد` : `Saved to ${saved}`}</p>
          )}
        </footer>
      </div>
    </div>
  );
}
