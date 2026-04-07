import { describe, it, expect } from "vitest";
import {
  createNodeState,
  updateNodePositions,
  computeDistanceEdges,
} from "../../../src/models/node-garden/simulation";
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
    const params = makeParams({ nodeCount: 2, surfaceEpsilon: 0, sphereRadius: 1 });
    const state = createNodeState(params);

    // 手動配置: 2 点を距離 0.5 に
    state.positions[0] = 1;
    state.positions[1] = 0;
    state.positions[2] = 0;
    state.positions[3] = 0.5;
    state.positions[4] = 0;
    state.positions[5] = 0;

    const result = computeDistanceEdges(state, 1.0);
    expect(result.count).toBe(1);
    expect(result.pairs[0]).toBe(0);
    expect(result.pairs[1]).toBe(1);
    expect(result.distances[0]).toBeCloseTo(0.5);
  });

  it("遠方ノード非検出", () => {
    const params = makeParams({ nodeCount: 2, surfaceEpsilon: 0, sphereRadius: 1 });
    const state = createNodeState(params);

    state.positions[0] = 1;
    state.positions[1] = 0;
    state.positions[2] = 0;
    state.positions[3] = -1;
    state.positions[4] = 0;
    state.positions[5] = 0;

    const result = computeDistanceEdges(state, 0.5);
    expect(result.count).toBe(0);
  });
});
