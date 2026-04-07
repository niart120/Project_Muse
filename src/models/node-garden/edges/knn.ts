import type { NodeState, EdgeResult } from "../simulation";
import type { NodeGardenParams } from "../params";

/** 各ノードの k-最近傍と接続する（和集合で対称化） */
export function computeKnnEdges(state: NodeState, params: NodeGardenParams): EdgeResult {
  const { nodeCount, positions } = state;
  const k = Math.min(params.knnK, nodeCount - 1);

  if (k <= 0) {
    return { pairs: new Uint32Array(0), distances: new Float32Array(0), count: 0 };
  }

  // 各ノード → k 近傍インデックスを保持
  const edgeSet = new Set<number>();

  // 距離テーブル: [距離, インデックス] を k 個保持
  for (let i = 0; i < nodeCount; i++) {
    const ix = positions[i * 3];
    const iy = positions[i * 3 + 1];
    const iz = positions[i * 3 + 2];

    // k 最近傍を選択（単純ソート。N ≤ 200 なら十分高速）
    const dists: { j: number; distSq: number }[] = [];
    for (let j = 0; j < nodeCount; j++) {
      if (j === i) continue;
      const dx = ix - positions[j * 3];
      const dy = iy - positions[j * 3 + 1];
      const dz = iz - positions[j * 3 + 2];
      dists.push({ j, distSq: dx * dx + dy * dy + dz * dz });
    }
    dists.sort((a, b) => a.distSq - b.distSq);

    for (let t = 0; t < k; t++) {
      const j = dists[t].j;
      // 正規化キー: 小さい方を上位に
      const lo = Math.min(i, j);
      const hi = Math.max(i, j);
      edgeSet.add(lo * nodeCount + hi);
    }
  }

  const tmpPairs: number[] = [];
  const tmpDists: number[] = [];

  for (const key of edgeSet) {
    const lo = Math.floor(key / nodeCount);
    const hi = key % nodeCount;
    const dx = positions[lo * 3] - positions[hi * 3];
    const dy = positions[lo * 3 + 1] - positions[hi * 3 + 1];
    const dz = positions[lo * 3 + 2] - positions[hi * 3 + 2];
    tmpPairs.push(lo, hi);
    tmpDists.push(Math.sqrt(dx * dx + dy * dy + dz * dz));
  }

  return {
    pairs: new Uint32Array(tmpPairs),
    distances: new Float32Array(tmpDists),
    count: tmpDists.length,
  };
}
