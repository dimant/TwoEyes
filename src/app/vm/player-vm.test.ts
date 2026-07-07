import { describe, it, expect } from "vitest";
import { PlayerViewModel } from "./player-vm";
import { PuzzleBank } from "../model/bank";
import { ProgressStore } from "../model/progress";
import type { Bank, Puzzle } from "../model/types";

function mkMove(id: string): Puzzle {
  return {
    id, topic: 2, rung: 1, mode: "M", size: 5, stones: [], toPlay: "b", prompt: "",
    solution: { kind: "move", points: [{ x: 1, y: 1 }] },
  };
}
const bank: Bank = { seed: 0, stage: "A", puzzles: [mkMove("a"), mkMove("b")] };
function memStore() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
}
function vm() {
  const pb = new PuzzleBank(bank);
  return new PlayerViewModel(pb, new ProgressStore(memStore(), pb.rungRefs()), 2, 1);
}

describe("PlayerViewModel", () => {
  it("starts idle on the first puzzle", () => {
    const v = vm();
    expect(v.snapshot.puzzle?.id).toBe("a");
    expect(v.snapshot.phase).toBe("idle");
  });

  it("correct answer records mastery and enters correct phase", () => {
    const v = vm();
    v.submit({ kind: "move", point: { x: 1, y: 1 } });
    expect(v.snapshot.phase).toBe("correct");
    expect(v.snapshot.mastery).toBe(1);
  });

  it("first wrong -> wrong; second wrong -> revealed; retry returns to idle", () => {
    const v = vm();
    v.submit({ kind: "move", point: { x: 0, y: 0 } });
    expect(v.snapshot.phase).toBe("wrong");
    expect(v.snapshot.misses).toBe(1);
    v.retry();
    expect(v.snapshot.phase).toBe("idle");
    v.submit({ kind: "move", point: { x: 0, y: 0 } });
    expect(v.snapshot.phase).toBe("revealed");
    expect(v.snapshot.misses).toBe(2);
  });

  it("next advances the queue, then marks done when exhausted", () => {
    const v = vm();
    v.submit({ kind: "move", point: { x: 1, y: 1 } });
    v.next();
    expect(v.snapshot.puzzle?.id).toBe("b");
    expect(v.snapshot.phase).toBe("idle");
    expect(v.snapshot.misses).toBe(0);
    v.submit({ kind: "move", point: { x: 1, y: 1 } });
    v.next();
    expect(v.snapshot.done).toBe(true);
    expect(v.snapshot.puzzle).toBeNull();
  });

  it("submitting after the answer is revealed is a no-op (no mastery after reveal)", () => {
    const v = vm();
    v.submit({ kind: "move", point: { x: 0, y: 0 } });
    v.submit({ kind: "move", point: { x: 0, y: 0 } });
    expect(v.snapshot.phase).toBe("revealed");
    v.submit({ kind: "move", point: { x: 1, y: 1 } }); // the correct move, but too late
    expect(v.snapshot.phase).toBe("revealed");
    expect(v.snapshot.mastery).toBe(0);
  });

  it("the rung ends at mastery (4 correct), not after the whole queue", () => {
    const big: Bank = { seed: 0, stage: "A", puzzles: ["a", "b", "c", "d", "e", "f"].map(mkMove) };
    const pb = new PuzzleBank(big);
    const v = new PlayerViewModel(pb, new ProgressStore(memStore(), pb.rungRefs()), 2, 1);
    for (let i = 0; i < 4; i++) {
      v.submit({ kind: "move", point: { x: 1, y: 1 } });
      expect(v.snapshot.phase).toBe("correct");
      v.next();
    }
    expect(v.snapshot.mastery).toBe(4);
    expect(v.snapshot.done).toBe(true); // done after 4, with puzzles still left in the queue
    expect(v.snapshot.puzzle).toBeNull();
  });
});
