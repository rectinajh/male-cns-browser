import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { writeLightningBolt, writeLightningBranch } from "./ThoughtPulse";

describe("lightning writers", () => {
  const smooth = [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(10, 0, 0),
    new THREE.Vector3(20, 5, 0),
  ];
  const total = 10 + Math.hypot(10, 5);

  it("writeLightningBolt returns verts on the path and stays in buffer", () => {
    const out = new Float32Array(72 * 3);
    const n = writeLightningBolt(smooth, total, 0.8, out, {
      maxVerts: 72,
      amplitude: 0.5,
      seed: 42,
    });
    expect(n).toBeGreaterThan(4);
    expect(n).toBeLessThanOrEqual(72);
    // Start near origin
    expect(out[0]).toBeCloseTo(0, 5);
    expect(out[1]).toBeCloseTo(0, 5);
    // End near tip sample
    const endX = out[(n - 1) * 3];
    expect(endX).toBeGreaterThan(5);
  });

  it("writeLightningBolt at t=0 writes nothing useful", () => {
    const out = new Float32Array(24);
    expect(writeLightningBolt(smooth, total, 0, out, { maxVerts: 8, amplitude: 1, seed: 1 })).toBe(0);
  });

  it("writeLightningBranch forks sideways near the tip", () => {
    const out = new Float32Array(5 * 3);
    const n = writeLightningBranch(smooth, total, 0.9, out, {
      segs: 5,
      amplitude: 1.2,
      seed: 99,
      side: 1,
    });
    expect(n).toBe(5);
    // Branch root and tip should differ
    const d = Math.hypot(out[0] - out[12], out[1] - out[13], out[2] - out[14]);
    expect(d).toBeGreaterThan(0.1);
  });
});
