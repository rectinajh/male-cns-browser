import { create } from "zustand";

type BrowserState = {
  selectedId: number | null;
  hoveredId: number | null;
  thoughtId: string | null;
  playing: boolean;
  setSelectedId: (id: number | null) => void;
  setHoveredId: (id: number | null) => void;
  setThoughtId: (id: string | null) => void;
  setPlaying: (playing: boolean) => void;
};

export const useBrowserStore = create<BrowserState>((set) => ({
  selectedId: null,
  hoveredId: null,
  thoughtId: null,
  playing: false,
  setSelectedId: (id) => set({ selectedId: id }),
  setHoveredId: (id) => set({ hoveredId: id }),
  setThoughtId: (id) => set({ thoughtId: id }),
  setPlaying: (playing) => set({ playing }),
}));
