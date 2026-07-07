import { describe, it, expect } from "vitest";
import { assembleBank } from "./bank";
import { Puzzle } from "./types";

const mk = (topic: number, rung: number): Puzzle => ({
  id: "tmp", topic, rung, mode: "M", size: 5,
  stones: [{ x: 2, y: 2, c: "w" }], toPlay: "b", prompt: "x",
  solution: { kind: "move", points: [{ x: 2, y: 3 }] },
});

describe("assembleBank", () => {
  it("flattens groups and assigns stable ids", () => {
    const bank = assembleBank(1, [[mk(1, 1), mk(1, 1)], [mk(2, 1)]]);
    expect(bank.seed).toBe(1);
    expect(bank.puzzles.map((p) => p.id)).toEqual(["t1-r1-0", "t1-r1-1", "t2-r1-0"]);
  });
});
