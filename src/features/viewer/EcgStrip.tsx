import { useEffect, useRef } from "react";

import type { RhythmPlayer } from "./rhythms";
import { useInterfaceLanguage } from "@/stores/interfaceLanguage";

/**
 * HOOMAAN ECG Strip Component.
 * Emulates a real-time hospital monitor trace (Lead II style) synchronized
 * with cardiac pacing models, respiratory sinus variations, and sweep gaps.
 */

const CLOCK_BUFFER_CAPACITY = 128;

export class ClockTrace {
  private readonly real = new Float64Array(CLOCK_BUFFER_CAPACITY);
  private readonly heart = new Float64Array(CLOCK_BUFFER_CAPACITY);
  private count = 0;
  private head = 0;

  push(real: number, heart: number): void {
    this.real[this.head] = real;
    this.heart[this.head] = heart;
    this.head = (this.head + 1) % CLOCK_BUFFER_CAPACITY;
    this.count = Math.min(CLOCK_BUFFER_CAPACITY, this.count + 1);
  }

  heartAt(real: number): number {
    if (this.count === 0) return real;
    const offsetIdx = (back: number) =>
      (this.head - 1 - back + CLOCK_BUFFER_CAPACITY) % CLOCK_BUFFER_CAPACITY;
    let later = offsetIdx(0);

    if (real >= this.real[later]!) return this.heart[later]! + (real - this.real[later]!);

    for (let back = 1; back < this.count; back++) {
      const earlier = offsetIdx(back);
      const from = this.real[earlier]!;
      if (real >= from) {
        const span = this.real[later]! - from;
        const progress = span > 0 ? (real - from) / span : 1;
        return this.heart[earlier]! + progress * (this.heart[later]! - this.heart[earlier]!);
      }
      later = earlier;
    }
    return this.heart[later]! - (this.real[later]! - real);
  }

  reset(): void {
    this.count = 0;
    this.head = 0;
  }
}

export const HEART_TRACE: {
  player: RhythmPlayer | null;
  now: number;
  clock: ClockTrace;
} = {
  player: null,
  now: 0,
  clock: new ClockTrace(),
};

export const SWEEP_S = 4;
const STRIP_WIDTH = 188;
const STRIP_HEIGHT = 40;
const ERASURE_GAP_PX = 8;
const BASELINE_ROW = STRIP_HEIGHT * 0.62;
const R_WAVE_AMPLITUDE_PX = STRIP_HEIGHT * 0.5;

export function sweepColumn(t: number, width = STRIP_WIDTH): number {
  const phase = ((t % SWEEP_S) + SWEEP_S) % SWEEP_S;
  return Math.floor((phase / SWEEP_S) * width);
}

export function traceRow(value: number): number {
  return Math.min(STRIP_HEIGHT - 1, Math.max(1, BASELINE_ROW - value * R_WAVE_AMPLITUDE_PX));
}

export function EcgStrip() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isPersian = useInterfaceLanguage((s) => s.language === "fa");

  useEffect(() => {
    const el = canvasRef.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;

    const dpr = window.devicePixelRatio || 1;
    el.width = STRIP_WIDTH * dpr;
    el.height = STRIP_HEIGHT * dpr;
    ctx.scale(dpr, dpr);

    let frameId = 0;
    let prevPlayer: RhythmPlayer | null = null;
    let prevColumn = -1;
    let prevRow = BASELINE_ROW;

    const wipeColumns = (start: number, end: number) => {
      for (let x = start; x < end; x++) {
        const col = ((x % STRIP_WIDTH) + STRIP_WIDTH) % STRIP_WIDTH;
        ctx.clearRect(col, 0, 1, STRIP_HEIGHT);
        if (col % Math.round(STRIP_WIDTH / (SWEEP_S * 2)) === 0) {
          ctx.fillStyle = "rgba(74, 222, 128, 0.12)";
          ctx.fillRect(col, 0, 1, STRIP_HEIGHT);
        }
      }
    };

    const renderSweep = () => {
      frameId = requestAnimationFrame(renderSweep);
      const { player, now, clock } = HEART_TRACE;

      if (player !== prevPlayer) {
        prevPlayer = player;
        wipeColumns(0, STRIP_WIDTH);
        prevColumn = -1;
      }
      if (!player) return;

      const col = sweepColumn(now);
      if (prevColumn < 0) {
        prevColumn = col;
        prevRow = traceRow(player.ecgAt(clock.heartAt(now)));
        return;
      }

      const travelDistance = (col - prevColumn + STRIP_WIDTH) % STRIP_WIDTH;
      if (travelDistance === 0) return;
      const stepCount = Math.min(travelDistance, STRIP_WIDTH);

      ctx.strokeStyle = "#4ade80";
      ctx.lineWidth = 1.2;
      ctx.lineJoin = "round";

      for (let i = 1; i <= stepCount; i++) {
        const x = (prevColumn + i) % STRIP_WIDTH;
        const t = now - ((stepCount - i) / STRIP_WIDTH) * SWEEP_S;
        wipeColumns(x + 1, x + 1 + ERASURE_GAP_PX);
        wipeColumns(x, x + 1);

        const y = traceRow(player.ecgAt(clock.heartAt(t)));
        ctx.beginPath();
        ctx.moveTo(x === 0 ? 0 : x - 1, prevRow);
        ctx.lineTo(x, y);
        ctx.stroke();
        prevRow = y;
      }
      prevColumn = col;
    };

    frameId = requestAnimationFrame(renderSweep);
    return () => cancelAnimationFrame(frameId);
  }, []);

  return (
    <div className="mt-1">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={
          isPersian
            ? "نوار الکتروکاردیوگرام شماتیک از ریتم انتخابی، همگام با ضربان قلب"
            : "Schematic ECG trace of the chosen rhythm, drawn in time with the heart"
        }
        style={{ width: STRIP_WIDTH, height: STRIP_HEIGHT }}
        className="block rounded bg-slate-950"
      />
      <p className="mt-0.5 text-[8px] text-slate-500">
        {isPersian
          ? "نوار ECG شماتیک، مشابه اشتقاق II · ثبت واقعی بیمار نیست"
          : "Schematic ECG, lead II style · not a recording"}
      </p>
    </div>
  );
}
