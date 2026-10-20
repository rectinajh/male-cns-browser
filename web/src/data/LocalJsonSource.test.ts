import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { SubsetFile } from "../types";
import { LocalJsonSource } from "./LocalJsonSource";

const here = dirname(fileURLToPath(import.meta.url));

function loadFixture(): SubsetFile {
  const path = resolve(here, "../../public/data/subset.json");
  return JSON.parse(readFileSync(path, "utf-8")) as SubsetFile;
}

describe("LocalJsonSource", () => {
  it("loads fixture with expected meta and counts", () => {
    const src = new LocalJsonSource();
    const data = src.loadFrom(loadFixture());
    expect(data.meta.dataset).toContain("male-cns");
    expect(data.meta.license).toMatch(/CC-BY/i);
    expect(data.neurons.length).toBeGreaterThanOrEqual(8);
    expect(data.edges.length).toBeGreaterThanOrEqual(10);
    expect(data.thoughts.length).toBeGreaterThanOrEqual(1);
    expect(data.meta.neuronCount).toBe(data.neurons.length);
  });

  it("getNeuron returns known cell", () => {
    const src = new LocalJsonSource();
    src.loadFrom(loadFixture());
    const n = src.getNeuron(2001);
    expect(n).toBeDefined();
    expect(n?.name).toBe("IN_hub");
    expect(n?.soma).toHaveLength(3);
    expect(n?.skeleton.length).toBeGreaterThan(1);
  });

  it("neighbors returns in and out links", () => {
    const src = new LocalJsonSource();
    src.loadFrom(loadFixture());
    const links = src.neighbors(2001);
    expect(links.length).toBeGreaterThan(0);
    const dirs = new Set(links.map((l) => l.direction));
    expect(dirs.has("in") || dirs.has("out")).toBe(true);
    expect(links.every((l) => l.weight > 0)).toBe(true);
    expect(links.every((l) => typeof l.neuron.id === "number")).toBe(true);
  });

  it("listThoughts includes escape-demo with waypoints on existing neurons", () => {
    const src = new LocalJsonSource();
    const data = src.loadFrom(loadFixture());
    const thoughts = src.listThoughts();
    const escape = thoughts.find((t) => t.id === "escape-demo");
    expect(escape).toBeDefined();
    expect(escape!.waypoints.length).toBeGreaterThanOrEqual(4);
    const ids = new Set(data.neurons.map((n) => n.id));
    for (const w of escape!.waypoints) {
      expect(ids.has(w)).toBe(true);
    }
  });

  it("brain+neck+VNC silhouette spans y range", () => {
    const src = new LocalJsonSource();
    const data = src.loadFrom(loadFixture());
    const ys = data.neurons.map((n) => n.soma[1]);
    expect(Math.max(...ys)).toBeGreaterThan(0.5);
    expect(Math.min(...ys)).toBeLessThan(-0.3);
  });
});
