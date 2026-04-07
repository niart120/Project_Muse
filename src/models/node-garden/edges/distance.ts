import type { NodeState, EdgeResult } from "../simulation";
import type { NodeGardenParams } from "../params";

/** 距離閾値以内のノード対を返す */
export function computeDistanceEdges(state: NodeState, params: NodeGardenParams): EdgeResult {
  const maxDistSq = params.edgeMaxDistance * params.edgeMaxDistance;
  const { nodeCount, positions } = state;

  const tmpPairs: number[] = [];
  const tmpDists: number[] = [];

  for (let i = 0; i < nodeCount; i++) {
    const ix = positions[i * 3];
    const iy = positions[i * 3 + 1];
    const iz = positions[i * 3 + 2];

    for (let j = i + 1; j < nodeCount; j++) {
      const dx = ix - positions[j * 3];
      const dy = iy - positions[j * 3 + 1];
      const dz = iz - positions[j * 3 + 2];
      const distSq = dx * dx + dy * dy + dz * dz;

      if (distSq < maxDistSq) {
        tmpPairs.push(i, j);
        tmpDists.push(Math.sqrt(distSq));
      }
    }
  }

  return {
    pairs: new Uint32Array(tmpPairs),
    distances: new Float32Array(tmpDists),
    count: tmpDists.length,
  };
}
