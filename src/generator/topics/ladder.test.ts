import { describe, it, expect } from "vitest";
import { generateLadder } from "./ladder";
import { makeRng } from "../../engine/rng";
import { Board } from "../../engine/board";
import { play } from "../../engine/rules";
import { group } from "../../engine/liberties";
import { capturedUnderBestPlay } from "../reader";

describe("generateLadder", () => {
  it("rung 1 (7x7): each puzzle has a unique opening atari and a payoff that captures the target", () => {
    const puzzles = generateLadder(makeRng(1), { rung: 1, size: 7, count: 8, requireFailingAlt: false });
    expect(puzzles).toHaveLength(8);
    for (const p of puzzles) {
      expect(p.topic).toBe(8);
      expect(p.mode).toBe("M");
      if (p.solution.kind !== "move") throw new Error("expected move solution");
      expect(p.solution.points).toHaveLength(1);
      const t = p.marks![0]!;
      // move 0 of the payoff is the opening atari (the solution)
      expect(p.payoff && p.payoff.length).toBeGreaterThan(0);
      expect(p.payoff![0]!.x).toBe(p.solution.points[0]!.x);
      expect(p.payoff![0]!.y).toBe(p.solution.points[0]!.y);
      // >= 2 black moves (a real multi-step ladder)
      expect(p.payoff!.filter((m) => m.c === "b").length).toBeGreaterThanOrEqual(2);
      // payoff replays to the target's capture
      let board = Board.from(p.size, p.stones);
      for (const m of p.payoff!) { const r = play(board, m.x, m.y, m.c); expect(r.ok).toBe(true); board = r.board; }
      expect(board.get(t.x, t.y)).toBeNull();
      // exactly one of the target's liberties is a winning opening atari
      const libs = group(Board.from(p.size, p.stones), t.x, t.y).liberties;
      const winners = libs.filter((m) => {
        const r = play(Board.from(p.size, p.stones), m.x, m.y, "b");
        if (!r.ok) return false;
        if (r.board.get(t.x, t.y) === null) return true;
        if (group(r.board, t.x, t.y).liberties.length !== 1) return false;
        return capturedUnderBestPlay(r.board, t, "w", 8);
      });
      expect(winners).toHaveLength(1);
    }
  });

  it("rung 2 (9x9): the OTHER atari is a legal atari that escapes (a tempting wrong turn)", () => {
    const puzzles = generateLadder(makeRng(2), { rung: 2, size: 9, count: 6, requireFailingAlt: true });
    expect(puzzles).toHaveLength(6);
    for (const p of puzzles) {
      if (p.solution.kind !== "move") throw new Error("expected move solution");
      const t = p.marks![0]!;
      const sol = p.solution.points[0]!;
      const before = Board.from(p.size, p.stones);
      const other = group(before, t.x, t.y).liberties.find((l) => !(l.x === sol.x && l.y === sol.y));
      expect(other).toBeDefined();
      const r = play(before, other!.x, other!.y, "b");
      expect(r.ok).toBe(true);
      expect(group(r.board, t.x, t.y).liberties.length).toBe(1); // it IS an atari
      expect(capturedUnderBestPlay(r.board, t, "w", 8)).toBe(false); // but it escapes
    }
  });

  it("is deterministic for a given seed", () => {
    const a = generateLadder(makeRng(7), { rung: 1, size: 7, count: 5, requireFailingAlt: false });
    const b = generateLadder(makeRng(7), { rung: 1, size: 7, count: 5, requireFailingAlt: false });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
