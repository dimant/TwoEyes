import { describe, it, expect } from "vitest";
import { makeRng, randint, pick, shuffle } from "./rng";

describe("rng", () => {
  it("is deterministic for a given seed", () => {
    const a = makeRng(42), b = makeRng(42);
    const seqA = [a(), a(), a()];
    const seqB = [b(), b(), b()];
    expect(seqA).toEqual(seqB);
  });

  it("different seeds differ", () => {
    expect(makeRng(1)()).not.toBe(makeRng(2)());
  });

  it("randint stays in inclusive range", () => {
    const r = makeRng(7);
    for (let i = 0; i < 200; i++) {
      const v = randint(r, 3, 6);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(6);
    }
  });

  it("shuffle keeps all elements and is deterministic", () => {
    const s = shuffle(makeRng(9), [1, 2, 3, 4, 5]);
    expect([...s].sort()).toEqual([1, 2, 3, 4, 5]);
    expect(shuffle(makeRng(9), [1, 2, 3, 4, 5])).toEqual(s);
  });
});
