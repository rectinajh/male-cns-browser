import { describe, expect, it } from "vitest";
import {
  advanceProgress,
  buildPath,
  buildThoughtConductancePath,
  closestPair,
  pickRandomThoughtChain,
  pulseDurationSeconds,
  sampleAt,
  uniqueSkeletonPoints,
  walkSkeletonToward,
} from "./thoughtPath";
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
    expect(pulseDurationSeconds(123)).toBeGreaterThanOrEqual(1.5);
    expect(pulseDurationSeconds(123)).toBeLessThanOrEqual(4.0);
    expect(pulseDurationSeconds(1)).toBeGreaterThanOrEqual(1.5);
  });

  it("advanceProgress reaches 1 in roughly durationSec and clamps huge dt", () => {
    let p = 0;
    const duration = 2.5;
    for (let i = 0; i < 200; i++) p = advanceProgress(p, 1 / 60, duration);
    expect(p).toBe(1);
    const jumped = advanceProgress(0, 30, duration);
    expect(jumped).toBeLessThan(0.2);
  });

  it("uniqueSkeletonPoints dedupes interleaved segment pairs", () => {
    const sk: Vec3[] = [
      [0, 0, 0],
      [1, 0, 0],
      [1, 0, 0],
      [2, 0, 0],
    ];
    expect(uniqueSkeletonPoints(sk)).toHaveLength(3);
  });

  it("closestPair finds the contact between two arbors", () => {
    const a: Vec3[] = [
      [0, 0, 0],
      [5, 0, 0],
    ];
    const b: Vec3[] = [
      [6, 0, 0],
      [10, 0, 0],
    ];
    const c = closestPair(a, b);
    expect(c.a).toEqual([5, 0, 0]);
    expect(c.b).toEqual([6, 0, 0]);
    expect(c.dist).toBeCloseTo(1, 5);
  });

  it("walkSkeletonToward follows the arbor toward the target", () => {
    const cloud: Vec3[] = [
      [0, 0, 0],
      [2, 0, 0],
      [4, 0, 0],
      [6, 0, 0],
      [8, 0, 0],
    ];
    const path = walkSkeletonToward(cloud, [0, 0, 0], [8, 0, 0], { localRadius: 3 });
    expect(path[0]).toEqual([0, 0, 0]);
    expect(path[path.length - 1]).toEqual([8, 0, 0]);
    expect(path.length).toBeGreaterThan(2);
  });

  it("buildThoughtConductancePath hugs skeletons instead of soma chords", () => {
    // Two neurons whose arbors meet near x=5, while somas are far apart on Y.
    const chain = [
      {
        soma: [0, 20, 0] as Vec3,
        skeleton: [
          [0, 20, 0],
          [0, 10, 0],
          [0, 10, 0],
          [0, 0, 0],
          [0, 0, 0],
          [5, 0, 0],
        ] as Vec3[],
      },
      {
        soma: [10, 20, 0] as Vec3,
        skeleton: [
          [5.2, 0, 0],
          [10, 0, 0],
          [10, 0, 0],
          [10, 20, 0],
        ] as Vec3[],
      },
    ];
    const path = buildThoughtConductancePath(chain);
    expect(path.length).toBeGreaterThan(3);

    // Must pass near the arbor contact (~5,0,0), not only the soma-soma chord.
    const nearContact = path.some((p) => Math.hypot(p[0] - 5, p[1], p[2]) < 1.5);
    expect(nearContact).toBe(true);

    // Path length should exceed the empty soma-to-soma hop (10 units on X, same Y would be shorter;
    // here somas are [0,20]→[10,20] = 10, but hugging goes down and across).
    const { total } = buildPath(path);
    expect(total).toBeGreaterThan(10);
  });

  it("pickRandomThoughtChain follows edges, varies by seed, and stays in length bounds", () => {
    const edges = [
      { from: 1, to: 2, weight: 10 },
      { from: 2, to: 3, weight: 10 },
      { from: 3, to: 4, weight: 10 },
      { from: 4, to: 5, weight: 10 },
      { from: 1, to: 5, weight: 1 },
      { from: 2, to: 5, weight: 1 },
      { from: 5, to: 3, weight: 5 },
      { from: 3, to: 1, weight: 2 },
    ];

    const seqA = [0.01, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
    let i = 0;
    const rngA = () => seqA[i++ % seqA.length];
    const pathA = pickRandomThoughtChain(edges, { minLen: 3, maxLen: 5, rng: rngA });
    expect(pathA.length).toBeGreaterThanOrEqual(3);
    expect(pathA.length).toBeLessThanOrEqual(5);
    expect(new Set(pathA).size).toBe(pathA.length);

    for (let k = 0; k < pathA.length - 1; k++) {
      const hop = edges.some((e) => e.from === pathA[k] && e.to === pathA[k + 1]);
      expect(hop).toBe(true);
    }

    const seqB = [0.99, 0.85, 0.7, 0.55, 0.4, 0.25, 0.1, 0.05, 0.15, 0.35];
    let j = 0;
    const rngB = () => seqB[j++ % seqB.length];
    const pathB = pickRandomThoughtChain(edges, { minLen: 3, maxLen: 5, rng: rngB });
    expect(pathB.length).toBeGreaterThanOrEqual(3);
    // Different RNG streams should usually yield different routes.
    expect(pathA.join(",")).not.toBe(pathB.join(","));
  });

  it("pickRandomThoughtChain returns empty when there are no usable edges", () => {
    expect(pickRandomThoughtChain([])).toEqual([]);
    expect(pickRandomThoughtChain([{ from: 1, to: 1, weight: 9 }])).toEqual([]);
  });

});
