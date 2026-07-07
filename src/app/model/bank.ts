import type { Bank, Puzzle } from "./types";

export interface RungRef { topic: number; rung: number; }

export class PuzzleBank {
  constructor(private readonly bank: Bank) {}

  topics(): number[] {
    return [...new Set(this.bank.puzzles.map((p) => p.topic))].sort((a, b) => a - b);
  }

  rungs(topic: number): number[] {
    return [...new Set(this.bank.puzzles.filter((p) => p.topic === topic).map((p) => p.rung))].sort(
      (a, b) => a - b,
    );
  }

  puzzles(topic: number, rung: number): Puzzle[] {
    return this.bank.puzzles.filter((p) => p.topic === topic && p.rung === rung);
  }

  rungRefs(): RungRef[] {
    const refs: RungRef[] = [];
    for (const topic of this.topics()) for (const rung of this.rungs(topic)) refs.push({ topic, rung });
    return refs;
  }
}
