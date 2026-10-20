export type Vec3 = [number, number, number];

export type Neuron = {
  id: number;
  name: string;
  type: string;
  side: "L" | "R" | "C" | string;
  soma: Vec3;
  skeleton: Vec3[];
};

export type Edge = { from: number; to: number; weight: number };

export type Thought = {
  id: string;
  label: string;
  waypoints: number[];
};

export type SubsetMeta = {
  dataset: string;
  source: string;
  license: string;
  neuronCount: number;
  exportedAt: string;
};

export type SubsetFile = {
  meta: SubsetMeta;
  neurons: Neuron[];
  edges: Edge[];
  thoughts: Thought[];
};
