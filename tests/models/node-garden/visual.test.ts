import { describe, it, expect } from "vitest";
import {
  distanceFadeAlpha,
  computeBreathingOpacity,
} from "../../../src/models/node-garden/shaders/edge-styles";
import { computeSphereGridVertexCount } from "../../../src/models/node-garden/sphere-grid";

describe("distanceFadeAlpha", () => {
  it("距離 0 → alpha 1.0", () => {
    expect(distanceFadeAlpha(0, 1)).toBe(1.0);
  });

  it("距離 = maxDistance → alpha 0.0", () => {
    expect(distanceFadeAlpha(1, 1)).toBe(0.0);
  });

  it("距離が maxDistance の半分 → 0 < alpha < 1", () => {
    const alpha = distanceFadeAlpha(0.5, 1);
    expect(alpha).toBeGreaterThan(0);
    expect(alpha).toBeLessThan(1);
    expect(alpha).toBeCloseTo(0.75, 5);
  });

  it("距離が maxDistance を超える場合 → alpha 0.0", () => {
    expect(distanceFadeAlpha(2, 1)).toBe(0.0);
  });

  it("maxDistance が 0 の場合 → alpha 1.0", () => {
    expect(distanceFadeAlpha(0, 0)).toBe(1.0);
  });
});

describe("computeBreathingOpacity", () => {
  it("time=0 → baseOpacity * 0.5", () => {
    const result = computeBreathingOpacity(1.0, 0, 1.0);
    expect(result).toBeCloseTo(0.5, 5);
  });

  it("sin のピーク時 → baseOpacity", () => {
    // sin(t * speed) = 1 → t * speed = π/2
    const t = Math.PI / 2;
    const result = computeBreathingOpacity(0.8, t, 1.0);
    expect(result).toBeCloseTo(0.8, 5);
  });

  it("sin の谷 → 0", () => {
    // sin(t * speed) = -1 → t * speed = 3π/2
    const t = (3 * Math.PI) / 2;
    const result = computeBreathingOpacity(0.6, t, 1.0);
    expect(result).toBeCloseTo(0.0, 5);
  });
});

describe("computeSphereGridVertexCount", () => {
  it("10° lat, 15° lon, 64 segments で妥当な頂点数", () => {
    const count = computeSphereGridVertexCount(10, 15, 64);
    // 緯度線: -80,-70,...,80 → 17本, 経度線: 0,15,...,345 → 24本
    // 各線: 64 segments × 2 頂点 = 128 頂点
    const expected = (17 + 24) * 64 * 2;
    expect(count).toBe(expected);
  });

  it("30° lat, 30° lon, 32 segments", () => {
    const count = computeSphereGridVertexCount(30, 30, 32);
    // 緯度線: -60,-30,0,30,60 → 5本, 経度線: 0,30,...,330 → 12本
    const expected = (5 + 12) * 32 * 2;
    expect(count).toBe(expected);
  });
});
