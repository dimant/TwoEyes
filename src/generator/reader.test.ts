import { describe, it, expect } from "vitest";
import { Board } from "../engine/board";
import { capturedUnderBestPlay, captureLine } from "./reader";
import { play } from "../engine/rules";

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

describe("captureLine", () => {
  it("returns the capture line for a working edge-ladder, ending in the target's removal", () => {
    const b = Board.from(5, [{ x: 0, y: 2, c: "w" }, { x: 1, y: 2, c: "b" }]);
    const line = captureLine(b, { x: 0, y: 2 }, "b", 8);
    expect(line).not.toBeNull();
    // replay it; the target (0,2) must be gone at the end
    let board = b;
    for (const m of line!) {
      const r = play(board, m.x, m.y, m.c);
      expect(r.ok).toBe(true);
      board = r.board;
    }
    expect(board.get(0, 2)).toBeNull();
    // attacker moves first, colors alternate
    expect(line![0]!.c).toBe("b");
  });

  it("returns null when the stone runs free to 3+ liberties", () => {
    const b = Board.from(5, [{ x: 2, y: 2, c: "w" }, { x: 1, y: 2, c: "b" }, { x: 3, y: 2, c: "b" }]);
    expect(captureLine(b, { x: 2, y: 2 }, "b", 8)).toBeNull();
  });

  it("finishes the capture even when the defender's only liberty is itself a suicide (no legal save)", () => {
    // A net shape (from a real bank puzzle, t10-r1-4) where White's forced final
    // extension would fill its own group's last liberty with no compensating
    // capture -> illegal. The defender loop then has zero legal moves; the old
    // code mistook that for "captured in place" and returned early, one ply
    // short of actually removing the group from the board.
    const b = Board.from(7, [
      { x: 3, y: 4, c: "b" }, { x: 3, y: 5, c: "w" }, { x: 4, y: 5, c: "b" },
      { x: 2, y: 6, c: "b" }, { x: 4, y: 6, c: "b" }, { x: 2, y: 4, c: "b" },
    ]);
    const line = captureLine(b, { x: 3, y: 5 }, "w", 8);
    expect(line).not.toBeNull();
    let board = b;
    for (const m of line!) {
      const r = play(board, m.x, m.y, m.c);
      expect(r.ok).toBe(true);
      board = r.board;
    }
    expect(board.get(3, 5)).toBeNull();
  });
});
