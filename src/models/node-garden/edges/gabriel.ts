import type { NodeState, EdgeResult } from "../simulation";
import type { NodeGardenParams } from "../params";

/** 直径球内に他ノードが存在しない辺のみ接続する Gabriel グラフ */
export function computeGabrielEdges(state: NodeState, _params: NodeGardenParams): EdgeResult {
  const { nodeCount, positions } = state;

  const tmpPairs: number[] = [];
  const tmpDists: number[] = [];

  for (let i = 0; i < nodeCount; i++) {
    const i3 = i * 3;
    for (let j = i + 1; j < nodeCount; j++) {
      const j3 = j * 3;
      // 中点
      const mx = (positions[i3] + positions[j3]) * 0.5;
      const my = (positions[i3 + 1] + positions[j3 + 1]) * 0.5;
      const mz = (positions[i3 + 2] + positions[j3 + 2]) * 0.5;
      // 半径の二乗
      const dx = positions[i3] - positions[j3];
      const dy = positions[i3 + 1] - positions[j3 + 1];
      const dz = positions[i3 + 2] - positions[j3 + 2];
      const radiusSq = (dx * dx + dy * dy + dz * dz) * 0.25;

      let isGabriel = true;
      for (let k = 0; k < nodeCount; k++) {
        if (k === i || k === j) continue;
        const k3 = k * 3;
        const ex = positions[k3] - mx;
        const ey = positions[k3 + 1] - my;
        const ez = positions[k3 + 2] - mz;
        if (ex * ex + ey * ey + ez * ez < radiusSq) {
          isGabriel = false;
          break;
        }
      }

      if (isGabriel) {
        tmpPairs.push(i, j);
        tmpDists.push(Math.sqrt(dx * dx + dy * dy + dz * dz));
      }
    }
  }

  return {
    pairs: new Uint32Array(tmpPairs),
    distances: new Float32Array(tmpDists),
    count: tmpDists.length,
  };
}
