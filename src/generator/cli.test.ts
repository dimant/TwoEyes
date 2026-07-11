import { describe, it, expect } from "vitest";
import { buildBank } from "./cli";
import { Board } from "../engine/board";
import { play } from "../engine/rules";
import { group } from "../engine/liberties";

describe("buildBank", () => {
  it("covers topics 1-3 with 20 puzzles per rung and unique ids", () => {
    const bank = buildBank(20260706);
    const byRung = new Map<string, number>();
    for (const p of bank.puzzles) {
      const k = `t${p.topic}-r${p.rung}`;
      byRung.set(k, (byRung.get(k) ?? 0) + 1);
    }
    // topics 1-6 each have rungs 1 and 2
    for (const t of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
      for (const r of [1, 2])
        expect(byRung.get(`t${t}-r${r}`)).toBe(20);

    expect(bank.puzzles).toHaveLength(440);

    const ids = bank.puzzles.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length); // all unique
  });

  it("is deterministic", () => {
    expect(buildBank(20260706)).toEqual(buildBank(20260706));
  });

  it("every rung is fully distinct and topic 1 rung 2 includes an atari (answer 1)", () => {
    const bank = buildBank(20260706);
    const groups = new Map<string, typeof bank.puzzles>();
    for (const p of bank.puzzles) {
      const k = `t${p.topic}-r${p.rung}`;
      (groups.get(k) ?? groups.set(k, []).get(k)!).push(p);
    }
    for (const [k, g] of groups) {
      const sigs = new Set(g.map((p) => JSON.stringify({ s: p.stones, sol: p.solution, m: p.marks })));
      expect(sigs.size, `${k} should be fully distinct`).toBe(g.length);
    }
    const t1r2 = bank.puzzles.filter((p) => p.topic === 1 && p.rung === 2);
    const hasAtari = t1r2.some((p) => p.solution.kind === "value" && p.solution.value === 1);
    expect(hasAtari).toBe(true);
  });

  it("curation spreads difficulty: each topic-1 rung opens with three different answers", () => {
    const bank = buildBank(20260706);
    for (const rung of [1, 2]) {
      const firstThree = bank.puzzles
        .filter((p) => p.topic === 1 && p.rung === rung)
        .slice(0, 3)
        .map((p) => (p.solution.kind === "value" ? p.solution.value : -1));
      expect(new Set(firstThree).size, `t1-r${rung} opening variety`).toBe(3);
    }
  });

  it("topic 4 rung 1 escapes by extension; rung 2 escapes by capture", () => {
    const bank = buildBank(20260706);
    const byRung = (rung: number) => bank.puzzles.filter((p) => p.topic === 4 && p.rung === rung);

    for (const p of byRung(1)) {
      const board = Board.from(p.size, p.stones);
      const rep = p.marks![0]!;
      expect(group(board, rep.x, rep.y).liberties.length).toBe(1);
      if (p.solution.kind === "move")
        for (const mv of p.solution.points) {
          const r = play(board, mv.x, mv.y, "b");
          expect(r.ok).toBe(true);
          expect(r.captured.length).toBe(0);
          expect(group(r.board, rep.x, rep.y).liberties.length).toBeGreaterThanOrEqual(2);
        }
    }

    for (const p of byRung(2)) {
      const board = Board.from(p.size, p.stones);
      const rep = p.marks![0]!;
      const libs = group(board, rep.x, rep.y).liberties;
      expect(libs.length).toBe(1);
      const L = libs[0]!;
      const ext = play(board, L.x, L.y, "b");
      const extEscaped =
        ext.ok && ext.board.get(rep.x, rep.y) === "b" &&
        group(ext.board, rep.x, rep.y).liberties.length >= 2;
      expect(extEscaped).toBe(false);
      if (p.solution.kind === "move")
        for (const mv of p.solution.points) {
          const r = play(board, mv.x, mv.y, "b");
          expect(r.ok).toBe(true);
          expect(r.captured.length).toBeGreaterThan(0);
          expect(group(r.board, rep.x, rep.y).liberties.length).toBeGreaterThanOrEqual(2);
        }
    }
  });
});
