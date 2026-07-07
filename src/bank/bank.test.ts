import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { Board, Point } from "../engine/board";
import { play } from "../engine/rules";
import { group, libertyCount } from "../engine/liberties";
import { goalMoves } from "../generator/validate";
import { isSelfAtari } from "../generator/topics/selfatari";
import { capturedUnderBestPlay } from "../generator/reader";
import { snapbackWorks } from "../generator/topics/snapback";
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
  it("has 360 puzzles, 20 per topic-rung, unique ids", () => {
    expect(bank.puzzles).toHaveLength(360);
    expect(new Set(bank.puzzles.map((p) => p.id)).size).toBe(360);
    const by = new Map<string, number>();
    for (const p of bank.puzzles) {
      const k = `t${p.topic}-r${p.rung}`;
      by.set(k, (by.get(k) ?? 0) + 1);
    }
    for (const t of [1, 2, 3, 4, 5, 6, 7, 10, 11]) for (const r of [1, 2]) expect(by.get(`t${t}-r${r}`)).toBe(20);
  });
});

const mPuzzles: [string, Puzzle][] = bank.puzzles.filter((p) => p.mode === "M" && (p.topic === 2 || p.topic === 3)).map((p) => [p.id, p]);
const qPuzzles: [string, Puzzle][] = bank.puzzles.filter((p) => p.mode === "Q-count").map((p) => [p.id, p]);
const escapePuzzles: [string, Puzzle][] = bank.puzzles.filter((p) => p.topic === 4).map((p) => [p.id, p]);
const dblPuzzles: [string, Puzzle][] = bank.puzzles.filter((p) => p.topic === 6).map((p) => [p.id, p]);
const binPuzzles: [string, Puzzle][] = bank.puzzles.filter((p) => p.mode === "Q-binary").map((p) => [p.id, p]);

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

describe("bank.json — escape puzzles are solvable (topic 4)", () => {
  it.each(escapePuzzles)("%s: target starts in atari and every listed move rescues it", (_id, p) => {
    expect(p.mode).toBe("M");
    expect(p.marks).toHaveLength(1);
    const target = p.marks![0]!;
    const before = Board.from(p.size, p.stones);
    expect(group(before, target.x, target.y).liberties.length).toBe(1);
    expect(p.solution.kind).toBe("move");
    if (p.solution.kind !== "move") return;
    expect(p.solution.points.length).toBeGreaterThanOrEqual(1);
    for (const mv of p.solution.points) {
      const r = play(Board.from(p.size, p.stones), mv.x, mv.y, "b");
      expect(r.ok).toBe(true);
      expect(group(r.board, target.x, target.y).liberties.length).toBeGreaterThanOrEqual(2);
    }
    for (const s of p.stones)
      if (s.c === "w")
        expect(group(before, s.x, s.y).liberties.length).toBeGreaterThanOrEqual(2);
  });
});

describe("bank.json — double-atari puzzles are solvable (topic 6)", () => {
  it.each(dblPuzzles)("%s: unique move ataris two distinct white stones, no capture", (_id, p) => {
    expect(p.solution.kind).toBe("move");
    if (p.solution.kind !== "move") return;
    expect(p.solution.points).toHaveLength(1);
    const mv = p.solution.points[0]!;
    const board = Board.from(p.size, p.stones);
    const r = play(board, mv.x, mv.y, "b");
    expect(r.ok).toBe(true);
    expect(r.captured).toHaveLength(0);
    const seen = new Set<string>();
    let atari = 0;
    for (const n of r.board.neighbors(mv.x, mv.y)) {
      if (r.board.get(n.x, n.y) !== "w") continue;
      const g = group(r.board, n.x, n.y);
      const key = g.stones.map((s) => `${s.x},${s.y}`).sort().join(";");
      if (seen.has(key)) continue;
      seen.add(key);
      if (g.liberties.length === 1) atari++;
    }
    expect(atari).toBeGreaterThanOrEqual(2);
    // unique
    const winners = goalMoves(board, "b", (_b, m, _c, res) => {
      if (res.captured.length > 0) return false;
      const s2 = new Set<string>(); let c = 0;
      for (const n of res.board.neighbors(m.x, m.y)) {
        if (res.board.get(n.x, n.y) !== "w") continue;
        const g = group(res.board, n.x, n.y);
        const k = g.stones.map((z) => `${z.x},${z.y}`).sort().join(";");
        if (s2.has(k)) continue; s2.add(k);
        if (g.liberties.length === 1) c++;
      }
      return c >= 2;
    });
    expect(winners).toHaveLength(1);
    expect(winners[0]).toEqual(mv);
    for (const s of p.stones)
      if (s.c === "b") expect(group(board, s.x, s.y).liberties.length).toBeGreaterThanOrEqual(2);
  });
});

describe("bank.json — self-atari verdicts are correct (topic 5)", () => {
  it.each(binPuzzles)("%s: recorded verdict matches the engine", (_id, p) => {
    expect(p.mode).toBe("Q-binary");
    expect(p.marks).toHaveLength(1);
    const cand = p.marks![0]!;
    const board = Board.from(p.size, p.stones);
    expect(board.get(cand.x, cand.y)).toBeNull();
    expect(p.solution.kind).toBe("choice");
    if (p.solution.kind !== "choice") return;
    const truth = isSelfAtari(board, cand) ? "self-atari" : "safe";
    expect(p.solution.id).toBe(truth);
  });
});

describe("bank.json — self-atari rungs are balanced with real tension (topic 5)", () => {
  for (const rung of [1, 2]) {
    it(`t5-r${rung}: 10 self-atari + 10 safe, and every safe candidate lands on exactly 2 liberties`, () => {
      const g = bank.puzzles.filter((p) => p.topic === 5 && p.rung === rung);
      const id = (p: Puzzle) => (p.solution.kind === "choice" ? p.solution.id : "");
      expect(g.filter((p) => id(p) === "self-atari")).toHaveLength(10);
      const safe = g.filter((p) => id(p) === "safe");
      expect(safe).toHaveLength(10);
      for (const p of safe) {
        const cand = p.marks![0]!;
        const r = play(Board.from(p.size, p.stones), cand.x, cand.y, "b");
        expect(r.ok).toBe(true);
        // one step from self-atari: exactly two liberties (not merely >= 2)
        expect(group(r.board, cand.x, cand.y).liberties.length).toBe(2);
      }
    });
  }
});

const connectPuzzles: [string, Puzzle][] = bank.puzzles.filter((p) => p.topic === 7 && p.rung === 1).map((p) => [p.id, p]);
const cutterPuzzles: [string, Puzzle][] = bank.puzzles.filter((p) => p.topic === 7 && p.rung === 2).map((p) => [p.id, p]);
const netPuzzles: [string, Puzzle][] = bank.puzzles.filter((p) => p.topic === 10).map((p) => [p.id, p]);
const snapPuzzles: [string, Puzzle][] = bank.puzzles.filter((p) => p.topic === 11).map((p) => [p.id, p]);

function oneBlackGroupAfter(p: Puzzle, mv: { x: number; y: number }): boolean {
  const r = play(Board.from(p.size, p.stones), mv.x, mv.y, "b");
  if (!r.ok) return false;
  const keys = new Set(r.board.stones().filter((s) => s.c === "b").map((s) => group(r.board, s.x, s.y).stones.map((q) => `${q.x},${q.y}`).sort().join(";")));
  return keys.size === 1;
}

describe("bank.json — connect puzzles merge Black (topic 7 r1)", () => {
  it.each(connectPuzzles)("%s: the move joins Black into one group", (_id, p) => {
    expect(p.solution.kind).toBe("move");
    if (p.solution.kind !== "move") return;
    expect(oneBlackGroupAfter(p, p.solution.points[0]!)).toBe(true);
  });
});

describe("bank.json — cutter puzzles capture the white stone (topic 7 r2)", () => {
  it.each(cutterPuzzles)("%s: the move captures ≥1", (_id, p) => {
    expect(p.solution.kind).toBe("move");
    if (p.solution.kind !== "move") return;
    const r = play(Board.from(p.size, p.stones), p.solution.points[0]!.x, p.solution.points[0]!.y, "b");
    expect(r.captured.length).toBeGreaterThanOrEqual(1);
  });
});

describe("bank.json — net puzzles trap the target (topic 10)", () => {
  it.each(netPuzzles)("%s: every listed move nets the marked stone", (_id, p) => {
    expect(p.marks).toHaveLength(1);
    const t = p.marks![0]!;
    if (p.solution.kind !== "move") return;
    expect(capturedUnderBestPlay(Board.from(p.size, p.stones), t, "w", 8)).toBe(false);
    for (const mv of p.solution.points) {
      const r = play(Board.from(p.size, p.stones), mv.x, mv.y, "b");
      expect(r.ok).toBe(true);
      expect(r.captured).toHaveLength(0);
      expect(group(r.board, t.x, t.y).liberties.length).toBe(2);
      expect(capturedUnderBestPlay(r.board, t, "w", 8)).toBe(true);
    }
  });
});

describe("bank.json — snapback puzzles recapture (topic 11)", () => {
  it.each(snapPuzzles)("%s: the throw-in snaps back ≥2", (_id, p) => {
    if (p.solution.kind !== "move") return;
    expect(snapbackWorks(Board.from(p.size, p.stones), p.solution.points[0]!).recaptured).toBeGreaterThanOrEqual(2);
  });
});
