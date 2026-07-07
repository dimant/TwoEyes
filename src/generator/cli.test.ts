import { describe, it, expect } from "vitest";
import { buildBank } from "./cli";

describe("buildBank", () => {
  it("covers topics 1-3 with 20 puzzles per rung and unique ids", () => {
    const bank = buildBank(20260706);
    const byRung = new Map<string, number>();
    for (const p of bank.puzzles) {
      const k = `t${p.topic}-r${p.rung}`;
      byRung.set(k, (byRung.get(k) ?? 0) + 1);
    }
    // topics 1,2,3 each have rungs 1 and 2
    for (const t of [1, 2, 3])
      for (const r of [1, 2])
        expect(byRung.get(`t${t}-r${r}`)).toBe(20);

    const ids = bank.puzzles.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length); // all unique
  });

  it("is deterministic", () => {
    expect(buildBank(20260706)).toEqual(buildBank(20260706));
  });
});
