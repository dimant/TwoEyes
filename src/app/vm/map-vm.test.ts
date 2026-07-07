import { describe, it, expect } from "vitest";
import { MapViewModel } from "./map-vm";
import { PuzzleBank } from "../model/bank";
import { ProgressStore, MASTERY } from "../model/progress";
import type { Bank, Puzzle } from "../model/types";

function mk(topic: number, rung: number, id: string): Puzzle {
  return { id, topic, rung, mode: "M", size: 5, stones: [], toPlay: "b", prompt: "",
    solution: { kind: "move", points: [{ x: 1, y: 1 }] } };
}
const bank: Bank = { seed: 0, stage: "A", puzzles: [
  mk(1, 1, "a"), mk(1, 2, "b"), mk(2, 1, "c"), mk(2, 2, "d"),
] };
function memStore() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
}

describe("MapViewModel", () => {
  it("topic 1 unlocked, topic 2 locked initially", () => {
    const pb = new PuzzleBank(bank);
    const mv = new MapViewModel(pb, new ProgressStore(memStore(), pb.rungRefs()));
    const rows = mv.snapshot.rows;
    expect(rows.map((r) => r.topic)).toEqual([1, 2]);
    expect(rows[0]!.unlocked).toBe(true);
    expect(rows[1]!.unlocked).toBe(false);
    expect(rows[0]!.rungsTotal).toBe(2);
  });

  it("refresh reflects newly cleared topic and unlocks the next", () => {
    const pb = new PuzzleBank(bank);
    const progress = new ProgressStore(memStore(), pb.rungRefs());
    const mv = new MapViewModel(pb, progress);
    for (let i = 0; i < MASTERY; i++) { progress.record(1, 1, true); progress.record(1, 2, true); }
    mv.refresh();
    const rows = mv.snapshot.rows;
    expect(rows[0]!.cleared).toBe(true);
    expect(rows[0]!.rungsCleared).toBe(2);
    expect(rows[1]!.unlocked).toBe(true);
  });
});
