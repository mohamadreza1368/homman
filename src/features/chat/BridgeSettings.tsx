import { useEffect } from "react";

import { UNKNOWN_BRIDGE, useBridgeStore } from "@/stores/bridgeStore";
import { useInterfaceLanguage } from "@/stores/interfaceLanguage";

import { agentBriefing } from "./agentBriefing";
import { useCopy } from "./useCopy";

/**
 * How often the counters are re-read while the bridge is on.
 *
 * Only the counters change without this window doing anything, and they are a
 * diagnostic rather than a live readout: two seconds is fast enough to answer
 * "is my client actually reaching it" and slow enough to be free.
 */
const POLL_MS = 2000;

/**
 * The whole of what a client needs, and it is the same on every machine.
 *
 * No pipe and no token: the server derives the pipe name from the account it
 * is already running as. That is what turns setup from a per-session ritual
 * into one line pasted once.
 */
const MCP_ENV = '"HOOMAAN_BRIDGE": "1"';

/**
 * The control bridge's switch.
 */
export function BridgeSettings() {
  const fa = useInterfaceLanguage((s) => s.language === "fa");
  const status = useBridgeStore((s) => s.status) ?? UNKNOWN_BRIDGE;
  const error = useBridgeStore((s) => s.error);
  const busy = useBridgeStore((s) => s.busy);
  const refresh = useBridgeStore((s) => s.refresh);
  const turnOn = useBridgeStore((s) => s.turnOn);
  const turnOff = useBridgeStore((s) => s.turnOff);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const { running } = status;
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(timer);
  }, [running, refresh]);

  if (!status.supported) {
    return (
      <div>
        <p className="mb-1 text-[10px] uppercase tracking-wider text-slate-500">
          {fa ? "پل کنترل خارجی (Control bridge)" : "Control bridge"}
        </p>
        <p className="text-[10px] leading-snug text-slate-600">
          {fa
            ? "در این بیلد در دسترس نیست. پل هدایت سه‌بعدی توسط سایر برنامه‌ها فعلاً ویژهٔ ویندوز است."
            : "Not in this build. The bridge lets another program on your computer drive the 3D view, and so far it is only built for Windows."}
        </p>
        {status.server && (
          <div className="mt-2 space-y-1">
            <CopyRow label="Atlas MCP server" value={`${status.server}/atlas.py`} />
            <p className="text-[10px] leading-snug text-slate-600">
              {fa
                ? "ابزارهای پنج‌گانهٔ خواندنی اطلس کار می‌کنند: جست‌وجو در ساختارها، مشخصات و پیمایش درخت آناتومی با Python 3.10+. راهنمای INSTALLED.md را در کنار فایل ببینید."
                : "The five read-only tools do work here: search the atlas, read a structure, walk the hierarchy. Point an MCP client at this file with a Python 3.10+ environment of your own. The fifteen that move the view need the bridge, so they are absent. See INSTALLED.md beside it."}
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <p className="text-[10px] uppercase tracking-wider text-slate-500">
          {fa ? "پل کنترل خارجی (Control bridge)" : "Control bridge"}
        </p>
        <button
          type="button"
          role="switch"
          aria-checked={running}
          disabled={busy}
          onClick={() => void (running ? turnOff() : turnOn())}
          className={`ml-auto rounded border px-2 py-0.5 text-[10px] disabled:opacity-40 ${
            running
              ? "border-sky-500 bg-sky-500/10 text-sky-300"
              : "border-slate-700 text-slate-400 hover:border-slate-600"
          }`}
        >
          {running ? (fa ? "روشن" : "On") : fa ? "خاموش" : "Off"}
        </button>
      </div>

      <p className="text-[10px] leading-snug text-slate-600">
        {fa
          ? "به برنامه‌های دیگر در این رایانه (مانند Cursor یا Claude Desktop) اجازه می‌دهد نمای سه‌بعدی را کنترل و پیام‌های خارجی را در پنل دستیار نمایش دهند. این پیام‌ها در ژورنال ذخیره نشده و به ارائه‌دهنده ارسال نمی‌شوند. تنها در صورت روشن بودن این کلید امکان اتصال وجود دارد."
          : "Lets another program on this computer control the view and display external messages in the assistant panel. These messages are attributed to the control bridge, not the HOOMAAN assistant. They are not saved to the journal or sent to your provider. Only your own account can open the connection, and only while this switch is on."}
      </p>

      {running && (
        <div className="mt-2 space-y-2">
          <CopyRow label={fa ? "افزودن به کلاینت MCP (Add this to your MCP client)" : "Add this to your MCP client"} value={MCP_ENV} />
          <p className="text-[10px] leading-snug text-slate-600">
            {fa
              ? "این مقدار را در بخش env ورودی هوومان قرار دهید و کلاینت را بازنشانی کنید. این مقدار ثابت است و سرور این پنجره را خودکار پیدا می‌کند."
              : "Paste it into the env block of the HOOMAAN entry, then restart that client. It never changes, so this is a once-only step — the server finds this window by itself."}
          </p>

          <details>
            <summary className="cursor-pointer text-[10px] text-slate-600 hover:text-slate-400">
              {fa ? "در حال توسعه کلاینت اختصاصی هستید؟ (Writing your own client?)" : "Writing your own client?"}
            </summary>
            <div className="mt-1 space-y-2">
              <CopyRow label={fa ? "پایپ سیستم‌عامل (Pipe)" : "Pipe"} value={status.pipe} />
              {status.pipe && (
                <>
                  <CopyButton
                    label={fa ? "کپی راهنمای اتصال برای دستیار خارجی" : "Copy instructions for an external agent"}
                    value={agentBriefing(status.pipe, status.server)}
                  />
                  <p className="text-[10px] leading-snug text-slate-600">
                    {fa
                      ? "این متن را در دستیار قرار دهید. ابتدا سرور MCP و سپس نام پایپ را به عنوان جایگزین معرفی می‌کند."
                      : "Paste it into the agent. It names the MCP server first, the pipe only as a fallback, and the three things that otherwise look like a broken bridge. It contains the pipe path above, which identifies your Windows account on this machine."}
                  </p>
                </>
              )}
            </div>
          </details>

          <p className="text-[10px] text-slate-500">
            {status.accepted} {fa ? "دستور پذیرفته شد" : `command${status.accepted === 1 ? "" : "s"} accepted`}
            {status.refused > 0 && (
              <>
                {" · "}
                <span className="text-amber-300/80">
                  {status.refused} {fa ? "رد شد" : "refused"}
                </span>
              </>
            )}
          </p>
        </div>
      )}

      {error && (
        <p className="mt-2 rounded border border-rose-800/60 bg-rose-900/20 px-2 py-1 text-[10px] leading-snug text-rose-300">
          {error}
        </p>
      )}
    </div>
  );
}

function CopyButton({ label, value }: { label: string; value: string }) {
  const { copied, copy } = useCopy();
  return (
    <button
      type="button"
      onClick={() => void copy(value)}
      className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] text-slate-300 hover:border-slate-500 hover:text-white"
    >
      {copied ? "Copied" : label}
    </button>
  );
}

function CopyRow({ label, value }: { label: string; value: string | null }) {
  const { copied, copy } = useCopy();
  if (!value) return null;

  return (
    <div>
      <div className="mb-0.5 flex items-center justify-between text-[10px] text-slate-400">
        <span>{label}</span>
        <button
          type="button"
          onClick={() => void copy(value)}
          className="text-slate-500 hover:text-slate-300"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <code className="block select-all truncate rounded border border-slate-800 bg-slate-950 px-1.5 py-0.5 font-mono text-[9px] text-slate-300">
        {value}
      </code>
    </div>
  );
}
