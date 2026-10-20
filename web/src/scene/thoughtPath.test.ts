import { describe, expect, it } from "vitest";
import { advanceProgress, buildPath, pulseDurationSeconds, sampleAt } from "./thoughtPath";
import type { Vec3 } from "../types";

describe("thoughtPath", () => {
  it("buildPath totals segment lengths", () => {
    const wps: Vec3[] = [
      [0, 0, 0],
      [10, 0, 0],
      [10, 20, 0],
    ];
    const { total, points } = buildPath(wps);
    expect(points).toHaveLength(3);
    expect(total).toBeCloseTo(30, 5);
  });

  it("sampleAt hits endpoints and midpoints", () => {
    const { points, total } = buildPath([
      [0, 0, 0],
      [10, 0, 0],
    ]);
    expect(sampleAt(points, total, 0).x).toBeCloseTo(0, 5);
    expect(sampleAt(points, total, 1).x).toBeCloseTo(10, 5);
    expect(sampleAt(points, total, 0.5).x).toBeCloseTo(5, 5);
  });

  it("pulseDurationSeconds stays in a visible demo window for long MaleCNS paths", () => {
    expect(pulseDurationSeconds(123)).toBeGreaterThanOrEqual(1.4);
    expect(pulseDurationSeconds(123)).toBeLessThanOrEqual(3.6);
    expect(pulseDurationSeconds(1)).toBeGreaterThanOrEqual(1.4);
  });

  it("advanceProgress reaches 1 in roughly durationSec and clamps huge dt", () => {
    let p = 0;
    const duration = 2.5;
    for (let i = 0; i < 200; i++) p = advanceProgress(p, 1 / 60, duration);
    expect(p).toBe(1);
    // one huge frame must not jump past readable animation entirely from 0
    const jumped = advanceProgress(0, 30, duration);
    expect(jumped).toBeLessThan(0.2);
  });
});
