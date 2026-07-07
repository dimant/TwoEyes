import { describe, it, expect } from "vitest";
import { Board } from "./board";

describe("Board", () => {
  it("sets and gets stones", () => {
    const b = new Board(5);
    b.set(2, 2, "b");
    expect(b.get(2, 2)).toBe("b");
    expect(b.get(0, 0)).toBeNull();
  });

  it("reports bounds", () => {
    const b = new Board(5);
    expect(b.inBounds(0, 0)).toBe(true);
    expect(b.inBounds(4, 4)).toBe(true);
    expect(b.inBounds(5, 0)).toBe(false);
    expect(b.inBounds(-1, 0)).toBe(false);
  });

  it("lists orthogonal neighbours, clipped to the board", () => {
    const b = new Board(5);
    expect(b.neighbors(0, 0)).toEqual([{ x: 1, y: 0 }, { x: 0, y: 1 }]);
    expect(b.neighbors(2, 2).length).toBe(4);
  });

  it("clone is independent", () => {
    const b = new Board(5);
    b.set(1, 1, "w");
    const c = b.clone();
    c.set(1, 1, null);
    expect(b.get(1, 1)).toBe("w");
    expect(c.get(1, 1)).toBeNull();
  });

  it("from() builds a board and stones() reads it back", () => {
    const b = Board.from(5, [{ x: 0, y: 0, c: "b" }, { x: 4, y: 4, c: "w" }]);
    expect(b.stones()).toEqual([{ x: 0, y: 0, c: "b" }, { x: 4, y: 4, c: "w" }]);
  });

  it("get returns null for out-of-bounds coordinates (no aliasing)", () => {
    const b = new Board(5);
    b.set(0, 1, "b");
    expect(b.get(5, 0)).toBeNull(); // must NOT alias to (0,1)
    expect(b.get(-1, 0)).toBeNull();
  });

  it("set throws for out-of-bounds coordinates", () => {
    const b = new Board(5);
    expect(() => b.set(5, 0, "b")).toThrow();
    expect(() => b.set(0, -1, "w")).toThrow();
  });
});
