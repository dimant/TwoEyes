import { describe, it, expect } from "vitest";
import { Board } from "../../engine/board";
import { libertyCount } from "../../engine/liberties";
import { makeRng } from "../../engine/rng";
import { generateLiberties } from "./liberties";

describe("generateLiberties", () => {
  it("produces Q-count puzzles whose answer equals the real liberty count", () => {
    const puzzles = generateLiberties(makeRng(1), { rung: 1, size: 5, count: 12 });
    expect(puzzles).toHaveLength(12);
    for (const p of puzzles) {
      expect(p.mode).toBe("Q-count");
      expect(p.marks).toHaveLength(1);
      const mark = p.marks![0]!;
      const b = Board.from(p.size, p.stones);
      expect(p.solution).toEqual({ kind: "value", value: libertyCount(b, mark.x, mark.y) });
    }
  });

  it("is deterministic", () => {
    const a = generateLiberties(makeRng(5), { rung: 1, size: 5, count: 6 });
    const b = generateLiberties(makeRng(5), { rung: 1, size: 5, count: 6 });
    expect(a).toEqual(b);
  });
});
