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
