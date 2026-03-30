import { describe, it, expect } from "vitest";
import { defaultParams } from "../../../src/models/node-garden/params";

describe("defaultParams", () => {
  it("nodeCount が正の整数", () => {
    expect(defaultParams.nodeCount).toBeGreaterThan(0);
    expect(Number.isInteger(defaultParams.nodeCount)).toBe(true);
  });

  it("spread が正の値", () => {
    expect(defaultParams.spread).toBeGreaterThan(0);
  });

  it("カラーが有効な hex 文字列", () => {
    expect(defaultParams.nodeColor).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(defaultParams.edgeColor).toMatch(/^#[0-9a-fA-F]{6}$/);
  });
});
