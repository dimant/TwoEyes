import { describe, it, expect } from "vitest";
import { Board } from "./board";
import { play, opposite } from "./rules";

describe("rules.play", () => {
  it("opposite flips colour", () => {
    expect(opposite("b")).toBe("w");
    expect(opposite("w")).toBe("b");
  });

  it("captures a stone with one liberty and does not mutate the input", () => {
    // white at 2,2 in atari; black plays its last liberty 2,3
    const b = Board.from(5, [
      { x: 2, y: 2, c: "w" }, { x: 1, y: 2, c: "b" },
      { x: 3, y: 2, c: "b" }, { x: 2, y: 1, c: "b" },
    ]);
    const r = play(b, 2, 3, "b");
    expect(r.ok).toBe(true);
    expect(r.captured).toEqual([{ x: 2, y: 2 }]);
    expect(r.board.get(2, 2)).toBeNull();
    expect(b.get(2, 2)).toBe("w"); // original untouched
  });

  it("captures a two-stone group at once", () => {
    const b = Board.from(5, [
      { x: 2, y: 2, c: "w" }, { x: 2, y: 3, c: "w" },
      { x: 1, y: 2, c: "b" }, { x: 3, y: 2, c: "b" }, { x: 2, y: 1, c: "b" },
      { x: 1, y: 3, c: "b" }, { x: 3, y: 3, c: "b" },
    ]);
    const r = play(b, 2, 4, "b");
    expect(r.ok).toBe(true);
    expect(r.captured).toHaveLength(2);
  });

  it("rejects occupied points", () => {
    const b = Board.from(5, [{ x: 1, y: 1, c: "b" }]);
    expect(play(b, 1, 1, "w").ok).toBe(false);
  });

  it("rejects suicide that captures nothing", () => {
    // black surrounds 0,0; white plays into 0,0 with no capture
    const b = Board.from(5, [{ x: 1, y: 0, c: "b" }, { x: 0, y: 1, c: "b" }]);
    const r = play(b, 0, 0, "w");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("suicide");
  });
});
