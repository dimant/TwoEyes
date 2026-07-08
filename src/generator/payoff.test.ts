import { describe, it, expect } from "vitest";
import { annotate, type PlayedMove } from "./payoff";
import type { Stone } from "../engine/board";

describe("annotate", () => {
  it("records the stones each move removes by replaying through the engine", () => {
    // A 1-liberty white stone; Black fills the last liberty and captures it.
    const stones: Stone[] = [
      { x: 2, y: 2, c: "w" }, { x: 1, y: 2, c: "b" }, { x: 3, y: 2, c: "b" }, { x: 2, y: 1, c: "b" },
    ];
    const moves: PlayedMove[] = [{ x: 2, y: 3, c: "b" }];
    expect(annotate(5, stones, moves)).toEqual([
      { x: 2, y: 3, c: "b", captures: [{ x: 2, y: 2 }] },
    ]);
  });

  it("omits `captures` for a move that removes nothing", () => {
    const moves: PlayedMove[] = [{ x: 0, y: 0, c: "b" }];
    expect(annotate(5, [], moves)).toEqual([{ x: 0, y: 0, c: "b" }]);
  });

  it("throws on an illegal move", () => {
    const moves: PlayedMove[] = [{ x: 0, y: 0, c: "b" }, { x: 0, y: 0, c: "w" }];
    expect(() => annotate(5, [], moves)).toThrow(/illegal/);
  });
});
