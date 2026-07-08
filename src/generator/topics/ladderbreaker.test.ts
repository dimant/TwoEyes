import { describe, it, expect } from "vitest";
import { generateLadderBreaker, findBreaker } from "./ladderbreaker";
import { makeRng } from "../../engine/rng";
import { Board } from "../../engine/board";
import { play } from "../../engine/rules";
import { capturedUnderBestPlay } from "../reader";

describe("generateLadderBreaker", () => {
  it("produces a balanced set of engine-correct caught/escapes verdicts (9x9)", () => {
    const puzzles = generateLadderBreaker(makeRng(1), { rung: 1, size: 9, count: 10 });
    expect(puzzles).toHaveLength(10);
    const caught = puzzles.filter((p) => p.solution.kind === "choice" && p.solution.id === "caught");
    const escapes = puzzles.filter((p) => p.solution.kind === "choice" && p.solution.id === "escapes");
    expect(caught).toHaveLength(5);
    expect(escapes).toHaveLength(5);
    for (const p of puzzles) {
      expect(p.topic).toBe(9);
      expect(p.mode).toBe("Q-binary");
      const t = p.marks![0]!;
      const board = Board.from(p.size, p.stones);
      const verdict = capturedUnderBestPlay(board, t, "b", 12);
      if (p.solution.kind !== "choice") throw new Error("expected choice");
      if (p.solution.id === "caught") {
        expect(verdict).toBe(true);
        expect(p.breaker).toBeUndefined();
        // payoff replays to the target's capture
        expect(p.payoff!.filter((m) => m.c === "b").length).toBeGreaterThanOrEqual(2);
        let b2 = Board.from(p.size, p.stones);
        for (const m of p.payoff!) { const r = play(b2, m.x, m.y, m.c); expect(r.ok).toBe(true); b2 = r.board; }
        expect(b2.get(t.x, t.y)).toBeNull();
      } else {
        expect(verdict).toBe(false);
        expect(p.payoff).toBeUndefined();
        // the stored breaker is real: removing it makes the ladder work
        expect(board.get(p.breaker!.x, p.breaker!.y)).toBe("w");
        const without = Board.from(p.size, p.stones.filter((s) => !(s.x === p.breaker!.x && s.y === p.breaker!.y)));
        expect(capturedUnderBestPlay(without, t, "b", 12)).toBe(true);
      }
    }
  });

  it("findBreaker returns the culprit stone, or null when none", () => {
    // A working ladder with no breaker -> null.
    const working = Board.from(9, [
      { x: 2, y: 1, c: "b" }, { x: 2, y: 2, c: "w" }, { x: 3, y: 2, c: "b" }, { x: 3, y: 3, c: "b" },
    ]);
    expect(findBreaker(working, { x: 2, y: 2 })).toBeNull();
  });

  it("is deterministic for a given seed", () => {
    const a = generateLadderBreaker(makeRng(9), { rung: 2, size: 9, count: 6 });
    const b = generateLadderBreaker(makeRng(9), { rung: 2, size: 9, count: 6 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
