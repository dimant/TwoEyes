import { describe, it, expect } from "vitest";
import { Board } from "../engine/board";
import { PlayResult } from "../engine/rules";
import { goalMoves, validateM, GoalFn } from "./validate";

const captures: GoalFn = (_b, _m, _c, res: PlayResult) => res.captured.length >= 1;

describe("validateM", () => {
  it("finds the single capturing move (unique)", () => {
    const b = Board.from(5, [
      { x: 2, y: 2, c: "w" }, { x: 1, y: 2, c: "b" },
      { x: 3, y: 2, c: "b" }, { x: 2, y: 1, c: "b" },
    ]);
    const moves = goalMoves(b, "b", captures);
    expect(moves).toEqual([{ x: 2, y: 3 }]);
    expect(validateM(b, "b", captures, "unique")).toEqual({
      valid: true, solution: [{ x: 2, y: 3 }],
    });
  });

  it("rejects a position where two moves capture (not unique)", () => {
    // two separate white stones each in atari -> two capturing moves
    const b = Board.from(5, [
      { x: 1, y: 1, c: "w" }, { x: 0, y: 1, c: "b" }, { x: 1, y: 0, c: "b" }, { x: 2, y: 1, c: "b" },
      { x: 3, y: 3, c: "w" }, { x: 2, y: 3, c: "b" }, { x: 3, y: 2, c: "b" }, { x: 4, y: 3, c: "b" },
    ]);
    // 1,1 last liberty (1,2); 3,3 last liberty (3,4)
    expect(validateM(b, "b", captures, "unique").valid).toBe(false);
  });

  it("any-valid returns the full solution set", () => {
    const b = Board.from(5, [
      { x: 1, y: 1, c: "w" }, { x: 0, y: 1, c: "b" }, { x: 1, y: 0, c: "b" }, { x: 2, y: 1, c: "b" },
      { x: 3, y: 3, c: "w" }, { x: 2, y: 3, c: "b" }, { x: 3, y: 2, c: "b" }, { x: 4, y: 3, c: "b" },
    ]);
    const r = validateM(b, "b", captures, "any-valid");
    expect(r.valid).toBe(true);
    expect(r.solution).toHaveLength(2);
  });
});
