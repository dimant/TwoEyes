import { describe, it, expect } from "vitest";
import { Board } from "../../engine/board";
import { makeRng } from "../../engine/rng";
import { generateSelfAtari, isSelfAtari } from "./selfatari";

describe("generateSelfAtari", () => {
  it("labels match the engine and both answers appear, balanced", () => {
    const puzzles = generateSelfAtari(makeRng(1), { rung: 1, size: 7, count: 20, region: "interior" });
    expect(puzzles).toHaveLength(20);
    let selfAtari = 0, safe = 0;
    for (const p of puzzles) {
      expect(p.mode).toBe("Q-binary");
      expect(p.marks).toHaveLength(1);
      expect(p.solution.kind).toBe("choice");
      const cand = p.marks![0]!;
      const board = Board.from(p.size, p.stones);
      expect(board.get(cand.x, cand.y)).toBeNull(); // candidate is an empty point
      const truth = isSelfAtari(board, cand) ? "self-atari" : "safe";
      if (p.solution.kind === "choice") expect(p.solution.id).toBe(truth);
      if (truth === "self-atari") selfAtari++; else safe++;
    }
    expect(selfAtari).toBe(10);
    expect(safe).toBe(10);
  });

  it("is deterministic", () => {
    const opts = { rung: 1, size: 7, count: 12, region: "interior" as const };
    expect(generateSelfAtari(makeRng(7), opts)).toEqual(generateSelfAtari(makeRng(7), opts));
  });
});

// Pin the self-atari DEFINITION with hand-built boards, so the truth used by both
// the generator and the bank suite is independently anchored (not self-referential).
describe("isSelfAtari (definition)", () => {
  it("3 white neighbours + 1 empty -> self-atari (lands on 1 liberty)", () => {
    const b = Board.from(5, [{ x: 1, y: 2, c: "w" }, { x: 3, y: 2, c: "w" }, { x: 2, y: 1, c: "w" }]);
    expect(isSelfAtari(b, { x: 2, y: 2 })).toBe(true);
  });

  it("2 white neighbours -> safe (lands on 2 liberties)", () => {
    const b = Board.from(5, [{ x: 1, y: 2, c: "w" }, { x: 3, y: 2, c: "w" }]);
    expect(isSelfAtari(b, { x: 2, y: 2 })).toBe(false);
  });

  it("a move that captures is not self-atari", () => {
    // white at 2,2 is in atari; Black playing its last liberty (2,3) captures it
    const b = Board.from(5, [
      { x: 2, y: 2, c: "w" }, { x: 1, y: 2, c: "b" }, { x: 3, y: 2, c: "b" }, { x: 2, y: 1, c: "b" },
    ]);
    expect(isSelfAtari(b, { x: 2, y: 3 })).toBe(false);
  });
});
