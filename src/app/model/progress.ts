import type { RungRef } from "./bank";

export interface KeyValue {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

export const MASTERY = 4;
const KEY = "two-eyes:progress";

export class ProgressStore {
  private counts: Record<string, number>;

  constructor(private readonly storage: KeyValue, private readonly refs: RungRef[]) {
    const raw = storage.getItem(KEY);
    this.counts = raw ? (JSON.parse(raw) as Record<string, number>) : {};
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
    const topics = [...new Set(this.refs.map((r) => r.topic))].sort((a, b) => a - b);
    if (topic === topics[0]) return true;
    const prev = topics[topics.indexOf(topic) - 1];
    return prev !== undefined && this.topicCleared(prev);
  }
}
