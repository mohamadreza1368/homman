import { useEffect, useLayoutEffect, useRef } from "react";

import { useInterfaceLanguage } from "@/stores/interfaceLanguage";
import { useSceneStore } from "@/stores/sceneStore";
import { useScanStore } from "@/stores/scanStore";

import { SWEEP_PROGRESS } from "./scanBand";
import { SECTION_VIEW, wantSection } from "./axialSlice";
import { SCAN_TINTS, scanTint } from "./scanTints";
import { primeScanSound } from "./scanSound";
import { OVERLAY_CHIP, OVERLAY_CHIP_ACTION, OVERLAY_GROUND } from "./overlayChrome";

/**
 * HOOMAAN Tomographic Scanner Controls Component.
 * Provides interactive hardware toggle, position slider synchronization,
 * orthogonal plane selection (axial vs. coronal front), radiological tints,
 * and slice capture preferences.
 */

function updateSliderProgress(slider: HTMLInputElement, progress: number): void {
  slider.value = String(progress);
  slider.style.setProperty("--scan-fill", `${Math.max(0, Math.min(1, progress)) * 100}%`);
}

export function ScanControls() {
  const isPersian = useInterfaceLanguage((s) => s.language === "fa");
  const isEnabled = useScanStore((s) => s.enabled);
  const isHeld = useScanStore((s) => s.held);
  const isPinned = useScanStore((s) => s.pinned);
  const sweepOnAnswer = useScanStore((s) => s.sweepOnAnswer);
  const toggleScanner = useScanStore((s) => s.toggle);
  const holdSweep = useScanStore((s) => s.hold);
  const releaseSweep = useScanStore((s) => s.release);
  const togglePin = useScanStore((s) => s.togglePin);
  const setSweepOnAnswer = useScanStore((s) => s.setSweepOnAnswer);
  const activeTint = useScanStore((s) => s.tint);
  const setTint = useScanStore((s) => s.setTint);
  const isRevealMode = useScanStore((s) => s.reveal);
  const setReveal = useScanStore((s) => s.setReveal);
  const isGhostMode = useScanStore((s) => s.ghost);
  const setGhost = useScanStore((s) => s.setGhost);
  const isSoundActive = useScanStore((s) => s.sound);
  const setSound = useScanStore((s) => s.setSound);
  const isAxialActive = useScanStore((s) => s.axial);
  const setAxial = useScanStore((s) => s.setAxial);
  const isCutActive = useScanStore((s) => s.cut);
  const setCut = useScanStore((s) => s.setCut);
  const isTorchActive = useScanStore((s) => s.torch);
  const setTorch = useScanStore((s) => s.setTorch);
  const isDetailActive = useScanStore((s) => s.detail);
  const setDetail = useScanStore((s) => s.setDetail);
  const isPanelExpanded = useScanStore((s) => s.panel);
  const togglePanel = useScanStore((s) => s.togglePanel);
  const activePlane = useScanStore((s) => s.plane);
  const setPlane = useScanStore((s) => s.setPlane);

  const isDrainedBody = useSceneStore((s) => s.bodyTone) !== "solid";
  const sliderRef = useRef<HTMLInputElement>(null);

  useLayoutEffect(() => {
    if (sliderRef.current) updateSliderProgress(sliderRef.current, SWEEP_PROGRESS.value);
  }, [isEnabled, isPanelExpanded]);

  useEffect(() => {
    if (!isEnabled || !isPanelExpanded || isHeld || isPinned) return;
    let animId = 0;
    const syncLoop = () => {
      if (sliderRef.current) updateSliderProgress(sliderRef.current, SWEEP_PROGRESS.value);
      animId = requestAnimationFrame(syncLoop);
    };
    animId = requestAnimationFrame(syncLoop);
    return () => cancelAnimationFrame(animId);
  }, [isEnabled, isPanelExpanded, isHeld, isPinned]);

  return (
    <div className="pointer-events-auto flex flex-col items-start gap-1.5">
      <button
        type="button"
        onClick={toggleScanner}
        aria-pressed={isEnabled}
        title={
          isEnabled
            ? "Stop the scanner"
            : "Sweep a plane of light through the body, lighting each structure it reaches"
        }
        className={`rounded-xl border px-3 py-2 text-xs font-semibold shadow-lg backdrop-blur transition focus-visible:outline-2 focus-visible:outline-teal-300 ${
          isEnabled
            ? "border-teal-400/70 bg-teal-950/95 text-teal-100"
            : "border-slate-600 bg-slate-950/90 text-slate-200 hover:border-teal-400"
        }`}
      >
        <span className="mr-2 text-[9px] tracking-[0.16em] text-teal-300">HOMMAN</span>
        {isPersian ? "اسکنر" : "Scanner"}
      </button>

      {isEnabled && !isPanelExpanded && (
        <button
          type="button"
          onClick={togglePanel}
          title="Show the scanner's controls again"
          className={`pointer-events-auto flex items-center gap-1.5 ${OVERLAY_CHIP} ${OVERLAY_CHIP_ACTION}`}
        >
          <span
            aria-hidden
            className="inline-block h-2 w-2 rounded-sm"
            style={{ backgroundColor: scanTint(activeTint).hex }}
          />
          {isPersian ? "نمایش تنظیمات اسکنر" : "Scanner controls"}
        </button>
      )}

      {isEnabled && isPanelExpanded && (
        <div
          dir={isPersian ? "rtl" : "ltr"}
          className="max-w-52 rounded-2xl border border-teal-500/30 bg-slate-950/95 px-3 py-3 shadow-xl backdrop-blur"
        >
          <button
            type="button"
            onClick={togglePanel}
            title="Fold these away without stopping the scanner"
            className="mb-1 flex w-full items-center justify-between gap-3 text-[9px] uppercase tracking-wider text-cyan-500/70 hover:text-cyan-300"
          >
            <span className="text-teal-300">
              HOMMAN · {isPersian ? "کنترل اسکن" : "SCAN CONTROLS"}
            </span>
            <span className="text-slate-400 normal-case">{isPersian ? "بستن" : "hide"}</span>
          </button>

          <div className="mb-1.5 flex gap-1" role="group" aria-label="Scanner plane">
            {[
              {
                value: "axial" as const,
                label: isPersian ? "محوری" : "Axial",
                hint: "Sweep head to feet and section the body at a height",
              },
              {
                value: "front" as const,
                label: isPersian ? "از روبه‌رو" : "Front",
                hint: "Sweep front to back and section the body at a depth, seen from the front",
              },
            ].map((choice) => (
              <button
                key={choice.value}
                type="button"
                onClick={() => {
                  if (choice.value === activePlane) return;
                  setPlane(choice.value);
                  SECTION_VIEW.value = null;
                  wantSection();
                }}
                aria-pressed={activePlane === choice.value}
                title={choice.hint}
                className={`flex-1 rounded border px-1 py-0.5 text-[9px] ${
                  activePlane === choice.value
                    ? "border-cyan-500 bg-cyan-500/15 text-cyan-200"
                    : "border-slate-700 text-slate-400 hover:border-slate-600"
                }`}
              >
                {choice.label}
              </button>
            ))}
          </div>

          <div className="relative h-28 w-4 short:h-20">
            <input
              ref={sliderRef}
              id="scan-position"
              aria-label={isPersian ? "تغییر موقعیت اسکنر" : "Drag to hold the light"}
              type="range"
              min={0}
              max={1}
              step={0.001}
              defaultValue={SWEEP_PROGRESS.value}
              className="scan-slider absolute top-1/2 left-1/2 h-4 w-28 -translate-x-1/2 -translate-y-1/2 -rotate-90 cursor-ns-resize short:w-20"
              onPointerDown={(e) => {
                if (isSoundActive) primeScanSound();
                holdSweep(Number(e.currentTarget.value));

                const handleRelease = () => {
                  window.removeEventListener("pointerup", handleRelease);
                  window.removeEventListener("pointercancel", handleRelease);
                  releaseSweep();
                };
                window.addEventListener("pointerup", handleRelease);
                window.addEventListener("pointercancel", handleRelease);
              }}
              onChange={(e) => {
                updateSliderProgress(e.currentTarget, Number(e.currentTarget.value));
                holdSweep(Number(e.currentTarget.value));
              }}
              onKeyDown={(e) => {
                if (!e.key.startsWith("Arrow")) return;
                updateSliderProgress(e.currentTarget, Number(e.currentTarget.value));
                holdSweep(Number(e.currentTarget.value));
              }}
              onBlur={releaseSweep}
            />
          </div>

          <div className="mt-1.5 flex gap-1" role="group" aria-label="Light colour">
            {SCAN_TINTS.map((swatch) => (
              <button
                key={swatch.id}
                type="button"
                onClick={() => setTint(swatch.id)}
                aria-pressed={activeTint === swatch.id}
                title={`${swatch.label} light`}
                className={`h-4 flex-1 rounded-sm border transition-colors ${
                  activeTint === swatch.id
                    ? "border-slate-200"
                    : "border-slate-700 hover:border-slate-500"
                }`}
                style={{ backgroundColor: swatch.hex }}
              >
                <span className="sr-only">{swatch.label}</span>
              </button>
            ))}
          </div>

          <label
            className={`mt-1.5 flex cursor-pointer items-start gap-1.5 text-[9px] leading-snug ${
              isDrainedBody ? "text-slate-400" : "cursor-not-allowed text-slate-600"
            }`}
            title={
              isDrainedBody
                ? "Give each structure its own colour back as the plane reaches it, instead of lighting it"
                : "Switch the body to Scan or Carbon first — at full colour there is nothing to reveal"
            }
          >
            <input
              type="checkbox"
              checked={isRevealMode}
              disabled={!isDrainedBody}
              onChange={(e) => setReveal(e.target.checked)}
              className="mt-[1px] accent-cyan-500"
            />
            {isPersian ? "نمایش رنگ ساختارها" : "Reveal colour, not light"}
          </label>

          <label className="mt-1 flex cursor-pointer items-start gap-1.5 text-[9px] leading-snug text-slate-400">
            <input
              type="checkbox"
              checked={isAxialActive}
              onChange={(e) => setAxial(e.target.checked)}
              className="mt-[1px] accent-cyan-500"
            />
            {isPersian ? "نمایش برش در محل توقف" : "Cross-section where I let go"}
          </label>

          {isAxialActive && (
            <div className="mt-1 flex gap-1" role="group" aria-label="Section style">
              {[
                { on: true, label: "Cut", hint: "Open the body at the plane — solid, and easier to read" },
                { on: false, label: "Slab", hint: "Only what lies at that exact level — a true section" },
              ].map((choice) => (
                <button
                  key={choice.label}
                  type="button"
                  onClick={() => setCut(choice.on)}
                  aria-pressed={isCutActive === choice.on}
                  title={choice.hint}
                  className={`flex-1 rounded border px-1 py-0.5 text-[9px] ${
                    isCutActive === choice.on
                      ? "border-cyan-500 bg-cyan-500/15 text-cyan-200"
                      : "border-slate-700 text-slate-400 hover:border-slate-600"
                  }`}
                >
                  {choice.label}
                </button>
              ))}
            </div>
          )}

          {isAxialActive && (
            <label className="mt-1 flex cursor-pointer items-start gap-1.5 text-[9px] leading-snug text-slate-400">
              <input
                type="checkbox"
                checked={isTorchActive}
                onChange={(e) => setTorch(e.target.checked)}
                className="mt-[1px] accent-cyan-500"
              />
              Aim the light with the pointer
            </label>
          )}

          {isAxialActive && (
            <label
              title={
                "Read each section at four times the pixels: magnify twice as far before the picture runs out."
              }
              className="mt-1 flex cursor-pointer items-start gap-1.5 text-[9px] leading-snug text-slate-400"
            >
              <input
                type="checkbox"
                checked={isDetailActive}
                onChange={(e) => setDetail(e.target.checked)}
                className="mt-[1px] accent-cyan-500"
              />
              Quality
            </label>
          )}

          <label className="mt-1 flex cursor-pointer items-start gap-1.5 text-[9px] leading-snug text-slate-400">
            <input
              type="checkbox"
              checked={isSoundActive}
              onChange={(e) => {
                if (e.target.checked) primeScanSound();
                setSound(e.target.checked);
              }}
              className="mt-[1px] accent-cyan-500"
            />
            Sound when I let go
          </label>

          <label className="mt-1 flex cursor-pointer items-start gap-1.5 text-[9px] leading-snug text-slate-400">
            <input
              type="checkbox"
              checked={isGhostMode}
              onChange={(e) => setGhost(e.target.checked)}
              className="mt-[1px] accent-cyan-500"
            />
            Fade what it has passed
          </label>

          <button
            type="button"
            onClick={togglePin}
            aria-pressed={isPinned}
            title={
              isPinned
                ? "Let the light travel again"
                : "Keep the light where it is, so you can look without holding it"
            }
            className={`mt-1.5 w-full rounded border px-1 py-0.5 text-[9px] ${
              isPinned
                ? "border-cyan-500 bg-cyan-500/15 text-cyan-200"
                : "border-slate-700 text-slate-400 hover:border-slate-600"
            }`}
          >
            {isPinned ? "Held" : "Hold"}
          </button>
        </div>
      )}

      <label
        className={`flex max-w-[9.5rem] cursor-pointer items-start gap-1.5 rounded ${OVERLAY_GROUND} px-1.5 py-1 text-[9px] leading-snug`}
      >
        <input
          type="checkbox"
          checked={sweepOnAnswer}
          onChange={(e) => setSweepOnAnswer(e.target.checked)}
          className="mt-[1px] accent-cyan-500"
        />
        Sweep while the assistant answers
      </label>
    </div>
  );
}
