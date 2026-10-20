import { useMemo } from "react";
import * as THREE from "three";
import type { Edge, Neuron } from "../types";

type Props = {
  neurons: Neuron[];
  edges: Edge[];
  selectedId: number | null;
  neighborIds: Set<number>;
};

export function NeuronLines({ neurons, edges, selectedId, neighborIds }: Props) {
  const { positions, colors } = useMemo(() => {
    const pos: number[] = [];
    const col: number[] = [];
    const dim = new THREE.Color("#4a6280");
    const bright = new THREE.Color("#9ed0ff");
    const mid = new THREE.Color("#6a90b8");

    for (const n of neurons) {
      const isSel = n.id === selectedId;
      const isN = neighborIds.has(n.id);
      const c = isSel ? bright : isN ? mid : dim;
      const sk = n.skeleton;
      for (let i = 0; i < sk.length - 1; i++) {
        pos.push(sk[i][0], sk[i][1], sk[i][2], sk[i + 1][0], sk[i + 1][1], sk[i + 1][2]);
        col.push(c.r, c.g, c.b, c.r, c.g, c.b);
      }
    }
    return {
      positions: new Float32Array(pos),
      colors: new Float32Array(col),
    };
  }, [neurons, selectedId, neighborIds]);

  const neighborEdgeGeo = useMemo(() => {
    if (selectedId == null) return null;
    const byId = new Map(neurons.map((n) => [n.id, n]));
    const pos: number[] = [];
    for (const e of edges) {
      const touches =
        (e.from === selectedId && neighborIds.has(e.to)) ||
        (e.to === selectedId && neighborIds.has(e.from));
      if (!touches) continue;
      const a = byId.get(e.from)?.soma;
      const b = byId.get(e.to)?.soma;
      if (!a || !b) continue;
      pos.push(a[0], a[1], a[2], b[0], b[1], b[2]);
    }
    if (pos.length === 0) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    return geo;
  }, [neurons, edges, selectedId, neighborIds]);

  const lineGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return geo;
  }, [positions, colors]);

  return (
    <group>
      <lineSegments geometry={lineGeo}>
        <lineBasicMaterial vertexColors transparent opacity={0.85} />
      </lineSegments>
      {neighborEdgeGeo && (
        <lineSegments geometry={neighborEdgeGeo}>
          <lineBasicMaterial color="#7ec8ff" transparent opacity={0.95} linewidth={2} />
        </lineSegments>
      )}
    </group>
  );
}
