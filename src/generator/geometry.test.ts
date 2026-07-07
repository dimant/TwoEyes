import { describe, it, expect } from "vitest";
import { makeRng } from "../engine/rng";
import { startCell, growBlob } from "./geometry";

describe("geometry", () => {
  it("interior start never lands on the border", () => {
    const r = makeRng(1);
    for (let i = 0; i < 100; i++) {
      const p = startCell(r, 7, "interior");
      expect(p.x).toBeGreaterThanOrEqual(1);
      expect(p.x).toBeLessThanOrEqual(5);
      expect(p.y).toBeGreaterThanOrEqual(1);
      expect(p.y).toBeLessThanOrEqual(5);
    }
  });

  it("edge start always lands on the border", () => {
    const r = makeRng(2);
    for (let i = 0; i < 100; i++) {
      const p = startCell(r, 7, "edge");
      expect(p.x === 0 || p.x === 6 || p.y === 0 || p.y === 6).toBe(true);
    }
  });

  it("growBlob returns a connected blob of the requested size", () => {
    const blob = growBlob(makeRng(3), 7, 4, "any");
    expect(blob).not.toBeNull();
    expect(blob!).toHaveLength(4);
    // all distinct
    expect(new Set(blob!.map((p) => `${p.x},${p.y}`)).size).toBe(4);
  });

  it("is deterministic", () => {
    expect(growBlob(makeRng(5), 7, 3, "any")).toEqual(growBlob(makeRng(5), 7, 3, "any"));
  });
});
