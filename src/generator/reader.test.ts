import { describe, it, expect } from "vitest";
import { Board } from "../engine/board";
import { capturedUnderBestPlay } from "./reader";

describe("capturedUnderBestPlay", () => {
  it("captures a stone already in atari (1 ply)", () => {
    const b = Board.from(5, [
      { x: 2, y: 2, c: "w" }, { x: 1, y: 2, c: "b" }, { x: 3, y: 2, c: "b" }, { x: 2, y: 1, c: "b" },
    ]);
    expect(capturedUnderBestPlay(b, { x: 2, y: 2 }, "b", 1)).toBe(true);
  });

  it("reads a working edge-ladder out to the capture", () => {
    // white on the left edge with one black contact -> laddered down the edge, never reaches 3 libs
    const b = Board.from(5, [{ x: 0, y: 2, c: "w" }, { x: 1, y: 2, c: "b" }]);
    expect(capturedUnderBestPlay(b, { x: 0, y: 2 }, "b", 8)).toBe(true);
  });

  it("returns false when the stone runs free to 3+ liberties", () => {
    // black on two sides only -> white runs into open space and escapes
    const b = Board.from(5, [{ x: 2, y: 2, c: "w" }, { x: 1, y: 2, c: "b" }, { x: 3, y: 2, c: "b" }]);
    expect(capturedUnderBestPlay(b, { x: 2, y: 2 }, "b", 8)).toBe(false);
  });

  it("returns false for a stone that already has 3+ liberties", () => {
    expect(capturedUnderBestPlay(Board.from(5, [{ x: 2, y: 2, c: "w" }]), { x: 2, y: 2 }, "b", 8)).toBe(false);
  });

  it("defender escapes by capturing an atari'd chaser, not just by extending", () => {
    const b = Board.from(5, [
      { x: 4, y: 0, c: "b" }, { x: 1, y: 2, c: "w" }, { x: 4, y: 2, c: "w" },
      { x: 1, y: 3, c: "b" }, { x: 0, y: 4, c: "w" }, { x: 2, y: 4, c: "b" },
    ]);
    expect(capturedUnderBestPlay(b, { x: 0, y: 4 }, "w", 6)).toBe(false);
  });
});
