import { describe, it, expect } from "vitest";
import { ProgressStore, MASTERY } from "./progress";
import type { RungRef } from "./bank";

function memStore() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
}
const refs: RungRef[] = [
  { topic: 1, rung: 1 }, { topic: 1, rung: 2 },
  { topic: 2, rung: 1 }, { topic: 2, rung: 2 },
];

describe("ProgressStore", () => {
  it("counts correct answers up to MASTERY; wrong answers don't count", () => {
    const ps = new ProgressStore(memStore(), refs);
    ps.record(1, 1, true);
    ps.record(1, 1, false);
    ps.record(1, 1, true);
    expect(ps.masteryCount(1, 1)).toBe(2);
    expect(ps.rungCleared(1, 1)).toBe(false);
    for (let i = 0; i < 5; i++) ps.record(1, 1, true);
    expect(ps.masteryCount(1, 1)).toBe(MASTERY); // capped
    expect(ps.rungCleared(1, 1)).toBe(true);
  });

  it("topic is cleared only when all its rungs are cleared", () => {
    const ps = new ProgressStore(memStore(), refs);
    for (let i = 0; i < MASTERY; i++) ps.record(1, 1, true);
    expect(ps.topicCleared(1)).toBe(false);
    for (let i = 0; i < MASTERY; i++) ps.record(1, 2, true);
    expect(ps.topicCleared(1)).toBe(true);
  });

  it("unlock is linear-with-preview", () => {
    const ps = new ProgressStore(memStore(), refs);
    expect(ps.topicUnlocked(1)).toBe(true); // always
    expect(ps.topicUnlocked(2)).toBe(false);
    for (let i = 0; i < MASTERY; i++) { ps.record(1, 1, true); ps.record(1, 2, true); }
    expect(ps.topicUnlocked(2)).toBe(true);
  });

  it("unlockThrough unlocks the target and every prior topic, without marking them cleared", () => {
    const refs4: RungRef[] = [
      { topic: 1, rung: 1 }, { topic: 2, rung: 1 }, { topic: 3, rung: 1 }, { topic: 4, rung: 1 },
    ];
    const ps = new ProgressStore(memStore(), refs4);
    expect(ps.topicUnlocked(3)).toBe(false);
    ps.unlockThrough(3);
    expect(ps.topicUnlocked(1)).toBe(true);
    expect(ps.topicUnlocked(2)).toBe(true);
    expect(ps.topicUnlocked(3)).toBe(true);
    expect(ps.topicUnlocked(4)).toBe(false); // later topics stay locked
    expect(ps.topicCleared(3)).toBe(false); // unlocked, not completed
  });

  it("unlockThrough persists across instances sharing storage", () => {
    const refs3: RungRef[] = [{ topic: 1, rung: 1 }, { topic: 2, rung: 1 }, { topic: 3, rung: 1 }];
    const storage = memStore();
    new ProgressStore(storage, refs3).unlockThrough(3);
    const b = new ProgressStore(storage, refs3);
    expect(b.topicUnlocked(2)).toBe(true);
    expect(b.topicUnlocked(3)).toBe(true);
  });

  it("persists across instances sharing storage", () => {
    const storage = memStore();
    const a = new ProgressStore(storage, refs);
    for (let i = 0; i < MASTERY; i++) a.record(1, 1, true);
    const b = new ProgressStore(storage, refs);
    expect(b.rungCleared(1, 1)).toBe(true);
  });

  it("tracks lesson-seen per topic and persists it", () => {
    const storage = memStore();
    const a = new ProgressStore(storage, refs);
    expect(a.lessonSeen(2)).toBe(false);
    a.markLessonSeen(2);
    expect(a.lessonSeen(2)).toBe(true);
    expect(a.lessonSeen(1)).toBe(false); // unrelated topic untouched
    const b = new ProgressStore(storage, refs);
    expect(b.lessonSeen(2)).toBe(true); // survived reload
  });

  it("survives corrupted storage without throwing (starts fresh)", () => {
    const bad = { getItem: () => "}{ not json", setItem: () => {} };
    const ps = new ProgressStore(bad, refs);
    expect(ps.masteryCount(1, 1)).toBe(0);
    ps.record(1, 1, true);
    expect(ps.masteryCount(1, 1)).toBe(1); // still usable
  });
});
