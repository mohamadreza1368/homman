import { useState, type FormEvent } from "react";

import { BrandLogo } from "@/components/BrandLogo";
import { APP_VERSION_LABEL } from "@/lib/appVersion";
import { useInterfaceLanguage } from "@/stores/interfaceLanguage";
import { useSessionAuth } from "@/stores/sessionAuth";

/**
 * Branded login and entry screen shown before opening the 3D atlas workspace.
 */
export function LoginScreen() {
  const language = useInterfaceLanguage((s) => s.language);
  const setLanguage = useInterfaceLanguage((s) => s.setLanguage);
  const fa = language === "fa";

  const signIn = useSessionAuth((s) => s.signIn);
  const enterAsGuest = useSessionAuth((s) => s.enterAsGuest);

  const [identity, setIdentity] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const clean = identity.trim();
    if (!clean) {
      setError(
        fa
          ? "لطفاً نام کاربری یا ایمیل را وارد کنید یا به‌صورت مهمان وارد شوید."
          : "Please enter your name or email, or continue as a guest.",
      );
      return;
    }
    setError(null);
    signIn({ userName: clean, remember });
  }

  return (
    <div
      dir={fa ? "rtl" : "ltr"}
      className="fixed inset-0 z-[90] flex flex-col justify-between overflow-y-auto bg-[#0b1220] px-4 py-6 text-slate-200"
      role="dialog"
      aria-modal="true"
      aria-label={fa ? "ورود به هومان" : "Sign in to HOOMAAN"}
    >
      {/* Ambient medical teal + amber radial glow */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 overflow-hidden"
      >
        <div className="absolute -top-32 left-1/2 h-[420px] w-[620px] -translate-x-1/2 rounded-full bg-teal-500/10 blur-[120px]" />
        <div className="absolute -bottom-32 left-1/2 h-[340px] w-[520px] -translate-x-1/2 rounded-full bg-amber-500/8 blur-[120px]" />
      </div>

      {/* Top language & build strip */}
      <div className="relative z-10 mx-auto flex w-full max-w-md items-center justify-between text-xs">
        <span className="rounded-full border border-slate-800 bg-slate-900/70 px-2.5 py-1 text-[10px] font-medium tabular-nums text-slate-400">
          HOOMAAN {APP_VERSION_LABEL}
        </span>
        <div
          className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900/80 p-0.5"
          aria-label="Interface language"
        >
          <button
            type="button"
            aria-pressed={fa}
            onClick={() => setLanguage("fa")}
            className={`rounded-md px-2.5 py-1 text-xs transition ${
              fa ? "bg-teal-600 text-white" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            فارسی
          </button>
          <button
            type="button"
            aria-pressed={!fa}
            onClick={() => setLanguage("en")}
            className={`rounded-md px-2.5 py-1 text-xs transition ${
              !fa ? "bg-teal-600 text-white" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            English
          </button>
        </div>
      </div>

      {/* Centered HOOMAAN brand & login card */}
      <div className="relative z-10 mx-auto my-6 w-full max-w-md rounded-2xl border border-slate-800/90 bg-slate-900/75 p-7 shadow-2xl backdrop-blur-md">
        <div className="flex flex-col items-center text-center">
          <BrandLogo
            variant="full-dark"
            className="h-32 w-auto drop-shadow-[0_0_24px_rgba(20,184,166,0.16)]"
          />
          <p className="mt-4 text-xs leading-relaxed text-slate-400">
            {fa
              ? "اطلس تعاملی سه‌بعدی آناتومی انسان و دستیار هوشمند آموزش پزشکی"
              : "Interactive 3D Human Anatomy Atlas & AI Study Assistant"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
          <div>
            <label
              htmlFor="login-identity"
              className="mb-1.5 block text-xs font-medium text-slate-300"
            >
              {fa ? "نام کاربری یا ایمیل" : "Name or email"}
            </label>
            <input
              id="login-identity"
              type="text"
              autoComplete="username"
              value={identity}
              onChange={(event) => {
                setIdentity(event.target.value);
                if (error) setError(null);
              }}
              placeholder={fa ? "مثلاً دکتر احمدی یا email@example.com" : "e.g. Dr. Ahmadi or name@example.com"}
              className="w-full rounded-lg border border-slate-700/80 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label
                htmlFor="login-password"
                className="block text-xs font-medium text-slate-300"
              >
                {fa ? "رمز عبور" : "Password"}
              </label>
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="text-[11px] text-slate-400 transition hover:text-teal-300"
              >
                {showPassword ? (fa ? "مخفی کردن" : "Hide") : fa ? "نمایش" : "Show"}
              </button>
            </div>
            <input
              id="login-password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={fa ? "اختیاری برای ورود محلی" : "Optional for local study session"}
              className="w-full rounded-lg border border-slate-700/80 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-400">
            <input
              type="checkbox"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
              className="h-3.5 w-3.5 rounded border-slate-700 bg-slate-950 accent-teal-500"
            />
            <span>{fa ? "نشست من را به خاطر بسپار" : "Keep me signed in on this device"}</span>
          </label>

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            className="w-full rounded-lg bg-gradient-to-r from-teal-600 to-teal-500 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-teal-950/50 transition hover:from-teal-500 hover:to-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400"
          >
            {fa ? "ورود به اطلس سه‌بعدی" : "Sign in to 3D Atlas"}
          </button>

          <button
            type="button"
            onClick={enterAsGuest}
            className="w-full rounded-lg border border-slate-700/80 bg-slate-950/50 px-4 py-2 text-xs font-medium text-slate-300 transition hover:border-amber-500/50 hover:text-amber-300"
          >
            {fa ? "ورود سریع به‌عنوان مهمان" : "Continue as Guest"}
          </button>
        </form>
      </div>

      {/* Compliance notice */}
      <p className="relative z-10 text-center text-[11px] text-slate-500">
        {fa
          ? "صرفاً برای آموزش؛ ابزار پزشکی یا وسیلهٔ تشخیص و درمان نیست."
          : "Educational use only — not a medical device, and not for diagnosis or treatment."}
      </p>
    </div>
  );
}
