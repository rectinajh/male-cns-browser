import type { NeighborLink } from "../data/ConnectomeSource";
import type { Neuron } from "../types";

type Props = {
  neuron: Neuron | null;
  neighbors: NeighborLink[];
  onSelectNeighbor: (id: number) => void;
};

export function NeuronDetails({ neuron, neighbors, onSelectNeighbor }: Props) {
  if (!neuron) {
    return (
      <p className="muted">点击关键节点，或从列表中选择一个神经元。</p>
    );
  }

  return (
    <div className="details">
      <h3>{neuron.name}</h3>
      <dl>
        <dt>编号</dt>
        <dd>{neuron.id}</dd>
        <dt>类型</dt>
        <dd>{neuron.type}</dd>
        <dt>侧别</dt>
        <dd>{neuron.side}</dd>
        <dt>胞体</dt>
        <dd>
          [{neuron.soma.map((v) => v.toFixed(2)).join(", ")}]
        </dd>
      </dl>
      <h4>邻居（{neighbors.length}）</h4>
      {neighbors.length === 0 ? (
        <p className="muted">当前子集中无邻居。</p>
      ) : (
        <ul className="neighbor-list">
          {neighbors.map((n) => (
            <li key={`${n.direction}-${n.neuron.id}`}>
              <button type="button" onClick={() => onSelectNeighbor(n.neuron.id)}>
                <span className="dir">{n.direction === "out" ? "→" : "←"}</span>
                <span>
                  {n.neuron.name}{" "}
                  <span className="muted">（{n.neuron.type}）</span>
                </span>
                <span className="weight">权重={n.weight}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
