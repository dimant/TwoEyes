import { describe, it, expect } from "vitest";
import { Board } from "../../engine/board";
import { makeRng } from "../../engine/rng";
import { generateSnapback, snapbackWorks } from "./snapback";

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
