import { describe, it, expect } from "vitest";
import { Board } from "./board";
import { group, libertyCount } from "./liberties";

describe("liberties", () => {
  it("counts 4 for a lone stone in the centre", () => {
    const b = Board.from(5, [{ x: 2, y: 2, c: "b" }]);
    expect(libertyCount(b, 2, 2)).toBe(4);
  });

  it("counts 3 on the edge and 2 in the corner", () => {
    expect(libertyCount(Board.from(5, [{ x: 0, y: 2, c: "b" }]), 0, 2)).toBe(3);
    expect(libertyCount(Board.from(5, [{ x: 0, y: 0, c: "b" }]), 0, 0)).toBe(2);
  });

  it("shares liberties across a connected group", () => {
    const b = Board.from(5, [{ x: 2, y: 2, c: "b" }, { x: 2, y: 3, c: "b" }]);
    const g = group(b, 2, 2);
    expect(g.stones.length).toBe(2);
    expect(g.liberties.length).toBe(6);
  });

  it("subtracts enemy contact", () => {
    const b = Board.from(5, [{ x: 2, y: 2, c: "b" }, { x: 2, y: 1, c: "w" }]);
    expect(libertyCount(b, 2, 2)).toBe(3);
  });

  it("returns empty info for an empty point", () => {
    expect(group(new Board(5), 1, 1)).toEqual({ stones: [], liberties: [] });
  });
});
