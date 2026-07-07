import { describe, it, expect } from "vitest";
import { Board } from "../../engine/board";
import { group } from "../../engine/liberties";
import { play } from "../../engine/rules";
import { makeRng } from "../../engine/rng";
import { generateConnect, generateCaptureCutter } from "./connectcut";

describe("connect & cut", () => {
  it("connect: the move merges two black groups into one, 20 distinct", () => {
    const ps = generateConnect(makeRng(1), { size: 5, count: 20 });
    expect(ps).toHaveLength(20);
    const sigs = new Set(ps.map((p) => JSON.stringify({ s: p.stones, sol: p.solution })));
    expect(sigs.size).toBe(20);
    for (const p of ps) {
      expect(p.mode).toBe("M");
      if (p.solution.kind !== "move") throw new Error("move");
      const pt = p.solution.points[0]!;
      const before = Board.from(p.size, p.stones);
      // two distinct black groups before
      const blackGroups = new Set(
        p.stones.filter((s) => s.c === "b").map((s) => group(before, s.x, s.y).stones.map((q) => `${q.x},${q.y}`).sort().join(";")),
      );
      expect(blackGroups.size).toBeGreaterThanOrEqual(2);
      const r = play(before, pt.x, pt.y, "b");
      expect(r.ok).toBe(true);
      // one black group after
      const after = new Set(
        r.board.stones().filter((s) => s.c === "b").map((s) => group(r.board, s.x, s.y).stones.map((q) => `${q.x},${q.y}`).sort().join(";")),
      );
      expect(after.size).toBe(1);
    }
  });

  it("capture-cutter: the move captures the white cutting stone", () => {
    const ps = generateCaptureCutter(makeRng(2), { size: 5, count: 10 });
    for (const p of ps) {
      if (p.solution.kind !== "move") throw new Error("move");
      const pt = p.solution.points[0]!;
      const r = play(Board.from(p.size, p.stones), pt.x, pt.y, "b");
      expect(r.captured.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("is deterministic", () => {
    expect(generateConnect(makeRng(3), { size: 5, count: 6 })).toEqual(generateConnect(makeRng(3), { size: 5, count: 6 }));
  });
});
