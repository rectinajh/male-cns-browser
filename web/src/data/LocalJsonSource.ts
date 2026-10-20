import type { Edge, Neuron, SubsetFile, Thought } from "../types";
import type { ConnectomeSource, NeighborLink } from "./ConnectomeSource";

export class LocalJsonSource implements ConnectomeSource {
  private data: SubsetFile | null = null;
  private byId = new Map<number, Neuron>();
  private outEdges = new Map<number, Edge[]>();
  private inEdges = new Map<number, Edge[]>();
  private readonly url: string;

  constructor(url = "/data/subset.json") {
    this.url = url;
  }

  async load(): Promise<SubsetFile> {
    if (this.data) return this.data;

    const res = await fetch(this.url);
    if (!res.ok) {
      throw new Error(`Failed to load connectome subset: ${res.status} ${res.statusText}`);
    }
    const json = (await res.json()) as SubsetFile;
    this.ingest(json);
    return json;
  }

  /** Load from an already-parsed SubsetFile (tests / offline). */
  loadFrom(data: SubsetFile): SubsetFile {
    this.ingest(data);
    return data;
  }

  getNeuron(id: number): Neuron | undefined {
    return this.byId.get(id);
  }

  neighbors(id: number): NeighborLink[] {
    const out: NeighborLink[] = [];
    for (const e of this.outEdges.get(id) ?? []) {
      const neuron = this.byId.get(e.to);
      if (neuron) out.push({ neuron, weight: e.weight, direction: "out" });
    }
    for (const e of this.inEdges.get(id) ?? []) {
      const neuron = this.byId.get(e.from);
      if (neuron) out.push({ neuron, weight: e.weight, direction: "in" });
    }
    return out;
  }

  listThoughts(): Thought[] {
    return this.data?.thoughts ?? [];
  }

  get subset(): SubsetFile | null {
    return this.data;
  }

  private ingest(data: SubsetFile): void {
    this.data = data;
    this.byId = new Map(data.neurons.map((n) => [n.id, n]));
    this.outEdges = new Map();
    this.inEdges = new Map();
    for (const e of data.edges) {
      const outs = this.outEdges.get(e.from) ?? [];
      outs.push(e);
      this.outEdges.set(e.from, outs);
      const ins = this.inEdges.get(e.to) ?? [];
      ins.push(e);
      this.inEdges.set(e.to, ins);
    }
  }
}
