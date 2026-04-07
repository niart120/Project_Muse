import type { NodeState, EdgeResult } from "../simulation";
import type { NodeGardenParams } from "../params";

/**
 * 球面ドロネー三角形分割 (3D 凸包の双対)
 *
 * 球面上の点を 3D 凸包の頂点とみなし、凸包の辺 = ドロネーエッジとする。
 * インクリメンタル法で凸包を構築する。N ≤ 200 の範囲では十分高速。
 */
export function computeDelaunayEdges(state: NodeState, _params: NodeGardenParams): EdgeResult {
  const { nodeCount, positions } = state;

  if (nodeCount < 2) {
    return { pairs: new Uint32Array(0), distances: new Float32Array(0), count: 0 };
  }
  if (nodeCount === 2) {
    const dx = positions[0] - positions[3];
    const dy = positions[1] - positions[4];
    const dz = positions[2] - positions[5];
    return {
      pairs: new Uint32Array([0, 1]),
      distances: new Float32Array([Math.sqrt(dx * dx + dy * dy + dz * dz)]),
      count: 1,
    };
  }
  if (nodeCount === 3) {
    return buildTriangleResult(positions, [0, 1, 2]);
  }

  // 凸包をインクリメンタルに構築する
  const faces = convexHull(positions, nodeCount);

  // 面の辺を抽出（重複除去）
  const edgeSet = new Set<number>();
  for (let f = 0; f < faces.length; f += 3) {
    const a = faces[f];
    const b = faces[f + 1];
    const c = faces[f + 2];
    addEdge(edgeSet, a, b, nodeCount);
    addEdge(edgeSet, b, c, nodeCount);
    addEdge(edgeSet, a, c, nodeCount);
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

function addEdge(set: Set<number>, a: number, b: number, n: number): void {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  set.add(lo * n + hi);
}

function buildTriangleResult(positions: Float32Array, indices: number[]): EdgeResult {
  const pairs: number[] = [];
  const dists: number[] = [];
  for (let i = 0; i < indices.length; i++) {
    for (let j = i + 1; j < indices.length; j++) {
      const a = indices[i];
      const b = indices[j];
      const dx = positions[a * 3] - positions[b * 3];
      const dy = positions[a * 3 + 1] - positions[b * 3 + 1];
      const dz = positions[a * 3 + 2] - positions[b * 3 + 2];
      pairs.push(a, b);
      dists.push(Math.sqrt(dx * dx + dy * dy + dz * dz));
    }
  }
  return {
    pairs: new Uint32Array(pairs),
    distances: new Float32Array(dists),
    count: dists.length,
  };
}

// ── インクリメンタル 3D 凸包 ──

/**
 * インクリメンタル 3D 凸包。面のインデックスリスト (i0,i1,i2, ...) を返す。
 * 各面の法線は外向き（原点を内部と仮定）。
 */
function convexHull(positions: Float32Array, n: number): number[] {
  // 初期四面体を構築
  const init = findInitialTetrahedron(positions, n);
  if (!init) {
    // 全点が同一平面上（球面上ではほぼ起こらないが安全策）
    return [];
  }

  const [i0, i1, i2, i3] = init;

  // 面リスト: 各面は [a, b, c] (反時計回り = 外向き法線)
  // 四面体の 4 面を一貫した巻き方向で構築
  let faces: number[][] = [
    [i0, i1, i2],
    [i0, i2, i3],
    [i0, i3, i1],
    [i1, i3, i2],
  ];

  // 原点が全面の負側にあるべき。第一面で確認し、必要なら全面を反転
  if (facePlaneSign(positions, faces[0][0], faces[0][1], faces[0][2], 0, 0, 0) > 0) {
    for (const face of faces) {
      const tmp = face[1];
      face[1] = face[2];
      face[2] = tmp;
    }
  }

  const assigned = new Uint8Array(n);
  assigned[i0] = 1;
  assigned[i1] = 1;
  assigned[i2] = 1;
  assigned[i3] = 1;

  // 残りの点を追加
  for (let p = 0; p < n; p++) {
    if (assigned[p]) continue;
    assigned[p] = 1;

    const px = positions[p * 3];
    const py = positions[p * 3 + 1];
    const pz = positions[p * 3 + 2];

    // 点 p から「見える」面を収集
    const visible: number[] = [];
    for (let fi = 0; fi < faces.length; fi++) {
      const f = faces[fi];
      if (facePlaneSign(positions, f[0], f[1], f[2], px, py, pz) > 1e-10) {
        visible.push(fi);
      }
    }

    if (visible.length === 0) continue; // 内部点（球面上ではほぼ起こらない）

    // 可視面の境界辺（ホライズンエッジ）を抽出
    const horizon = findHorizonEdges(faces, visible);

    // 可視面を除去
    const visibleSet = new Set(visible);
    faces = faces.filter((_, idx) => !visibleSet.has(idx));

    // ホライズンエッジから p への新しい面を生成
    for (const [a, b] of horizon) {
      faces.push([a, b, p]);
    }
  }

  // 面リストをフラット化
  const result: number[] = [];
  for (const f of faces) {
    result.push(f[0], f[1], f[2]);
  }
  return result;
}

/** 面 (a,b,c) の法線方向に対して点 (px,py,pz) がどちら側にあるかを返す (正=表側) */
function facePlaneSign(
  pos: Float32Array,
  a: number,
  b: number,
  c: number,
  px: number,
  py: number,
  pz: number,
): number {
  const a3 = a * 3;
  const b3 = b * 3;
  const c3 = c * 3;
  // AB × AC
  const abx = pos[b3] - pos[a3];
  const aby = pos[b3 + 1] - pos[a3 + 1];
  const abz = pos[b3 + 2] - pos[a3 + 2];
  const acx = pos[c3] - pos[a3];
  const acy = pos[c3 + 1] - pos[a3 + 1];
  const acz = pos[c3 + 2] - pos[a3 + 2];
  const nx = aby * acz - abz * acy;
  const ny = abz * acx - abx * acz;
  const nz = abx * acy - aby * acx;
  // AP · N
  return (px - pos[a3]) * nx + (py - pos[a3 + 1]) * ny + (pz - pos[a3 + 2]) * nz;
}

/** 可視面群の境界辺を抽出する */
function findHorizonEdges(faces: number[][], visibleIndices: number[]): [number, number][] {
  // 辺の出現回数をカウント。可視面だけに1回出る辺がホライズン
  const edgeCount = new Map<string, { a: number; b: number; count: number }>();

  for (const fi of visibleIndices) {
    const f = faces[fi];
    const edges: [number, number][] = [
      [f[0], f[1]],
      [f[1], f[2]],
      [f[2], f[0]],
    ];
    for (const [a, b] of edges) {
      const key = `${Math.min(a, b)},${Math.max(a, b)}`;
      const entry = edgeCount.get(key);
      if (entry) {
        entry.count++;
      } else {
        // 可視面側の辺方向を保持（隣接非可視面とは逆向き = 正しい巻き方向）
        edgeCount.set(key, { a, b, count: 1 });
      }
    }
  }

  const horizon: [number, number][] = [];
  for (const { a, b, count } of edgeCount.values()) {
    if (count === 1) {
      horizon.push([a, b]);
    }
  }
  return horizon;
}

/** 初期四面体となる 4 頂点を探す (非退化) */
function findInitialTetrahedron(
  pos: Float32Array,
  n: number,
): [number, number, number, number] | null {
  if (n < 4) return null;

  // 最も離れた 2 点を探す
  let best = -1;
  let bi = 0;
  let bj = 1;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dx = pos[i * 3] - pos[j * 3];
      const dy = pos[i * 3 + 1] - pos[j * 3 + 1];
      const dz = pos[i * 3 + 2] - pos[j * 3 + 2];
      const d = dx * dx + dy * dy + dz * dz;
      if (d > best) {
        best = d;
        bi = i;
        bj = j;
      }
    }
  }

  // 直線 bi-bj から最も遠い点 bk
  let maxArea = -1;
  let bk = -1;
  for (let k = 0; k < n; k++) {
    if (k === bi || k === bj) continue;
    const area = triangleAreaSq(pos, bi, bj, k);
    if (area > maxArea) {
      maxArea = area;
      bk = k;
    }
  }
  if (bk < 0) return null;

  // 平面 bi-bj-bk から最も遠い点 bl
  let maxDist = -1;
  let bl = -1;
  for (let l = 0; l < n; l++) {
    if (l === bi || l === bj || l === bk) continue;
    const d = Math.abs(facePlaneSign(pos, bi, bj, bk, pos[l * 3], pos[l * 3 + 1], pos[l * 3 + 2]));
    if (d > maxDist) {
      maxDist = d;
      bl = l;
    }
  }
  if (bl < 0) return null;

  return [bi, bj, bk, bl];
}

function triangleAreaSq(pos: Float32Array, a: number, b: number, c: number): number {
  const a3 = a * 3;
  const b3 = b * 3;
  const c3 = c * 3;
  const abx = pos[b3] - pos[a3];
  const aby = pos[b3 + 1] - pos[a3 + 1];
  const abz = pos[b3 + 2] - pos[a3 + 2];
  const acx = pos[c3] - pos[a3];
  const acy = pos[c3 + 1] - pos[a3 + 1];
  const acz = pos[c3 + 2] - pos[a3 + 2];
  const cx = aby * acz - abz * acy;
  const cy = abz * acx - abx * acz;
  const cz = abx * acy - aby * acx;
  return cx * cx + cy * cy + cz * cz;
}
