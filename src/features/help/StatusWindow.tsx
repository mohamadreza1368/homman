import { useCallback, useEffect, useState } from "react";

import { clearLog, logLocation, readLog, saveLogCopy, type LogEntry } from "@/lib/appLog";
import { APP_VERSION_LABEL } from "@/lib/appVersion";
import { engineStatus } from "@/lib/ipc";
import { storageFailure } from "@/lib/localStore";
import { useSceneStore } from "@/stores/sceneStore";
import { useStudyStore } from "@/stores/studyStore";
import { useInterfaceLanguage } from "@/stores/interfaceLanguage";

interface DiagnosticRowProps {
  label: string;
  value: string;
  isIssue?: boolean;
}

function DiagnosticRow({ label, value, isIssue }: DiagnosticRowProps) {
  return (
    <>
      <dt className="text-slate-500">{label}</dt>
      <dd className={`text-right tabular-nums ${isIssue ? "text-amber-300" : "text-slate-300"}`}>
        {value}
      </dd>
    </>
  );
}

const SEVERITY_STYLES: Record<LogEntry["level"], string> = {
  info: "text-slate-500",
  warn: "text-amber-400",
  error: "text-rose-400",
};

function formatLocalTime(timestampEpochMs: number): string {
  return new Date(timestampEpochMs).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function StatusWindow({ onClose }: { onClose: () => void }) {
  const [recordedEvents, setRecordedEvents] = useState<LogEntry[]>([]);
  const isPersian = useInterfaceLanguage((s) => s.language === "fa");
  const [activeLogPath, setActiveLogPath] = useState<string | null>(null);
  const [exportedFilePath, setExportedFilePath] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  const studyStats = useStudyStore((s) => s.stats);
  const atlasManifest = useSceneStore((s) => s.manifest);
  const loadedOrgans = useSceneStore((s) => s.organs);

  const [engineHealthText, setEngineHealthText] = useState("asking…");
  const localStorageError = storageFailure();

  const reloadLogStream = useCallback(() => {
    void readLog().then(setRecordedEvents, () => setRecordedEvents([]));
  }, []);

  useEffect(() => {
    reloadLogStream();
    void logLocation().then(setActiveLogPath, () => setActiveLogPath(null));
    void engineStatus().then(
      (status) => setEngineHealthText(status.ready ? "ready" : (status.error ?? "not ready")),
      () => setEngineHealthText("could not be asked"),
    );
  }, [reloadLogStream]);

  useEffect(() => {
    const onKeyDown = (evt: KeyboardEvent) => {
      if (evt.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const generateDiagnosticReportText = useCallback(() => {
    const summarySections = [
      `HOOMAAN ${APP_VERSION_LABEL}`,
      `settings storage: ${localStorageError ?? "working"}`,
      `journal: ${
        studyStats
          ? `${studyStats.sessions} sessions, ${studyStats.cases} cases, ${studyStats.notes} notes`
          : "not read"
      }`,
      `atlas: ${
        atlasManifest ? `${Object.keys(loadedOrgans).length} structures loaded` : "not loaded"
      }`,
      `assistant engine: ${engineHealthText}`,
      `log file: ${activeLogPath ?? "unavailable"}`,
      "",
    ];

    const logLines = recordedEvents.map(
      (ev) =>
        `${new Date(ev.at).toISOString()}  ${ev.level.padEnd(5)} ${ev.source}: ${ev.message}`,
    );

    return [...summarySections, ...logLines].join("\n");
  }, [
    activeLogPath,
    atlasManifest,
    engineHealthText,
    loadedOrgans,
    localStorageError,
    recordedEvents,
    studyStats,
  ]);

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-6"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-slate-700 bg-slate-900 shadow-xl"
      >
        <header className="flex shrink-0 items-center justify-between border-b border-slate-800 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-100">
            {isPersian ? "وضعیت و گزارش سیستم" : "Status and log"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-400 transition hover:border-slate-600 hover:text-slate-200"
          >
            {isPersian ? "بستن · Esc" : "Close · Esc"}
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-[11px]">
            <DiagnosticRow label={isPersian ? "نسخه" : "Version"} value={APP_VERSION_LABEL} />
            <DiagnosticRow
              label={isPersian ? "فضای ذخیره‌سازی تنظیمات" : "Settings storage"}
              value={localStorageError ?? (isPersian ? "فعال" : "working")}
              isIssue={localStorageError !== null}
            />
            <DiagnosticRow
              label={isPersian ? "دفترچهٔ یادداشت و جلسات" : "Journal"}
              value={
                studyStats
                  ? isPersian
                    ? `${studyStats.sessions} جلسه · ${studyStats.cases} پرونده · ${studyStats.notes} یادداشت`
                    : `${studyStats.sessions} sessions · ${studyStats.cases} cases · ${studyStats.notes} notes`
                  : isPersian
                    ? "خوانده نشده"
                    : "not read"
              }
              isIssue={!studyStats}
            />
            <DiagnosticRow
              label={isPersian ? "اطلس آناتومی" : "Atlas"}
              value={
                atlasManifest
                  ? isPersian
                    ? `${Object.keys(loadedOrgans).length.toLocaleString("fa-IR")} ساختار بارگذاری‌شده`
                    : `${Object.keys(loadedOrgans).length.toLocaleString("en-US")} structures loaded`
                  : isPersian
                    ? "بارگذاری نشده"
                    : "not loaded"
              }
              isIssue={!atlasManifest}
            />
            <DiagnosticRow
              label={isPersian ? "موتور دستیار هوشمند" : "Assistant engine"}
              value={isPersian && engineHealthText === "ready" ? "آماده" : engineHealthText}
              isIssue={engineHealthText !== "ready"}
            />
            <DiagnosticRow
              label={isPersian ? "فایل گزارش (لاگ)" : "Log file"}
              value={activeLogPath ?? (isPersian ? "در دسترس نیست" : "unavailable")}
              isIssue={activeLogPath === null}
            />
          </dl>

          <div className="mt-4 border-t border-slate-800 pt-3">
            <p className="mb-2 text-[10px] uppercase tracking-wider text-slate-500">
              {isPersian
                ? `رویدادهای ثبت‌شده (${recordedEvents.length})`
                : `What has happened (${recordedEvents.length})`}
            </p>
            {recordedEvents.length === 0 ? (
              <p className="text-[11px] text-slate-500">
                {isPersian
                  ? "هیچ رویدادی ثبت نشده است. این نشانهٔ وضعیت مطلوب سیستم است."
                  : "Nothing recorded. That is the good case."}
              </p>
            ) : (
              <ol className="space-y-0.5 font-mono text-[10px] leading-snug">
                {[...recordedEvents].reverse().map((entry, idx) => (
                  <li key={`${entry.at}-${idx}`} className="flex gap-2">
                    <span className="shrink-0 text-slate-600">{formatLocalTime(entry.at)}</span>
                    <span className={`shrink-0 ${SEVERITY_STYLES[entry.level]}`}>
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
              void navigator.clipboard.writeText(generateDiagnosticReportText()).then(
                () => setIsCopied(true),
                () => setIsCopied(false),
              );
            }}
            className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300 transition hover:border-slate-600"
          >
            {isCopied ? (isPersian ? "کپی شد" : "Copied") : isPersian ? "کپی گزارش" : "Copy report"}
          </button>
          <button
            type="button"
            onClick={() => {
              void saveLogCopy(generateDiagnosticReportText()).then(
                setExportedFilePath,
                () => setExportedFilePath(null),
              );
            }}
            className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300 transition hover:border-slate-600"
          >
            {isPersian ? "ذخیرهٔ یک نسخه…" : "Save a copy…"}
          </button>
          <button
            type="button"
            onClick={() => {
              void clearLog().then(reloadLogStream, reloadLogStream);
            }}
            title={
              isPersian
                ? "پاک‌سازی فایل گزارش. یادداشت‌ها، جلسات و تنظیمات شما محفوظ خواهند ماند."
                : "Empty the log. Your notes, sessions and settings are untouched."
            }
            className="ml-auto rounded border border-slate-700 px-2 py-1 text-xs text-slate-400 transition hover:border-amber-600 hover:text-amber-300"
          >
            {isPersian ? "پاک‌سازی لاگ" : "Empty the log"}
          </button>
          {exportedFilePath && (
            <p className="w-full text-[10px] text-slate-500">
              {isPersian ? `در ${exportedFilePath} ذخیره شد` : `Saved to ${exportedFilePath}`}
            </p>
          )}
        </footer>
      </div>
    </div>
  );
}
