import type { RungRef } from "./bank";

export interface KeyValue {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

export const MASTERY = 4;
const KEY = "two-eyes:progress";
const UNLOCK_KEY = "two-eyes:unlocked";

export class ProgressStore {
  private counts: Record<string, number>;
  // Topics the player has explicitly unlocked via skip-ahead (persisted separately
  // from mastery counts so a jumped-into lesson shows as available, not completed).
  private unlocked: Set<number>;

  constructor(private readonly storage: KeyValue, private readonly refs: RungRef[]) {
    this.counts = ProgressStore.parse(storage.getItem(KEY));
    this.unlocked = ProgressStore.parseUnlocked(storage.getItem(UNLOCK_KEY));
  }

  private static parseUnlocked(raw: string | null): Set<number> {
    if (!raw) return new Set();
    try {
      const arr = JSON.parse(raw) as unknown;
      if (!Array.isArray(arr)) return new Set();
      return new Set(arr.filter((n): n is number => typeof n === "number" && Number.isFinite(n)));
    } catch {
      return new Set();
    }
  }

  private topics(): number[] {
    return [...new Set(this.refs.map((r) => r.topic))].sort((a, b) => a - b);
  }

  /** Skip-ahead: unlock the given topic and every topic before it in the path. Persisted. */
  unlockThrough(topic: number): void {
    const topics = this.topics();
    const idx = topics.indexOf(topic);
    if (idx < 0) return;
    for (let i = 0; i <= idx; i++) this.unlocked.add(topics[i]!);
    this.storage.setItem(UNLOCK_KEY, JSON.stringify([...this.unlocked]));
  }

  // Tolerate corrupted/absent storage: keep only finite-number entries, else start fresh.
  private static parse(raw: string | null): Record<string, number> {
    if (!raw) return {};
    try {
      const obj = JSON.parse(raw) as unknown;
      if (!obj || typeof obj !== "object") return {};
      const out: Record<string, number> = {};
      for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
        if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
      }
      return out;
    } catch {
      return {};
    }
  }

  private key(topic: number, rung: number): string { return `${topic}-${rung}`; }

  record(topic: number, rung: number, correct: boolean): void {
    if (!correct) return;
    const k = this.key(topic, rung);
    this.counts[k] = Math.min(MASTERY, (this.counts[k] ?? 0) + 1);
    this.storage.setItem(KEY, JSON.stringify(this.counts));
  }

  masteryCount(topic: number, rung: number): number {
    return this.counts[this.key(topic, rung)] ?? 0;
  }

  rungCleared(topic: number, rung: number): boolean {
    return this.masteryCount(topic, rung) >= MASTERY;
  }

  topicCleared(topic: number): boolean {
    const rungs = this.refs.filter((r) => r.topic === topic);
    return rungs.length > 0 && rungs.every((r) => this.rungCleared(r.topic, r.rung));
  }

  topicUnlocked(topic: number): boolean {
    if (this.unlocked.has(topic)) return true; // explicitly unlocked via skip-ahead
    const topics = this.topics();
    if (topic === topics[0]) return true;
    const prev = topics[topics.indexOf(topic) - 1];
    return prev !== undefined && this.topicCleared(prev);
  }
}
