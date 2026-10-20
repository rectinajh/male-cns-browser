import { useMemo } from "react";
import * as THREE from "three";
import type { Edge, Neuron } from "../types";
import { colorForType, dimColor } from "./colorForType";

type Props = {
  neurons: Neuron[];
  edges: Edge[];
  selectedId: number | null;
  neighborIds: Set<number>;
  /** Neurons on the active thought chain — brighten their filaments. */
  chainIds?: Set<number>;
  /** skeleton is interleaved segment pairs when true (MaleCNS export). */
  segmentPairs?: boolean;
};

export function NeuronLines({
  neurons,
  edges,
  selectedId,
  neighborIds,
  chainIds,
  segmentPairs = true,
}: Props) {
  const { positions, colors } = useMemo(() => {
    const pos: number[] = [];
    const col: number[] = [];

    for (const n of neurons) {
      const base = colorForType(n.type);
      const isSel = n.id === selectedId;
      const isN = neighborIds.has(n.id);
      const onChain = chainIds?.has(n.id) ?? false;
      let c: THREE.Color;
      if (onChain) {
        c = base.clone().lerp(new THREE.Color("#3BA7FF"), 0.4);
        c.offsetHSL(0, 0.05, 0.1);
      } else if (isSel) {
        c = base.clone().lerp(new THREE.Color("#ffffff"), 0.2);
        c.offsetHSL(0, 0.02, 0.06);
      } else if (isN) {
        c = base.clone().offsetHSL(0, 0, 0.05);
      } else if (selectedId != null || (chainIds && chainIds.size > 0)) {
        c = dimColor(base, chainIds && chainIds.size > 0 ? 0.55 : 0.62);
      } else {
        c = base;
      }

      const sk = n.skeleton;
      if (segmentPairs) {
        for (let i = 0; i + 1 < sk.length; i += 2) {
          pos.push(sk[i][0], sk[i][1], sk[i][2], sk[i + 1][0], sk[i + 1][1], sk[i + 1][2]);
          col.push(c.r, c.g, c.b, c.r, c.g, c.b);
        }
      } else {
        for (let i = 0; i < sk.length - 1; i++) {
          pos.push(sk[i][0], sk[i][1], sk[i][2], sk[i + 1][0], sk[i + 1][1], sk[i + 1][2]);
          col.push(c.r, c.g, c.b, c.r, c.g, c.b);
        }
      }
    }
    return {
      positions: new Float32Array(pos),
      colors: new Float32Array(col),
    };
  }, [neurons, selectedId, neighborIds, chainIds, segmentPairs]);

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
        <lineBasicMaterial vertexColors transparent opacity={0.42} />
      </lineSegments>
      {neighborEdgeGeo && (
        <lineSegments geometry={neighborEdgeGeo}>
          <lineBasicMaterial color="#3d6a8c" transparent opacity={0.5} />
        </lineSegments>
      )}
    </group>
  );
}
