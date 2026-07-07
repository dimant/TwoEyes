import bankData from "../bank/bank.json";
import { PuzzleBank } from "./model/bank";
import { ProgressStore } from "./model/progress";
import type { Bank } from "./model/types";

export function loadBank(data: unknown): Bank {
  if (!data || typeof data !== "object") throw new Error("bank: not an object");
  const b = data as Record<string, unknown>;
  if (typeof b["seed"] !== "number" || typeof b["stage"] !== "string" || !Array.isArray(b["puzzles"])) {
    throw new Error("bank: missing seed/stage/puzzles");
  }
  return data as Bank;
}

export function createStore(): { bank: PuzzleBank; progress: ProgressStore } {
  const bank = new PuzzleBank(loadBank(bankData));
  const progress = new ProgressStore(window.localStorage, bank.rungRefs());
  return { bank, progress };
}
