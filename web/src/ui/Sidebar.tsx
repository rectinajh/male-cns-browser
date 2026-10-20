import { useMemo, useState } from "react";
import type { LocalJsonSource } from "../data/LocalJsonSource";
import type { SubsetFile } from "../types";
import { useBrowserStore } from "../state/useBrowserStore";
import { NeuronDetails } from "./NeuronDetails";
import { ThoughtControls } from "./ThoughtControls";

type Props = {
  data: SubsetFile;
  source: LocalJsonSource;
};

export function Sidebar({ data, source }: Props) {
  const [query, setQuery] = useState("");
  const selectedId = useBrowserStore((s) => s.selectedId);
  const thoughtId = useBrowserStore((s) => s.thoughtId);
  const playing = useBrowserStore((s) => s.playing);
  const setSelectedId = useBrowserStore((s) => s.setSelectedId);
  const setThoughtId = useBrowserStore((s) => s.setThoughtId);
  const setPlaying = useBrowserStore((s) => s.setPlaying);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data.neurons;
    return data.neurons.filter(
      (n) =>
        String(n.id).includes(q) ||
        n.name.toLowerCase().includes(q) ||
        n.type.toLowerCase().includes(q) ||
        n.side.toLowerCase().includes(q),
    );
  }, [data.neurons, query]);

  const selected = selectedId != null ? source.getNeuron(selectedId) ?? null : null;
  const neighbors = selectedId != null ? source.neighbors(selectedId) : [];

  const activeThoughtId = thoughtId ?? data.thoughts[0]?.id ?? null;

  return (
    <aside className="sidebar">
      <header className="sidebar-header">
        <h1>Male CNS Browser</h1>
        <p className="muted">
          {data.meta.neuronCount} neurons · {data.meta.dataset}
        </p>
      </header>

      <section>
        <h3>Neuron browser</h3>
        <input
          className="search"
          type="search"
          placeholder="Search id / name / type…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <ul className="neuron-list">
          {filtered.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                className={n.id === selectedId ? "active" : ""}
                onClick={() => setSelectedId(n.id)}
              >
                <strong>{n.name}</strong>
                <span className="muted">
                  {n.type} · {n.side} · #{n.id}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <NeuronDetails
          neuron={selected ?? null}
          neighbors={neighbors}
          onSelectNeighbor={setSelectedId}
        />
      </section>

      <section>
        <ThoughtControls
          thoughts={data.thoughts}
          thoughtId={activeThoughtId}
          playing={playing}
          onSelectThought={(id) => {
            setThoughtId(id);
          }}
          onThink={() => {
            if (!activeThoughtId) return;
            setThoughtId(activeThoughtId);
            setPlaying(true);
          }}
        />
      </section>

      <footer className="sidebar-footer muted">
        Real MaleCNS v1.0 SWC subset ·{" "}
        <a href="https://male-cns.janelia.org/" target="_blank" rel="noreferrer">
          MaleCNS
        </a>{" "}
        (CC-BY FlyEM / HHMI Janelia).
      </footer>
    </aside>
  );
}
