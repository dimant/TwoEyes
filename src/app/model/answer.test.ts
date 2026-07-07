import { describe, it, expect } from "vitest";
import { checkAnswer } from "./answer";
import type { Puzzle } from "./types";

const base = { id: "x", topic: 1, rung: 1, size: 5, stones: [], toPlay: "b" as const, prompt: "" };

describe("checkAnswer", () => {
  it("M: accepts any point in the solution set, rejects others", () => {
    const p: Puzzle = { ...base, mode: "M", solution: { kind: "move", points: [{ x: 2, y: 3 }, { x: 4, y: 1 }] } };
    expect(checkAnswer(p, { kind: "move", point: { x: 2, y: 3 } })).toBe(true);
    expect(checkAnswer(p, { kind: "move", point: { x: 4, y: 1 } })).toBe(true);
    expect(checkAnswer(p, { kind: "move", point: { x: 0, y: 0 } })).toBe(false);
  });

  it("Q-count: matches the exact value", () => {
    const p: Puzzle = { ...base, mode: "Q-count", solution: { kind: "value", value: 3 } };
    expect(checkAnswer(p, { kind: "value", value: 3 })).toBe(true);
    expect(checkAnswer(p, { kind: "value", value: 2 })).toBe(false);
  });

  it("Q-binary: matches the chosen id", () => {
    const p: Puzzle = { ...base, mode: "Q-binary", solution: { kind: "choice", id: "self-atari" } };
    expect(checkAnswer(p, { kind: "choice", id: "self-atari" })).toBe(true);
    expect(checkAnswer(p, { kind: "choice", id: "safe" })).toBe(false);
  });

  it("mismatched input kind is never correct", () => {
    const p: Puzzle = { ...base, mode: "M", solution: { kind: "move", points: [{ x: 1, y: 1 }] } };
    expect(checkAnswer(p, { kind: "value", value: 1 })).toBe(false);
  });
});
