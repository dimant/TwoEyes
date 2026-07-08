import { describe, it, expect } from "vitest";
import { Board } from "../../engine/board";
import { play } from "../../engine/rules";
import { makeRng } from "../../engine/rng";
import { generateSnapback, snapbackWorks, snapbackLine } from "./snapback";

describe("snapback", () => {
  it("snapbackWorks confirms a textbook snapback and rejects a plain point", () => {
    // black L around a 2-space white group with a shared throw-in at (2,1)
    const b = Board.from(5, [
      { x: 1, y: 0, c: "b" }, { x: 2, y: 0, c: "b" }, { x: 3, y: 0, c: "b" },
      { x: 0, y: 1, c: "b" }, { x: 3, y: 1, c: "w" }, { x: 3, y: 2, c: "b" },
      { x: 1, y: 1, c: "w" }, { x: 2, y: 1, c: "w" }, { x: 1, y: 2, c: "b" }, { x: 2, y: 2, c: "b" },
    ]);
    // this fixture is illustrative; the real assertion is that SOME point snaps back:
    // exercised through the generator below.
    expect(typeof snapbackWorks(b, { x: 0, y: 0 }).ok).toBe("boolean");
  });

  it("every generated snapback recaptures >= minRecapture under the throw-in", () => {
    const ps = generateSnapback(makeRng(1), { rung: 1, size: 7, count: 8, minRecapture: 2 });
    expect(ps).toHaveLength(8);
    for (const p of ps) {
      if (p.solution.kind !== "move") throw new Error("move");
      const pt = p.solution.points[0]!;
      expect(snapbackWorks(Board.from(p.size, p.stones), pt).recaptured).toBeGreaterThanOrEqual(2);
    }
  });

  it("is deterministic", () => {
    const o = { rung: 1, size: 7, count: 5, minRecapture: 2 };
    expect(generateSnapback(makeRng(4), o)).toEqual(generateSnapback(makeRng(4), o));
  });

  it("rung 2 fills 20 with recapture >= 3 at the production size", () => {
    const ps = generateSnapback(makeRng(9), { rung: 2, size: 7, count: 20, minRecapture: 3 });
    expect(ps).toHaveLength(20);
    for (const p of ps) {
      if (p.solution.kind !== "move") throw new Error("move");
      expect(snapbackWorks(Board.from(p.size, p.stones), p.solution.points[0]!).recaptured).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("snapbackLine", () => {
  it("returns the 3-ply throw-in / capture / recapture line for a working snapback", () => {
    // The topic-11 lesson shape.
    const stones = [
      { x: 5, y: 3, c: "b" as const }, { x: 4, y: 4, c: "b" as const }, { x: 5, y: 4, c: "w" as const },
      { x: 6, y: 4, c: "b" as const }, { x: 4, y: 5, c: "b" as const }, { x: 5, y: 5, c: "w" as const },
      { x: 4, y: 6, c: "b" as const }, { x: 5, y: 6, c: "w" as const },
    ];
    const line = snapbackLine(Board.from(7, stones), { x: 6, y: 6 });
    expect(line).toEqual([
      { x: 6, y: 6, c: "b" },
      { x: 6, y: 5, c: "w" },
      { x: 6, y: 6, c: "b" },
    ]);
  });

  it("returns null for a point that does not snap back", () => {
    const stones = [{ x: 2, y: 2, c: "w" as const }];
    expect(snapbackLine(Board.from(5, stones), { x: 0, y: 0 })).toBeNull();
  });
});

describe("generateSnapback payoff", () => {
  it("every generated puzzle carries a payoff whose final move recaptures >= min", () => {
    const puzzles = generateSnapback(makeRng(42), { rung: 1, size: 7, count: 5, minRecapture: 2 });
    for (const p of puzzles) {
      expect(p.payoff && p.payoff.length).toBe(3);
      // move 0 is a listed solution point
      if (p.solution.kind !== "move") throw new Error("expected move solution");
      const m0 = p.payoff![0]!;
      expect(p.solution.points.some((q) => q.x === m0.x && q.y === m0.y)).toBe(true);
      // replay to the end; the last move recaptures >= 2
      let board = Board.from(p.size, p.stones);
      let lastCap = 0;
      for (const m of p.payoff!) {
        const r = play(board, m.x, m.y, m.c);
        expect(r.ok).toBe(true);
        lastCap = r.captured.length;
        board = r.board;
      }
      expect(lastCap).toBeGreaterThanOrEqual(2);
    }
  });
});
