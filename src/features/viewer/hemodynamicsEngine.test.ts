import { describe, expect, it } from "vitest";
import {
  MAX_CONCURRENT_PULSES,
  VALVE_EJECTION_DELAY,
  VascularHemodynamicsEngine,
} from "./hemodynamicsEngine";

describe("Vascular Hemodynamics Engine (Specs-Derived Behavioral Tests)", () => {
  it("Scenario 1: Emitting a pulse records launch with valve ejection delay", () => {
    const engine = new VascularHemodynamicsEngine();
    const ages = new Float32Array(MAX_CONCURRENT_PULSES);
    const strengths = new Float32Array(MAX_CONCURRENT_PULSES);

    engine.emitSystolicEjection(2.0, 1.0);
    engine.stepSimulation(2.0, 0, ages, strengths);

    // At exact ejection time t=2.0, age relative to launch (2.06) is -0.06
    expect(ages[0]).toBeCloseTo(-VALVE_EJECTION_DELAY, 4);
    expect(strengths[0]).toBe(1.0);
  });

  it("Scenario 2: Pruning expired pulses and capping queue to 8 waves", () => {
    const engine = new VascularHemodynamicsEngine();
    const ages = new Float32Array(MAX_CONCURRENT_PULSES);
    const strengths = new Float32Array(MAX_CONCURRENT_PULSES);

    // Emit 15 pulses in rapid succession
    for (let i = 0; i < 15; i++) {
      engine.emitSystolicEjection(i * 0.1, 1.0);
    }

    engine.stepSimulation(1.5, 0.1, ages, strengths);

    // Queue is bounded to maximum slots
    expect(engine.activeWaveCount).toBeLessThanOrEqual(MAX_CONCURRENT_PULSES);
  });

  it("Scenario 3: Continuous beating accumulates steady venous return above 0.8", () => {
    const engine = new VascularHemodynamicsEngine();
    const ages = new Float32Array(MAX_CONCURRENT_PULSES);
    const strengths = new Float32Array(MAX_CONCURRENT_PULSES);

    const stepSize = 1 / 60;
    const interval = 60 / 72; // normal beat interval
    let time = 0;
    let nextBeat = 0;

    // Simulate 10 seconds of steady pumping
    while (time < 10) {
      if (time >= nextBeat) {
        engine.emitSystolicEjection(time, 1.0);
        nextBeat += interval;
      }
      engine.stepSimulation(time, stepSize, ages, strengths);
      time += stepSize;
    }

    expect(engine.venousFlowLevel).toBeGreaterThan(0.8);
  });

  it("Edge Case A: Zero beats lead to venous drainage down to 0", () => {
    const engine = new VascularHemodynamicsEngine();
    const ages = new Float32Array(MAX_CONCURRENT_PULSES);
    const strengths = new Float32Array(MAX_CONCURRENT_PULSES);

    // Step without emitting any pulses
    for (let t = 0; t < 5; t += 0.1) {
      engine.stepSimulation(t, 0.1, ages, strengths);
    }

    expect(engine.venousFlowLevel).toBe(0);
    expect(engine.activeWaveCount).toBe(0);
  });

  it("Edge Case B: Force <= 0 produces no pulse in the vessel stream", () => {
    const engine = new VascularHemodynamicsEngine();

    engine.emitSystolicEjection(1.0, 0);
    engine.emitSystolicEjection(1.1, -0.5);

    expect(engine.activeWaveCount).toBe(0);
  });
});
