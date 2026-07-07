import { describe, it, expect } from "vitest";
import { Board } from "../../engine/board";
import { play } from "../../engine/rules";
import { group } from "../../engine/liberties";
import { capturedUnderBestPlay } from "../reader";
import { makeRng } from "../../engine/rng";
import { generateNet } from "./net";

describe("generateNet", () => {
  it("every net move captures the target under best play and doesn't capture immediately", () => {
    const ps = generateNet(makeRng(1), { rung: 1, size: 7, count: 12, depth: 6 });
    expect(ps).toHaveLength(12);
    for (const p of ps) {
      expect(p.mode).toBe("M");
      expect(p.marks).toHaveLength(1);
      const target = p.marks![0]!;
      if (p.solution.kind !== "move") throw new Error("move");
      expect(p.solution.points.length).toBeGreaterThanOrEqual(1);
      for (const mv of p.solution.points) {
        const r = play(Board.from(p.size, p.stones), mv.x, mv.y, "b");
        expect(r.ok).toBe(true);
        expect(r.captured).toHaveLength(0); // net doesn't capture on the move
        expect(group(r.board, target.x, target.y).liberties.length).toBe(2); // loose net, not atari
        expect(capturedUnderBestPlay(r.board, target, "w", 8)).toBe(true);
      }
      // clean: no black stone already in atari in the problem
      const b = Board.from(p.size, p.stones);
      for (const s of p.stones) if (s.c === "b") expect(group(b, s.x, s.y).liberties.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("is deterministic", () => {
    const o = { rung: 1, size: 7, count: 6, depth: 6 };
    expect(generateNet(makeRng(5), o)).toEqual(generateNet(makeRng(5), o));
  });

  it("the target is alive before the net move (the net move is causal)", () => {
    const ps = generateNet(makeRng(1), { rung: 1, size: 7, count: 12, depth: 6 });
    for (const p of ps) {
      const t = p.marks![0]!;
      expect(capturedUnderBestPlay(Board.from(p.size, p.stones), t, "w", 8)).toBe(false);
    }
  });
});
