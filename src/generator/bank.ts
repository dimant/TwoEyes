import { writeFileSync } from "node:fs";
import { Bank, Puzzle } from "./types";

export function assembleBank(seed: number, groups: Puzzle[][]): Bank {
  const puzzles: Puzzle[] = [];
  for (const group of groups) {
    const counters = new Map<string, number>();
    for (const p of group) {
      const key = `t${p.topic}-r${p.rung}`;
      const n = counters.get(key) ?? 0;
      counters.set(key, n + 1);
      puzzles.push({ ...p, id: `${key}-${n}` });
    }
  }
  return { seed, stage: "A", puzzles };
}

export function writeBank(bank: Bank, path: string): void {
  writeFileSync(path, JSON.stringify(bank, null, 2) + "\n");
}
