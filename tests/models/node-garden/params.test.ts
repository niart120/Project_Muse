import { describe, it, expect } from "vitest";
import { defaultParams } from "../../../src/models/node-garden/params";

describe("defaultParams", () => {
  it("nodeCount が正の整数", () => {
    expect(defaultParams.nodeCount).toBeGreaterThan(0);
    expect(Number.isInteger(defaultParams.nodeCount)).toBe(true);
  });

  it("sphereRadius が正の値", () => {
    expect(defaultParams.sphereRadius).toBeGreaterThan(0);
  });

  it("surfaceEpsilon が非負", () => {
    expect(defaultParams.surfaceEpsilon).toBeGreaterThanOrEqual(0);
  });

  it("pointSize が正の値", () => {
    expect(defaultParams.pointSize).toBeGreaterThan(0);
  });

  it("角速度の範囲が妥当", () => {
    expect(defaultParams.angularSpeedMin).toBeGreaterThan(0);
    expect(defaultParams.angularSpeedMax).toBeGreaterThanOrEqual(defaultParams.angularSpeedMin);
  });

  it("edgeMaxDistance が正の値", () => {
    expect(defaultParams.edgeMaxDistance).toBeGreaterThan(0);
  });

  it("edgeOpacity が 0–1 の範囲", () => {
    expect(defaultParams.edgeOpacity).toBeGreaterThanOrEqual(0);
    expect(defaultParams.edgeOpacity).toBeLessThanOrEqual(1);
  });

  it("カラーが有効な hex 文字列", () => {
    expect(defaultParams.nodeColor).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(defaultParams.edgeColor).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(defaultParams.backgroundColor).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it("edgeAlgorithm が有効な値", () => {
    const valid = ["distance", "knn", "mst", "gabriel"];
    expect(valid).toContain(defaultParams.edgeAlgorithm);
  });

  it("knnK が正の整数", () => {
    expect(defaultParams.knnK).toBeGreaterThan(0);
    expect(Number.isInteger(defaultParams.knnK)).toBe(true);
  });

  it("edgePathMode が有効な値", () => {
    expect(["straight", "geodesic"]).toContain(defaultParams.edgePathMode);
  });

  it("geodesicSegments が正の偶数", () => {
    expect(defaultParams.geodesicSegments).toBeGreaterThan(0);
    expect(defaultParams.geodesicSegments % 2).toBe(0);
  });
});
