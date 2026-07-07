import { describe, it, expect } from "vitest";
import { Board } from "../../engine/board";
import { play } from "../../engine/rules";
import { group } from "../../engine/liberties";
import { makeRng } from "../../engine/rng";
import { generateDoubleAtari } from "./doubleatari";

describe("generateDoubleAtari", () => {
  it("the move puts two distinct white stones into atari and captures nothing", () => {
    const puzzles = generateDoubleAtari(makeRng(1), { rung: 1, size: 7, count: 20 });
    expect(puzzles).toHaveLength(20);
    for (const p of puzzles) {
      expect(p.mode).toBe("M");
      expect(p.solution.kind).toBe("move");
      if (p.solution.kind !== "move") continue;
      expect(p.solution.points).toHaveLength(1);
      const mv = p.solution.points[0]!;
      const r = play(Board.from(p.size, p.stones), mv.x, mv.y, "b");
      expect(r.ok).toBe(true);
      expect(r.captured).toHaveLength(0); // atari, not capture
      // count distinct white neighbour groups now in atari
      const seen = new Set<string>();
      let atariCount = 0;
      for (const n of r.board.neighbors(mv.x, mv.y)) {
        if (r.board.get(n.x, n.y) !== "w") continue;
        const g = group(r.board, n.x, n.y);
        const key = g.stones.map((s) => `${s.x},${s.y}`).sort().join(";");
        if (seen.has(key)) continue;
        seen.add(key);
        if (g.liberties.length === 1) atariCount++;
      }
      expect(atariCount).toBeGreaterThanOrEqual(2);
    }
  });

  it("no helper black stone is in atari, and it is deterministic", () => {
    const a = generateDoubleAtari(makeRng(3), { rung: 1, size: 7, count: 10 });
    for (const p of a) {
      const b = Board.from(p.size, p.stones);
      for (const s of p.stones)
        if (s.c === "b") expect(group(b, s.x, s.y).liberties.length).toBeGreaterThanOrEqual(2);
    }
    expect(a).toEqual(generateDoubleAtari(makeRng(3), { rung: 1, size: 7, count: 10 }));
  });
});
