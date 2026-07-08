import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { PuzzleBank } from "./bank";
import type { Bank } from "./types";

const bank = JSON.parse(
  readFileSync(new URL("../../bank/bank.json", import.meta.url), "utf8"),
) as Bank;

describe("PuzzleBank", () => {
  const pb = new PuzzleBank(bank);

  it("lists the current topics in order (Stage A 1-6 + Stage B 7,10,11)", () => {
    expect(pb.topics()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });

  it("lists two rungs per topic", () => {
    expect(pb.rungs(1)).toEqual([1, 2]);
    expect(pb.rungs(11)).toEqual([1, 2]);
  });

  it("returns the 20 puzzles for a topic/rung, all matching", () => {
    const ps = pb.puzzles(2, 1);
    expect(ps).toHaveLength(20);
    for (const p of ps) { expect(p.topic).toBe(2); expect(p.rung).toBe(1); }
  });

  it("rungRefs enumerates every rung in topic-major order", () => {
    const refs = pb.rungRefs();
    expect(refs).toHaveLength(22);
    expect(refs[0]).toEqual({ topic: 1, rung: 1 });
    expect(refs[21]).toEqual({ topic: 11, rung: 2 });
  });
});
