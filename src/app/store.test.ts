import { describe, it, expect } from "vitest";
import { loadBank, safeStorage } from "./store";

describe("safeStorage", () => {
  it("falls back to a working in-memory store when localStorage is unavailable", () => {
    // In the node test env there is no window.localStorage -> must not throw.
    const s = safeStorage();
    s.setItem("k", "v");
    expect(s.getItem("k")).toBe("v");
    expect(s.getItem("missing")).toBeNull();
  });
});

describe("loadBank", () => {
  it("accepts a well-formed bank", () => {
    const b = loadBank({ seed: 1, stage: "A", puzzles: [{ id: "x", topic: 1, rung: 1, mode: "M", size: 5, stones: [], toPlay: "b", prompt: "", solution: { kind: "move", points: [] } }] });
    expect(b.puzzles).toHaveLength(1);
  });

  it("rejects malformed data", () => {
    expect(() => loadBank(null)).toThrow();
    expect(() => loadBank({ seed: 1, stage: "A" })).toThrow();
    expect(() => loadBank({ puzzles: "nope" })).toThrow();
  });
});
