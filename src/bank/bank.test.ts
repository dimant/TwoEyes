import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { Board, Point } from "../engine/board";
import { play } from "../engine/rules";
import { group, libertyCount } from "../engine/liberties";
import { goalMoves } from "../generator/validate";
import type { Bank, Puzzle } from "../generator/types";

// Solvability suite for the committed bank: every shipped puzzle is replayed
// through the real rules engine. Guards the data, not the generator — a future
// regeneration that emits a broken or unsolvable puzzle fails here.
const bank = JSON.parse(
  readFileSync(new URL("./bank.json", import.meta.url), "utf8"),
) as Bank;

const norm = (pts: Point[]): string =>
  pts.map((p) => `${p.x},${p.y}`).sort().join(" ");

describe("bank.json — shape", () => {
  it("has 120 puzzles, 20 per topic-rung, unique ids", () => {
    expect(bank.puzzles).toHaveLength(120);
    expect(new Set(bank.puzzles.map((p) => p.id)).size).toBe(120);
    const by = new Map<string, number>();
    for (const p of bank.puzzles) {
      const k = `t${p.topic}-r${p.rung}`;
      by.set(k, (by.get(k) ?? 0) + 1);
    }
    for (const t of [1, 2, 3]) for (const r of [1, 2]) expect(by.get(`t${t}-r${r}`)).toBe(20);
  });
});

const mPuzzles: [string, Puzzle][] = bank.puzzles.filter((p) => p.mode === "M").map((p) => [p.id, p]);
const qPuzzles: [string, Puzzle][] = bank.puzzles.filter((p) => p.mode === "Q-count").map((p) => [p.id, p]);

describe("bank.json — capture puzzles are solvable (M)", () => {
  it.each(mPuzzles)("%s: legal, captures the recorded stones, and the solution is unique", (_id, p) => {
    expect(p.solution.kind).toBe("move");
    if (p.solution.kind !== "move") return;
    expect(p.solution.points).toHaveLength(1);
    const move = p.solution.points[0]!;
    const board = Board.from(p.size, p.stones);

    // there is something to capture
    expect(p.stones.some((s) => s.c === "w")).toBe(true);

    // the recorded move is legal and captures exactly the recorded stones
    const res = play(board, move.x, move.y, "b");
    expect(res.ok).toBe(true);
    const need = p.topic === 3 ? 2 : 1;
    expect(res.captured.length).toBeGreaterThanOrEqual(need);
    expect(norm(res.captured)).toBe(norm(p.captured ?? []));

    // solvable AND unambiguous: exactly one black move captures anything, and it is the recorded one
    const winners = goalMoves(board, "b", (_b, _m, _c, r) => r.captured.length >= 1);
    expect(winners).toHaveLength(1);
    expect(winners[0]).toEqual(move);

    // clean shape: no helper black stone is itself in atari
    for (const s of p.stones) {
      if (s.c === "b") expect(group(board, s.x, s.y).liberties.length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("bank.json — liberty puzzles are correct (Q)", () => {
  it.each(qPuzzles)("%s: recorded answer equals the true liberty count (1-4)", (_id, p) => {
    expect(p.solution.kind).toBe("value");
    if (p.solution.kind !== "value") return;
    expect(p.marks).toHaveLength(1);
    const mark = p.marks![0]!;
    const board = Board.from(p.size, p.stones);
    expect(board.get(mark.x, mark.y)).toBe("b");
    expect(libertyCount(board, mark.x, mark.y)).toBe(p.solution.value);
    expect(p.solution.value).toBeGreaterThanOrEqual(1);
    expect(p.solution.value).toBeLessThanOrEqual(4);
  });
});
