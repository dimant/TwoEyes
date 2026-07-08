import { describe, it, expect } from "vitest";
import { applyDemoMove, positionAt } from "./sequence";
import type { Stone, DemoMove } from "./types";

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
