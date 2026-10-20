import { describe, expect, it } from "vitest";
import { fitDistance } from "./cameraFrame";

describe("fitDistance", () => {
  it("ignores wider-than-tall aspect (vertical FOV limits) and zooms out when narrow", () => {
    const wide = fitDistance(100, 45, 1.6, 1.25);
    const square = fitDistance(100, 45, 1.0, 1.25);
    const narrow = fitDistance(100, 45, 0.55, 1.25);
    // aspect >= 1 → vertical FOV is tighter → same distance
    expect(wide).toBeCloseTo(square, 5);
    expect(narrow).toBeGreaterThan(square);
  });

  it("scales linearly with radius and padding", () => {
    const a = fitDistance(50, 45, 1, 1.25);
    const b = fitDistance(100, 45, 1, 1.25);
    const c = fitDistance(100, 45, 1, 1.5);
    expect(b / a).toBeCloseTo(2, 5);
    expect(c / b).toBeCloseTo(1.5 / 1.25, 5);
  });

  it("is farther than the old fixed ~1.57×radius multiplier for typical FOV", () => {
    // Old CameraFramer used offset length ≈ 1.57 * radius — often clipped AABB corners.
    const dist = fitDistance(100, 45, 1, 1.25);
    expect(dist).toBeGreaterThan(157);
  });
});
