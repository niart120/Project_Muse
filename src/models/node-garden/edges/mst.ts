import type { NodeState, EdgeResult } from "../simulation";
import type { NodeGardenParams } from "../params";

function createUnionFind(n: number): {
  find(x: number): number;
  union(x: number, y: number): boolean;
} {
  const parent = new Int32Array(n);
  const rank = new Uint8Array(n);
  for (let i = 0; i < n; i++) parent[i] = i;

  function find(x: number): number {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]]; // path compression
      x = parent[x];
    }
    return x;
  }

  function union(x: number, y: number): boolean {
    const rx = find(x);
    const ry = find(y);
    if (rx === ry) return false;
    if (rank[rx] < rank[ry]) {
      parent[rx] = ry;
    } else if (rank[rx] > rank[ry]) {
      parent[ry] = rx;
    } else {
      parent[ry] = rx;
      rank[rx]++;
    }
    return true;
  }

  return { find, union };
}

/** Kruskal 法で最小全域木を構築する */
export function computeMstEdges(state: NodeState, _params: NodeGardenParams): EdgeResult {
  const { nodeCount, positions } = state;

  if (nodeCount < 2) {
    return { pairs: new Uint32Array(0), distances: new Float32Array(0), count: 0 };
  }

  // 全ペアの辺を列挙
  const edges: { i: number; j: number; distSq: number }[] = [];
  for (let i = 0; i < nodeCount; i++) {
    const ix = positions[i * 3];
    const iy = positions[i * 3 + 1];
    const iz = positions[i * 3 + 2];
    for (let j = i + 1; j < nodeCount; j++) {
      const dx = ix - positions[j * 3];
      const dy = iy - positions[j * 3 + 1];
      const dz = iz - positions[j * 3 + 2];
      edges.push({ i, j, distSq: dx * dx + dy * dy + dz * dz });
    }
  }

  edges.sort((a, b) => a.distSq - b.distSq);

  const uf = createUnionFind(nodeCount);
  const tmpPairs: number[] = [];
  const tmpDists: number[] = [];

  for (const e of edges) {
    if (uf.union(e.i, e.j)) {
      tmpPairs.push(e.i, e.j);
      tmpDists.push(Math.sqrt(e.distSq));
      if (tmpDists.length === nodeCount - 1) break;
    }
  }

  return {
    pairs: new Uint32Array(tmpPairs),
    distances: new Float32Array(tmpDists),
    count: tmpDists.length,
  };
}
