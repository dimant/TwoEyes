import { describe, it, expect } from "vitest";
import { applyDemoMove, positionAt, captureRevealPayoff } from "./sequence";
import type { Stone, DemoMove, Puzzle } from "./types";

const initial: Stone[] = [{ x: 0, y: 0, c: "w" }];

describe("applyDemoMove", () => {
  it("adds the placed stone and removes captured stones", () => {
    const m: DemoMove = { x: 0, y: 1, c: "b", captures: [{ x: 0, y: 0 }] };
    expect(applyDemoMove(initial, m)).toEqual([{ x: 0, y: 1, c: "b" }]);
  });

  it("adds the placed stone when nothing is captured", () => {
    const m: DemoMove = { x: 1, y: 0, c: "b" };
    expect(applyDemoMove(initial, m)).toEqual([
      { x: 0, y: 0, c: "w" }, { x: 1, y: 0, c: "b" },
    ]);
  });
});

describe("positionAt", () => {
  const payoff: DemoMove[] = [
    { x: 1, y: 0, c: "b" },
    { x: 0, y: 1, c: "b", captures: [{ x: 0, y: 0 }] },
  ];
  it("step 0 is the initial position", () => {
    expect(positionAt(initial, payoff, 0)).toEqual(initial);
  });
  it("folds up to `step` moves", () => {
    expect(positionAt(initial, payoff, 1)).toEqual([
      { x: 0, y: 0, c: "w" }, { x: 1, y: 0, c: "b" },
    ]);
    expect(positionAt(initial, payoff, 2)).toEqual([
      { x: 1, y: 0, c: "b" }, { x: 0, y: 1, c: "b" },
    ]);
  });
  it("clamps step to the payoff length", () => {
    expect(positionAt(initial, payoff, 99)).toEqual(positionAt(initial, payoff, 2));
  });
});

describe("captureRevealPayoff", () => {
  const capture: Puzzle = {
    id: "c", topic: 2, rung: 1, mode: "M", size: 5, toPlay: "b", prompt: "",
    stones: [{ x: 2, y: 2, c: "w" }, { x: 1, y: 2, c: "b" }, { x: 3, y: 2, c: "b" }, { x: 2, y: 1, c: "b" }],
    solution: { kind: "move", points: [{ x: 2, y: 3 }] },
    captured: [{ x: 2, y: 2 }],
  };

  it("returns a single-move payoff (move + captures) for a capturing move", () => {
    expect(captureRevealPayoff(capture)).toEqual([
      { x: 2, y: 3, c: "b", captures: [{ x: 2, y: 2 }] },
    ]);
  });

  it("returns undefined when nothing is captured", () => {
    expect(captureRevealPayoff({ ...capture, captured: undefined })).toBeUndefined();
    expect(captureRevealPayoff({ ...capture, captured: [] })).toBeUndefined();
  });

  it("returns undefined for a non-move (choice) solution", () => {
    expect(captureRevealPayoff({
      ...capture, mode: "Q-binary", solution: { kind: "choice", id: "caught" },
    })).toBeUndefined();
  });

  it("returns undefined for a non-M mode", () => {
    expect(captureRevealPayoff({ ...capture, mode: "Q-count" })).toBeUndefined();
  });

  it("stepping the payoff drops the captured stone and places the played stone", () => {
    const payoff = captureRevealPayoff(capture)!;
    expect(positionAt(capture.stones, payoff, 1)).toEqual([
      { x: 1, y: 2, c: "b" }, { x: 3, y: 2, c: "b" }, { x: 2, y: 1, c: "b" }, { x: 2, y: 3, c: "b" },
    ]);
  });
});
