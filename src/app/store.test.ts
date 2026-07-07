import { describe, it, expect } from "vitest";
import { loadBank } from "./store";

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
