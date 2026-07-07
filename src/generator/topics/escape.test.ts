import { describe, it, expect } from "vitest";
import { Board } from "../../engine/board";
import { play } from "../../engine/rules";
import { group } from "../../engine/liberties";
import { makeRng } from "../../engine/rng";
import { generateEscape } from "./escape";

describe("generateEscape", () => {
  it("target starts in atari; every listed move rescues it to >=2 liberties", () => {
    const puzzles = generateEscape(makeRng(1), { rung: 1, size: 7, count: 20, region: "interior" });
    expect(puzzles).toHaveLength(20);
    for (const p of puzzles) {
      expect(p.mode).toBe("M");
      expect(p.marks).toHaveLength(1);
      const target = p.marks![0]!;
      const before = Board.from(p.size, p.stones);
      expect(group(before, target.x, target.y).liberties.length).toBe(1); // in atari
      expect(p.solution.kind).toBe("move");
      if (p.solution.kind === "move") {
        expect(p.solution.points.length).toBeGreaterThanOrEqual(1);
        for (const mv of p.solution.points) {
          const r = play(Board.from(p.size, p.stones), mv.x, mv.y, "b");
          expect(r.ok).toBe(true);
          expect(group(r.board, target.x, target.y).liberties.length).toBeGreaterThanOrEqual(2);
        }
      }
    }
  });

  it("no helper black stone is in atari, and it is deterministic", () => {
    const a = generateEscape(makeRng(4), { rung: 2, size: 7, count: 10, region: "edge" });
    for (const p of a) {
      const b = Board.from(p.size, p.stones);
      const target = p.marks![0]!;
      for (const s of p.stones)
        if (s.c === "b" && !(s.x === target.x && s.y === target.y))
          expect(group(b, s.x, s.y).liberties.length).toBeGreaterThanOrEqual(2);
    }
    expect(a).toEqual(generateEscape(makeRng(4), { rung: 2, size: 7, count: 10, region: "edge" }));
  });
});
