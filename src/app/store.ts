import bankData from "../bank/bank.json";
import { PuzzleBank } from "./model/bank";
import { ProgressStore, type KeyValue } from "./model/progress";
import type { Bank } from "./model/types";

export function loadBank(data: unknown): Bank {
  if (!data || typeof data !== "object") throw new Error("bank: not an object");
  const b = data as Record<string, unknown>;
  if (typeof b["seed"] !== "number" || typeof b["stage"] !== "string" || !Array.isArray(b["puzzles"])) {
    throw new Error("bank: missing seed/stage/puzzles");
  }
  return data as Bank;
}

// localStorage can be absent or throw on access (private mode, sandboxed iframe).
// Fall back to in-memory storage so the app still runs (progress just won't persist).
export function safeStorage(): KeyValue {
  try {
    const ls = window.localStorage;
    const probe = "__two_eyes_probe__";
    ls.setItem(probe, "1");
    ls.removeItem(probe);
    return ls;
  } catch {
    const mem = new Map<string, string>();
    return { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => void mem.set(k, v) };
  }
}

export function createStore(): { bank: PuzzleBank; progress: ProgressStore } {
  const bank = new PuzzleBank(loadBank(bankData));
  const progress = new ProgressStore(safeStorage(), bank.rungRefs());
  return { bank, progress };
}
