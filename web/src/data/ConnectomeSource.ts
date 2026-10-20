import type { Neuron, SubsetFile, Thought } from "../types";

export type NeighborLink = {
  neuron: Neuron;
  weight: number;
  direction: "in" | "out";
};

export interface ConnectomeSource {
  load(): Promise<SubsetFile>;
  getNeuron(id: number): Neuron | undefined;
  neighbors(id: number): NeighborLink[];
  listThoughts(): Thought[];
}
