import { describe, it, expect } from "vitest";
import { createNodeState, updateNodePositions } from "../../../src/models/node-garden/simulation";
import {
  computeDistanceEdges,
  computeKnnEdges,
  computeMstEdges,
  computeGabrielEdges,
  computeDelaunayEdges,
  edgeStrategies,
  geodesicArc,
} from "../../../src/models/node-garden/edges";
import type { NodeGardenParams } from "../../../src/models/node-garden/params";
import { defaultParams } from "../../../src/models/node-garden/params";

function makeParams(overrides: Partial<NodeGardenParams> = {}): NodeGardenParams {
  return { ...defaultParams, ...overrides };
}

describe("createNodeState", () => {
  it("配列サイズが正しい", () => {
    const state = createNodeState(makeParams({ nodeCount: 50 }));
    expect(state.nodeCount).toBe(50);
    expect(state.positions.length).toBe(150);
    expect(state.radii.length).toBe(50);
    expect(state.axes.length).toBe(150);
    expect(state.angles.length).toBe(50);
    expect(state.angularSpeeds.length).toBe(50);
    expect(state.initialPositions.length).toBe(150);
  });

  it("ε=0 で全ノードが球面上", () => {
    const r = 2.0;
    const state = createNodeState(
      makeParams({ nodeCount: 100, sphereRadius: r, surfaceEpsilon: 0 }),
    );
    for (let i = 0; i < 100; i++) {
      const i3 = i * 3;
      const dist = Math.sqrt(
        state.positions[i3] ** 2 + state.positions[i3 + 1] ** 2 + state.positions[i3 + 2] ** 2,
      );
      expect(dist).toBeCloseTo(r, 5);
    }
  });

  it("ε>0 で球面近傍に配置される", () => {
    const r = 1.0;
    const eps = 0.05;
    const state = createNodeState(
      makeParams({ nodeCount: 100, sphereRadius: r, surfaceEpsilon: eps }),
    );
    for (let i = 0; i < 100; i++) {
      const i3 = i * 3;
      const dist = Math.sqrt(
        state.positions[i3] ** 2 + state.positions[i3 + 1] ** 2 + state.positions[i3 + 2] ** 2,
      );
      expect(dist).toBeGreaterThanOrEqual(r * (1 - eps) - 1e-6);
      expect(dist).toBeLessThanOrEqual(r * (1 + eps) + 1e-6);
    }
  });

  it("回転軸が単位ベクトル", () => {
    const state = createNodeState(makeParams({ nodeCount: 50 }));
    for (let i = 0; i < 50; i++) {
      const i3 = i * 3;
      const len = Math.sqrt(
        state.axes[i3] ** 2 + state.axes[i3 + 1] ** 2 + state.axes[i3 + 2] ** 2,
      );
      expect(len).toBeCloseTo(1.0, 5);
    }
  });

  it("角速度が範囲内", () => {
    const min = 0.1;
    const max = 0.5;
    const state = createNodeState(
      makeParams({ nodeCount: 50, angularSpeedMin: min, angularSpeedMax: max }),
    );
    for (let i = 0; i < 50; i++) {
      expect(state.angularSpeeds[i]).toBeGreaterThanOrEqual(min - 1e-9);
      expect(state.angularSpeeds[i]).toBeLessThanOrEqual(max + 1e-9);
    }
  });
});

describe("updateNodePositions", () => {
  it("回転後も球面上を維持する", () => {
    const params = makeParams({ nodeCount: 50, surfaceEpsilon: 0 });
    const state = createNodeState(params);

    for (let step = 0; step < 100; step++) {
      updateNodePositions(state, params, 0.016);
    }

    for (let i = 0; i < 50; i++) {
      const i3 = i * 3;
      const dist = Math.sqrt(
        state.positions[i3] ** 2 + state.positions[i3 + 1] ** 2 + state.positions[i3 + 2] ** 2,
      );
      expect(dist).toBeCloseTo(state.radii[i], 5);
    }
  });

  it("speedMultiplier=0 で静止", () => {
    const params = makeParams({ nodeCount: 10, speedMultiplier: 0 });
    const state = createNodeState(params);
    const before = new Float32Array(state.positions);

    for (let step = 0; step < 10; step++) {
      updateNodePositions(state, params, 0.016);
    }

    for (let i = 0; i < state.positions.length; i++) {
      expect(state.positions[i]).toBe(before[i]);
    }
  });

  it("forceGreatCircle 時に回転軸との内積が 0", () => {
    const params = makeParams({ nodeCount: 50, forceGreatCircle: true, surfaceEpsilon: 0 });
    const state = createNodeState(params);

    for (let step = 0; step < 50; step++) {
      updateNodePositions(state, params, 0.016);
    }

    for (let i = 0; i < 50; i++) {
      const i3 = i * 3;
      const dot =
        state.positions[i3] * state.axes[i3] +
        state.positions[i3 + 1] * state.axes[i3 + 1] +
        state.positions[i3 + 2] * state.axes[i3 + 2];
      expect(Math.abs(dot)).toBeLessThan(1e-5);
    }
  });
});

describe("computeDistanceEdges", () => {
  it("近接ノード検出", () => {
    const params = makeParams({
      nodeCount: 2,
      surfaceEpsilon: 0,
      sphereRadius: 1,
      edgeMaxDistance: 1.0,
    });
    const state = createNodeState(params);

    // 手動配置: 2 点を距離 0.5 に
    state.positions[0] = 1;
    state.positions[1] = 0;
    state.positions[2] = 0;
    state.positions[3] = 0.5;
    state.positions[4] = 0;
    state.positions[5] = 0;

    const result = computeDistanceEdges(state, params);
    expect(result.count).toBe(1);
    expect(result.pairs[0]).toBe(0);
    expect(result.pairs[1]).toBe(1);
    expect(result.distances[0]).toBeCloseTo(0.5);
  });

  it("遠方ノード非検出", () => {
    const params = makeParams({
      nodeCount: 2,
      surfaceEpsilon: 0,
      sphereRadius: 1,
      edgeMaxDistance: 0.5,
    });
    const state = createNodeState(params);

    state.positions[0] = 1;
    state.positions[1] = 0;
    state.positions[2] = 0;
    state.positions[3] = -1;
    state.positions[4] = 0;
    state.positions[5] = 0;

    const result = computeDistanceEdges(state, params);
    expect(result.count).toBe(0);
  });
});

// ── ヘルパー: 固定位置の NodeState を生成 ──

function createFixedState(
  positions: number[],
): import("../../../src/models/node-garden/simulation").NodeState {
  const n = positions.length / 3;
  const pos = new Float32Array(positions);
  return {
    positions: pos,
    radii: new Float32Array(n).fill(1),
    axes: new Float32Array(n * 3),
    angles: new Float32Array(n),
    angularSpeeds: new Float32Array(n),
    initialPositions: new Float32Array(pos),
    nodeCount: n,
  };
}

// ── k-NN ──

describe("computeKnnEdges", () => {
  it("k=1 で最近傍のみ接続", () => {
    // 3 ノード: A(1,0,0) B(0.9,0,0) C(-1,0,0)
    const state = createFixedState([1, 0, 0, 0.9, 0, 0, -1, 0, 0]);
    const params = makeParams({ nodeCount: 3, knnK: 1 });
    const result = computeKnnEdges(state, params);
    // A-B は相互に最近傍、C の最近傍は B
    expect(result.count).toBe(2); // A-B, B-C or C-B
  });

  it("k=N-1 で完全グラフ", () => {
    const state = createFixedState([1, 0, 0, 0, 1, 0, 0, 0, 1, -1, 0, 0, 0, -1, 0]);
    const params = makeParams({ nodeCount: 5, knnK: 4 });
    const result = computeKnnEdges(state, params);
    expect(result.count).toBe(10); // C(5,2) = 10
  });

  it("対称化: 和集合でエッジ生成", () => {
    // A(1,0,0) B(0.5,0,0) C(0,1,0)
    // A の k=1 最近傍は B, B の k=1 最近傍は A, C の k=1 最近傍は B
    // → A-B, B-C の 2 エッジ
    const state = createFixedState([1, 0, 0, 0.5, 0, 0, 0, 1, 0]);
    const params = makeParams({ nodeCount: 3, knnK: 1 });
    const result = computeKnnEdges(state, params);
    expect(result.count).toBe(2);
  });
});

// ── MST ──

describe("computeMstEdges", () => {
  it("エッジ数 = N - 1", () => {
    const params = makeParams({ nodeCount: 20, surfaceEpsilon: 0 });
    const state = createNodeState(params);
    const result = computeMstEdges(state, params);
    expect(result.count).toBe(19);
  });

  it("全ノード連結", () => {
    const params = makeParams({ nodeCount: 20, surfaceEpsilon: 0 });
    const state = createNodeState(params);
    const result = computeMstEdges(state, params);
    // Union-Find で全ノード同一成分を検証
    const parent = new Int32Array(20);
    for (let i = 0; i < 20; i++) parent[i] = i;
    function find(x: number): number {
      while (parent[x] !== x) {
        parent[x] = parent[parent[x]];
        x = parent[x];
      }
      return x;
    }
    for (let e = 0; e < result.count; e++) {
      const a = find(result.pairs[e * 2]);
      const b = find(result.pairs[e * 2 + 1]);
      if (a !== b) parent[a] = b;
    }
    const root = find(0);
    for (let i = 1; i < 20; i++) {
      expect(find(i)).toBe(root);
    }
  });

  it("距離既知の 3 点で最短 2 辺を選択", () => {
    // A(1,0,0) B(0,1,0) C(0,0,1)
    // 全辺長√2 → どの 2 辺でも MST
    const state = createFixedState([1, 0, 0, 0, 1, 0, 0, 0, 1]);
    const params = makeParams({ nodeCount: 3 });
    const result = computeMstEdges(state, params);
    expect(result.count).toBe(2);
  });
});

// ── Gabriel ──

describe("computeGabrielEdges", () => {
  it("2 点のみ → 1 エッジ", () => {
    const state = createFixedState([1, 0, 0, -1, 0, 0]);
    const params = makeParams({ nodeCount: 2 });
    const result = computeGabrielEdges(state, params);
    expect(result.count).toBe(1);
  });

  it("直径球内に他点あり → 非接続", () => {
    // A(0,0,0) B(2,0,0) C(1,0,0) — C は A-B の中点 = 直径球の中心内
    const state = createFixedState([0, 0, 0, 2, 0, 0, 1, 0, 0]);
    const params = makeParams({ nodeCount: 3 });
    const result = computeGabrielEdges(state, params);
    // A-B は C が直径球内なので非接続
    // A-C, B-C は Gabriel エッジ
    const edgePairs = [];
    for (let e = 0; e < result.count; e++) {
      edgePairs.push([result.pairs[e * 2], result.pairs[e * 2 + 1]]);
    }
    expect(edgePairs).not.toContainEqual([0, 1]);
    expect(result.count).toBe(2);
  });

  it("MST を包含する", () => {
    const params = makeParams({ nodeCount: 20, surfaceEpsilon: 0 });
    const state = createNodeState(params);
    const gabriel = computeGabrielEdges(state, params);
    const mst = computeMstEdges(state, params);

    // MST ⊆ Gabriel は常に成立
    const gabrielSet = new Set<string>();
    for (let e = 0; e < gabriel.count; e++) {
      const a = gabriel.pairs[e * 2];
      const b = gabriel.pairs[e * 2 + 1];
      gabrielSet.add(`${Math.min(a, b)},${Math.max(a, b)}`);
    }

    for (let e = 0; e < mst.count; e++) {
      const a = mst.pairs[e * 2];
      const b = mst.pairs[e * 2 + 1];
      const key = `${Math.min(a, b)},${Math.max(a, b)}`;
      expect(gabrielSet.has(key)).toBe(true);
    }
  });
});

// ── Delaunay ──

describe("computeDelaunayEdges", () => {
  it("正四面体頂点 → 6 エッジ", () => {
    // 正四面体を球面上に配置
    const state = createFixedState([
      1,
      1,
      1, // 正規化前
      1,
      -1,
      -1,
      -1,
      1,
      -1,
      -1,
      -1,
      1,
    ]);
    // 球面上に正規化
    for (let i = 0; i < 4; i++) {
      const i3 = i * 3;
      const len = Math.sqrt(
        state.positions[i3] ** 2 + state.positions[i3 + 1] ** 2 + state.positions[i3 + 2] ** 2,
      );
      state.positions[i3] /= len;
      state.positions[i3 + 1] /= len;
      state.positions[i3 + 2] /= len;
    }
    const params = makeParams({ nodeCount: 4 });
    const result = computeDelaunayEdges(state, params);
    expect(result.count).toBe(6); // 完全グラフ
  });

  it("8 点でエッジ数が妥当", () => {
    // 立方体頂点を球面射影
    const verts: number[] = [];
    for (let x = -1; x <= 1; x += 2) {
      for (let y = -1; y <= 1; y += 2) {
        for (let z = -1; z <= 1; z += 2) {
          const len = Math.sqrt(x * x + y * y + z * z);
          verts.push(x / len, y / len, z / len);
        }
      }
    }
    const state = createFixedState(verts);
    const params = makeParams({ nodeCount: 8 });
    const result = computeDelaunayEdges(state, params);
    // 球面ドロネーのエッジ数は少なくとも N-1 以上
    expect(result.count).toBeGreaterThanOrEqual(7);
    // 最大は完全グラフ C(8,2)=28 だがドロネーはそれより少ない
    expect(result.count).toBeLessThanOrEqual(28);
  });
});

// ── edgeStrategies ──

describe("edgeStrategies", () => {
  it("全アルゴリズムが EdgeStrategy 型に適合", () => {
    const algorithms = ["distance", "knn", "delaunay", "mst", "gabriel"] as const;
    const params = makeParams({ nodeCount: 10, surfaceEpsilon: 0 });
    const state = createNodeState(params);

    for (const alg of algorithms) {
      const strategy = edgeStrategies[alg];
      expect(typeof strategy).toBe("function");
      const result = strategy(state, params);
      expect(result).toHaveProperty("pairs");
      expect(result).toHaveProperty("distances");
      expect(result).toHaveProperty("count");
      expect(result.pairs).toBeInstanceOf(Uint32Array);
      expect(result.distances).toBeInstanceOf(Float32Array);
    }
  });
});

// ── geodesicArc ──

describe("geodesicArc", () => {
  it("同一点 → 1 点のみ", () => {
    const arc = geodesicArc([1, 0, 0], [1, 0, 0], 1, 8);
    expect(arc.length).toBe(3); // 1 点
  });

  it("対蹠点 → segments+1 分割の半円弧", () => {
    const arc = geodesicArc([1, 0, 0], [-1, 0, 0], 1, 8);
    // 対蹠点では sinOmega ≈ 0 になりうるが、omega = π で sin(π) ≈ 0
    // この場合、分割点数は segments+1
    const pointCount = arc.length / 3;
    expect(pointCount).toBe(9); // 8 segments → 9 points
    // 各点が半径 1 の球面上
    for (let i = 0; i < pointCount; i++) {
      const len = Math.sqrt(arc[i * 3] ** 2 + arc[i * 3 + 1] ** 2 + arc[i * 3 + 2] ** 2);
      expect(len).toBeCloseTo(1.0, 3);
    }
  });

  it("90度離れた 2 点の弧が球面上", () => {
    const arc = geodesicArc([1, 0, 0], [0, 1, 0], 2, 12);
    const pointCount = arc.length / 3;
    expect(pointCount).toBe(13);
    for (let i = 0; i < pointCount; i++) {
      const len = Math.sqrt(arc[i * 3] ** 2 + arc[i * 3 + 1] ** 2 + arc[i * 3 + 2] ** 2);
      expect(len).toBeCloseTo(2.0, 5);
    }
  });
});
