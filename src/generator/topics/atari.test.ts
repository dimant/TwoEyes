import { describe, it, expect } from "vitest";
import { Board } from "../../engine/board";
import { play } from "../../engine/rules";
import { makeRng } from "../../engine/rng";
import { generateCapture } from "./atari";

function replayOk(p: ReturnType<typeof generateCapture>[number], minCap: number): void {
  expect(p.solution.kind).toBe("move");
  if (p.solution.kind === "move") {
    expect(p.solution.points).toHaveLength(1);
    const b = Board.from(p.size, p.stones);
    const pt = p.solution.points[0]!;
    const r = play(b, pt.x, pt.y, "b");
    expect(r.ok).toBe(true);
    expect(r.captured.length).toBeGreaterThanOrEqual(minCap);
    expect(p.captured).toEqual(r.captured);
  }
}

describe("generateCapture", () => {
  it("topic 2 interior: 20 distinct single-capture puzzles, each really captures", () => {
    const puzzles = generateCapture(makeRng(1), {
      topic: 2, rung: 1, size: 5, count: 20, groupSize: { min: 1, max: 1 }, region: "interior",
    });
    expect(puzzles).toHaveLength(20);
    const sigs = new Set(puzzles.map((p) => JSON.stringify({ s: p.stones, sol: p.solution })));
    expect(sigs.size).toBe(20);
    for (const p of puzzles) { expect(p.mode).toBe("M"); replayOk(p, 1); }
  });

  it("topic 2 edge: 20 distinct single-capture puzzles on the border", () => {
    const puzzles = generateCapture(makeRng(2), {
      topic: 2, rung: 2, size: 5, count: 20, groupSize: { min: 1, max: 1 }, region: "edge",
    });
    expect(puzzles).toHaveLength(20);
    const sigs = new Set(puzzles.map((p) => JSON.stringify({ s: p.stones, sol: p.solution })));
    expect(sigs.size).toBe(20);
    for (const p of puzzles) replayOk(p, 1);
  });

  it("topic 3: captures a group of >=2 (rung 1) and >=3 (rung 2), all distinct", () => {
    const r1 = generateCapture(makeRng(3), {
      topic: 3, rung: 1, size: 5, count: 20, groupSize: { min: 2, max: 2 }, region: "any",
    });
    expect(new Set(r1.map((p) => JSON.stringify(p.stones))).size).toBe(20);
    for (const p of r1) replayOk(p, 2);

    const r2 = generateCapture(makeRng(4), {
      topic: 3, rung: 2, size: 5, count: 20, groupSize: { min: 3, max: 4 }, region: "any",
    });
    for (const p of r2) replayOk(p, 3);
  });

  it("is deterministic", () => {
    const opts = { topic: 2, rung: 1, size: 5, count: 8, groupSize: { min: 1, max: 1 }, region: "interior" as const };
    expect(generateCapture(makeRng(9), opts)).toEqual(generateCapture(makeRng(9), opts));
  });
});
