export type Vec3 = [number, number, number];

export type Neuron = {
  id: number;
  name: string;
  type: string;
  side: "L" | "R" | "C" | string;
  soma: Vec3;
  /** Either a polyline or interleaved segment endpoint pairs (see meta.skeletonFormat). */
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
  edgeCount?: number;
  skeletonFormat?: string;
  scale?: {
    scale: number;
    centroid_voxel?: number[];
    flip_y?: boolean;
    swap_yz?: boolean;
    long_axis?: number;
    voxel_nm?: number;
    note?: string;
  };
  swcUrlTemplate?: string;
};

export type SubsetFile = {
  meta: SubsetMeta;
  neurons: Neuron[];
  edges: Edge[];
  thoughts: Thought[];
};
