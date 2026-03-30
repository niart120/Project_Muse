import { describe, it, expect } from "vitest";
import { NodeGardenSimulation } from "../../../src/models/node-garden/simulation";

describe("NodeGardenSimulation", () => {
  it("指定数のノードで初期化される", () => {
    const sim = new NodeGardenSimulation({ nodeCount: 50 });
    expect(sim.nodeCount).toBe(50);
    expect(sim.positions.length).toBe(50 * 3);
    expect(sim.velocities.length).toBe(50 * 3);
  });

  it("ノードが spread 範囲内に配置される", () => {
    const spread = 5;
    const sim = new NodeGardenSimulation({ nodeCount: 200, spread });
    for (let i = 0; i < sim.positions.length; i++) {
      expect(Math.abs(sim.positions[i])).toBeLessThanOrEqual(spread);
    }
  });

  it("update でノードが移動する", () => {
    const sim = new NodeGardenSimulation({ nodeCount: 10, speed: 1 });
    const before = new Float32Array(sim.positions);
    sim.update(1);
    let moved = false;
    for (let i = 0; i < sim.positions.length; i++) {
      if (sim.positions[i] !== before[i]) {
        moved = true;
        break;
      }
    }
    expect(moved).toBe(true);
  });

  it("長時間 update してもノードが境界内に留まる", () => {
    const spread = 5;
    const sim = new NodeGardenSimulation({ nodeCount: 50, spread, speed: 100 });
    for (let step = 0; step < 100; step++) {
      sim.update(0.016);
    }
    for (let i = 0; i < sim.positions.length; i++) {
      expect(Math.abs(sim.positions[i])).toBeLessThanOrEqual(spread + 0.01);
    }
  });

  it("距離内のエッジを正しく検出する", () => {
    const sim = new NodeGardenSimulation({ nodeCount: 3, spread: 100, edgeMaxDistance: 1 });
    sim.positions[0] = 0;
    sim.positions[1] = 0;
    sim.positions[2] = 0;
    sim.positions[3] = 0.5;
    sim.positions[4] = 0;
    sim.positions[5] = 0;
    sim.positions[6] = 50;
    sim.positions[7] = 50;
    sim.positions[8] = 50;

    const result = sim.computeEdges();
    expect(result.count).toBe(1);
    expect(result.pairs[0]).toBe(0);
    expect(result.pairs[1]).toBe(1);
    expect(result.distances[0]).toBeCloseTo(0.5);
  });

  it("全ノードが遠い場合エッジが生成されない", () => {
    const sim = new NodeGardenSimulation({ nodeCount: 2, spread: 100, edgeMaxDistance: 0.1 });
    sim.positions[0] = 0;
    sim.positions[1] = 0;
    sim.positions[2] = 0;
    sim.positions[3] = 50;
    sim.positions[4] = 50;
    sim.positions[5] = 50;

    const result = sim.computeEdges();
    expect(result.count).toBe(0);
  });
});
