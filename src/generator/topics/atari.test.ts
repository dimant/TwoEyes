import { describe, it, expect } from "vitest";
import { Board } from "../../engine/board";
import { play } from "../../engine/rules";
import { makeRng } from "../../engine/rng";
import { generateCapture } from "./atari";

describe("generateCapture", () => {
  it("produces N single-solution capture puzzles (topic 2)", () => {
    const puzzles = generateCapture(makeRng(1), { topic: 2, rung: 1, minCaptured: 1, size: 5, count: 10 });
    expect(puzzles).toHaveLength(10);
    for (const p of puzzles) {
      expect(p.topic).toBe(2);
      expect(p.mode).toBe("M");
      expect(p.solution.kind).toBe("move");
      if (p.solution.kind === "move") {
        // exactly one solution, and playing it really captures
        expect(p.solution.points).toHaveLength(1);
        const b = Board.from(p.size, p.stones);
        const pt = p.solution.points[0]!;
        const r = play(b, pt.x, pt.y, "b");
        expect(r.ok).toBe(true);
        expect(r.captured.length).toBeGreaterThanOrEqual(1);
        expect(p.captured).toEqual(r.captured);
      }
    }
  });

  it("captures ≥2 stones for topic 3", () => {
    const puzzles = generateCapture(makeRng(2), { topic: 3, rung: 1, minCaptured: 2, size: 5, count: 5 });
    for (const p of puzzles) {
      expect(p.captured!.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("is deterministic for a fixed seed", () => {
    const a = generateCapture(makeRng(3), { topic: 2, rung: 1, minCaptured: 1, size: 5, count: 5 });
    const b = generateCapture(makeRng(3), { topic: 2, rung: 1, minCaptured: 1, size: 5, count: 5 });
    expect(a).toEqual(b);
  });
});
