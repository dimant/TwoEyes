import { describe, it, expect } from "vitest";
import { Board } from "../../engine/board";
import { libertyCount } from "../../engine/liberties";
import { makeRng } from "../../engine/rng";
import { generateLiberties } from "./liberties";

describe("generateLiberties", () => {
  it("answer always equals the real liberty count of the marked stone", () => {
    for (const rung of [1, 2]) {
      const puzzles = generateLiberties(makeRng(1), { rung, size: 5, count: 20 });
      expect(puzzles).toHaveLength(20);
      for (const p of puzzles) {
        expect(p.mode).toBe("Q-count");
        expect(p.marks).toHaveLength(1);
        const mark = p.marks![0]!;
        const b = Board.from(p.size, p.stones);
        expect(p.solution).toEqual({ kind: "value", value: libertyCount(b, mark.x, mark.y) });
      }
    }
  });

  it("produces 20 fully-distinct puzzles per rung (dedup)", () => {
    for (const rung of [1, 2]) {
      const puzzles = generateLiberties(makeRng(7), { rung, size: 5, count: 20 });
      const sigs = new Set(puzzles.map((p) => JSON.stringify({ s: p.stones, sol: p.solution })));
      expect(sigs.size).toBe(20);
    }
  });

  it("rung 2 can produce an atari (answer 1); rung 1 never does", () => {
    const r2 = generateLiberties(makeRng(3), { rung: 2, size: 5, count: 20 });
    const r2answers = new Set(r2.map((p) => (p.solution.kind === "value" ? p.solution.value : -1)));
    expect(r2answers.has(1)).toBe(true);

    const r1 = generateLiberties(makeRng(3), { rung: 1, size: 5, count: 20 });
    for (const p of r1) {
      if (p.solution.kind === "value") expect(p.solution.value).toBeGreaterThanOrEqual(2);
    }
  });

  it("is deterministic", () => {
    const a = generateLiberties(makeRng(5), { rung: 2, size: 5, count: 12 });
    const b = generateLiberties(makeRng(5), { rung: 2, size: 5, count: 12 });
    expect(a).toEqual(b);
  });
});
