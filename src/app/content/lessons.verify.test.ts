import { describe, it, expect } from "vitest";
import { LESSONS, lessonFor, type Lesson } from "./lessons";
import type { Stone, Pt } from "../model/types";
import { Board } from "../../engine/board";
import { play } from "../../engine/rules";
import { group } from "../../engine/liberties";
import { capturedUnderBestPlay } from "../../generator/reader";
import { snapbackWorks } from "../../generator/topics/snapback";

// These tests prove every shipped lesson diagram actually demonstrates its concept,
// using the same build-time engine/reader that verifies the puzzle bank. If an authored
// shape is wrong, this fails loudly rather than teaching a beginner something false.

function boardOf(stones: Stone[], size: number): Board {
  const bd = new Board(size);
  for (const s of stones) bd.set(s.x, s.y, s.c);
  return bd;
}
const key = (l: Lesson): Pt => {
  const k = l.diagram.keyMove?.[0];
  if (!k) throw new Error(`lesson ${l.topic} has no keyMove`);
  return k;
};
const marked = (l: Lesson, kind: "mark" | "target") =>
  (l.diagram.marks ?? []).filter((m) => m.kind === kind);

describe("lessons content", () => {
  it("covers exactly the 11 current topics, each with title and body", () => {
    expect(LESSONS.map((l) => l.topic)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    for (const l of LESSONS) {
      expect(l.title.length).toBeGreaterThan(0);
      expect(l.body.length).toBeGreaterThanOrEqual(2);
      expect(l.diagram.caption.length).toBeGreaterThan(0);
    }
  });

  it("T1: the marked points are exactly the stone's liberties", () => {
    const l = lessonFor(1)!;
    const bd = boardOf(l.diagram.stones, l.diagram.size);
    const stone = l.diagram.stones[0]!;
    const libs = group(bd, stone.x, stone.y).liberties;
    const key = (p: Pt) => `${p.x},${p.y}`;
    expect(new Set(marked(l, "target").map(key))).toEqual(new Set(libs.map(key)));
    expect(libs.length).toBe(4);
  });

  it("T2: the marked white stone is in atari and the key move captures it", () => {
    const l = lessonFor(2)!;
    const bd = boardOf(l.diagram.stones, l.diagram.size);
    const t = marked(l, "mark")[0]!;
    expect(group(bd, t.x, t.y).liberties.length).toBe(1);
    const r = play(bd, key(l).x, key(l).y, "b");
    expect(r.ok && r.captured.some((c) => c.x === t.x && c.y === t.y)).toBe(true);
  });

  it("T3: the marked group is a 2-stone group in atari, captured whole by the key move", () => {
    const l = lessonFor(3)!;
    const bd = boardOf(l.diagram.stones, l.diagram.size);
    const t = marked(l, "mark")[0]!;
    const g = group(bd, t.x, t.y);
    expect(g.stones.length).toBe(2);
    expect(g.liberties.length).toBe(1);
    const r = play(bd, key(l).x, key(l).y, "b");
    expect(r.ok && r.captured.length).toBe(2);
  });

  it("T4: the marked black stone is in atari and the key move escapes to >=2 liberties, safely", () => {
    const l = lessonFor(4)!;
    const bd = boardOf(l.diagram.stones, l.diagram.size);
    const t = marked(l, "mark")[0]!;
    expect(group(bd, t.x, t.y).liberties.length).toBe(1);
    const r = play(bd, key(l).x, key(l).y, "b");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const after = group(r.board, key(l).x, key(l).y);
    expect(after.liberties.length).toBeGreaterThanOrEqual(2);
    expect(capturedUnderBestPlay(r.board, { x: key(l).x, y: key(l).y }, "w", 6)).toBe(false);
  });

  it("T5: playing the flagged point leaves Black in self-atari and captures nothing", () => {
    const l = lessonFor(5)!;
    const bd = boardOf(l.diagram.stones, l.diagram.size);
    const bad = l.diagram.ataris?.[0]!;
    expect(bad).toBeDefined();
    const r = play(bd, bad.x, bad.y, "b");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(group(r.board, bad.x, bad.y).liberties.length).toBe(1);
    expect(r.captured.length).toBe(0);
  });

  it("T6: the key move puts both marked white stones into atari at once", () => {
    const l = lessonFor(6)!;
    const bd = boardOf(l.diagram.stones, l.diagram.size);
    const r = play(bd, key(l).x, key(l).y, "b");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const atariCount = marked(l, "mark").filter((m) => group(r.board, m.x, m.y).liberties.length === 1).length;
    expect(atariCount).toBe(2);
  });

  it("T7: the two marked black stones are separate before the key move and one group after", () => {
    const l = lessonFor(7)!;
    const bd = boardOf(l.diagram.stones, l.diagram.size);
    const [a, c] = marked(l, "mark");
    expect(group(bd, a!.x, a!.y).stones.length).toBe(1);
    expect(group(bd, c!.x, c!.y).stones.length).toBe(1);
    const r = play(bd, key(l).x, key(l).y, "b");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(group(r.board, key(l).x, key(l).y).stones.length).toBe(3);
  });

  it("T8: the lesson ladder replays legally and captures the marked stone; move 0 is the key move", () => {
    const l = lessonFor(8)!;
    const t = marked(l, "mark")[0]!;
    expect(l.diagram.payoff && l.diagram.payoff.length).toBeGreaterThan(0);
    expect(l.diagram.payoff![0]).toMatchObject(key(l)); // opening atari == keyMove
    let bd = boardOf(l.diagram.stones, l.diagram.size);
    for (const m of l.diagram.payoff!) {
      const r = play(bd, m.x, m.y, m.c);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      bd = r.board;
    }
    expect(bd.get(t.x, t.y)).toBeNull();
  });

  it("T9: the marked stone is NOT caught, and removing the breaker makes it caught", () => {
    const l = lessonFor(9)!;
    const t = marked(l, "mark")[0]!;
    const br = l.diagram.breaker!;
    expect(br).toBeDefined();
    const bd = boardOf(l.diagram.stones, l.diagram.size);
    expect(bd.get(br.x, br.y)).toBe("w");
    expect(capturedUnderBestPlay(bd, { x: t.x, y: t.y }, "b", 12)).toBe(false);
    const without = boardOf(l.diagram.stones.filter((s) => !(s.x === br.x && s.y === br.y)), l.diagram.size);
    expect(capturedUnderBestPlay(without, { x: t.x, y: t.y }, "b", 12)).toBe(true);
  });

  it("T10: the marked stone is alive before, and the key move nets it (2 libs, captured under best play)", () => {
    const l = lessonFor(10)!;
    const bd = boardOf(l.diagram.stones, l.diagram.size);
    const t = marked(l, "mark")[0]!;
    expect(capturedUnderBestPlay(bd, { x: t.x, y: t.y }, "w", 8)).toBe(false); // base alive
    const r = play(bd, key(l).x, key(l).y, "b");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(group(r.board, t.x, t.y).liberties.length).toBe(2);
    expect(capturedUnderBestPlay(r.board, { x: t.x, y: t.y }, "w", 8)).toBe(true);
  });

  it("T11: the key throw-in produces a working snapback", () => {
    const l = lessonFor(11)!;
    const bd = boardOf(l.diagram.stones, l.diagram.size);
    expect(snapbackWorks(bd, key(l)).ok).toBe(true);
  });

  it("T10: the lesson payoff replays legally and captures the marked stone", () => {
    const l = lessonFor(10)!;
    const t = marked(l, "mark")[0]!;
    expect(l.diagram.payoff && l.diagram.payoff.length).toBeGreaterThan(0);
    let bd = boardOf(l.diagram.stones, l.diagram.size);
    for (const m of l.diagram.payoff!) {
      const r = play(bd, m.x, m.y, m.c);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      bd = r.board;
    }
    expect(bd.get(t.x, t.y)).toBeNull();
  });

  it("T11: the lesson payoff replays legally and snaps the group off (>=2)", () => {
    const l = lessonFor(11)!;
    expect(l.diagram.payoff).toHaveLength(3);
    let bd = boardOf(l.diagram.stones, l.diagram.size);
    let lastCap = 0;
    for (const m of l.diagram.payoff!) {
      const r = play(bd, m.x, m.y, m.c);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      lastCap = r.captured.length;
      bd = r.board;
    }
    expect(lastCap).toBeGreaterThanOrEqual(2);
  });
});
