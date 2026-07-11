import { describe, it, expect } from "vitest";
import { Board } from "../../engine/board";
import { play } from "../../engine/rules";
import { group } from "../../engine/liberties";
import { makeRng } from "../../engine/rng";
import { generateEscape, generateEscapeRun, generateEscapeCapture } from "./escape";

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

describe("generateEscapeRun", () => {
  it("target group (1-3 stones) starts in atari; every move escapes by pure extension", () => {
    const puzzles = generateEscapeRun(makeRng(1), { rung: 1, size: 7, count: 20, region: "any", maxGroup: 3 });
    expect(puzzles).toHaveLength(20);
    for (const p of puzzles) {
      expect(p.mode).toBe("M");
      expect(p.marks!.length).toBeGreaterThanOrEqual(1);
      expect(p.marks!.length).toBeLessThanOrEqual(3);
      const rep = p.marks![0]!;
      const before = Board.from(p.size, p.stones);
      // marked stones form one connected black group in atari
      expect(before.get(rep.x, rep.y)).toBe("b");
      expect(group(before, rep.x, rep.y).liberties.length).toBe(1);
      expect(p.solution.kind).toBe("move");
      if (p.solution.kind === "move") {
        expect(p.solution.points.length).toBeGreaterThanOrEqual(1);
        for (const mv of p.solution.points) {
          const r = play(before, mv.x, mv.y, "b");
          expect(r.ok).toBe(true);
          expect(r.captured.length).toBe(0); // pure extension, nothing captured
          expect(group(r.board, rep.x, rep.y).liberties.length).toBeGreaterThanOrEqual(2);
        }
      }
    }
  });

  it("no white attacker is left in atari, and it is deterministic", () => {
    const a = generateEscapeRun(makeRng(7), { rung: 1, size: 7, count: 10, region: "any", maxGroup: 3 });
    for (const p of a) {
      const b = Board.from(p.size, p.stones);
      for (const s of p.stones)
        if (s.c === "w") expect(group(b, s.x, s.y).liberties.length).toBeGreaterThanOrEqual(2);
    }
    expect(a).toEqual(generateEscapeRun(makeRng(7), { rung: 1, size: 7, count: 10, region: "any", maxGroup: 3 }));
  });
});

describe("generateEscapeCapture", () => {
  it("target in atari; escape is by capture; plain extension at own liberty fails", () => {
    const puzzles = generateEscapeCapture(makeRng(2), { rung: 2, size: 7, count: 20, region: "any" });
    expect(puzzles).toHaveLength(20);
    for (const p of puzzles) {
      expect(p.mode).toBe("M");
      const rep = p.marks![0]!;
      const before = Board.from(p.size, p.stones);
      const libs = group(before, rep.x, rep.y).liberties;
      expect(libs.length).toBe(1); // target in atari
      const L = libs[0]!;

      // Plain extension at the group's own liberty must NOT rescue it.
      const ext = play(before, L.x, L.y, "b");
      const extEscaped =
        ext.ok && ext.board.get(rep.x, rep.y) === "b" &&
        group(ext.board, rep.x, rep.y).liberties.length >= 2;
      expect(extEscaped).toBe(false);

      expect(p.solution.kind).toBe("move");
      if (p.solution.kind === "move") {
        expect(p.solution.points.length).toBeGreaterThanOrEqual(1);
        for (const mv of p.solution.points) {
          // the escaping move is at a different point than L
          expect(mv.x === L.x && mv.y === L.y).toBe(false);
          const r = play(before, mv.x, mv.y, "b");
          expect(r.ok).toBe(true);
          expect(r.captured.length).toBeGreaterThan(0); // escape is by capture
          expect(group(r.board, rep.x, rep.y).liberties.length).toBeGreaterThanOrEqual(2);
        }
      }
    }
  });

  it("is deterministic", () => {
    const opts = { rung: 2, size: 7, count: 8, region: "any" as const };
    expect(generateEscapeCapture(makeRng(5), opts)).toEqual(generateEscapeCapture(makeRng(5), opts));
  });
});
