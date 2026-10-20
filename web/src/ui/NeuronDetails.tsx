import type { NeighborLink } from "../data/ConnectomeSource";
import type { Neuron } from "../types";

type Props = {
  neuron: Neuron | null;
  neighbors: NeighborLink[];
  onSelectNeighbor: (id: number) => void;
};

export function NeuronDetails({ neuron, neighbors, onSelectNeighbor }: Props) {
  if (!neuron) {
    return <p className="muted">Click a key node or pick a neuron from the list.</p>;
  }

  return (
    <div className="details">
      <h3>{neuron.name}</h3>
      <dl>
        <dt>ID</dt>
        <dd>{neuron.id}</dd>
        <dt>Type</dt>
        <dd>{neuron.type}</dd>
        <dt>Side</dt>
        <dd>{neuron.side}</dd>
        <dt>Soma</dt>
        <dd>
          [{neuron.soma.map((v) => v.toFixed(2)).join(", ")}]
        </dd>
      </dl>
      <h4>Neighbors ({neighbors.length})</h4>
      {neighbors.length === 0 ? (
        <p className="muted">No neighbors in subset.</p>
      ) : (
        <ul className="neighbor-list">
          {neighbors.map((n) => (
            <li key={`${n.direction}-${n.neuron.id}`}>
              <button type="button" onClick={() => onSelectNeighbor(n.neuron.id)}>
                <span className="dir">{n.direction === "out" ? "→" : "←"}</span>
                <span>
                  {n.neuron.name}{" "}
                  <span className="muted">({n.neuron.type})</span>
                </span>
                <span className="weight">w={n.weight}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
