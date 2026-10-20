import { create } from "zustand";

type BrowserState = {
  selectedId: number | null;
  hoveredId: number | null;
  /** Optional preset thought id (demo paths in subset.json). */
  thoughtId: string | null;
  /** Neuron-id chain for the current / last conduction (random or preset). */
  activeChain: number[] | null;
  playing: boolean;
  setSelectedId: (id: number | null) => void;
  setHoveredId: (id: number | null) => void;
  setThoughtId: (id: string | null) => void;
  setActiveChain: (chain: number[] | null) => void;
  setPlaying: (playing: boolean) => void;
};

export const useBrowserStore = create<BrowserState>((set) => ({
  selectedId: null,
  hoveredId: null,
  thoughtId: null,
  activeChain: null,
  playing: false,
  setSelectedId: (id) => set({ selectedId: id }),
  setHoveredId: (id) => set({ hoveredId: id }),
  setThoughtId: (id) => set({ thoughtId: id }),
  setActiveChain: (chain) => set({ activeChain: chain }),
  setPlaying: (playing) => set({ playing }),
}));
