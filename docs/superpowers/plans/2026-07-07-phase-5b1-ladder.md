# Phase 5b.1 — Ladder (8) via animated payoff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add topic 8 (the ladder / *shicho*) as a "pick the opening atari, then watch it resolve" puzzle — an `"M"` tap puzzle with a full-ladder `payoff` that reuses 5a's animation unchanged.

**Architecture:** A build-time ladder generator reuses 5a's `captureLine` to extract and verify the forced ladder line, keeping only shapes with a *unique* winning opening atari (so the single-point solution grades cleanly and the animation matches the tap). The line is stored as the puzzle's `payoff`; the runtime is untouched — topic 8 flows through the existing 5a reveal-animation path in `PlayerScreen`. No new mode, view-model, tree, or type change.

**Tech Stack:** TypeScript (ESM), React 18 MVVM, Vitest + jsdom, seeded generator CLI (`tsx`).

## Global Constraints

- **Engine never ships to the client.** The generator/reader are build-time only; the app replays the pre-verified `payoff` as dumb data.
- **No app runtime logic changes.** Topic 8 is a `mode: "M"` puzzle with a `payoff`, so it reuses 5a's payoff-reveal path in `PlayerScreen` **unchanged**. The only app edits are a map title string and lesson *data*. `PlayerViewModel`, `checkAnswer`, `PayoffBoard`, `useSequencePlayer` are untouched.
- **No type changes.** Topic 8 reuses the existing `Puzzle` shape and 5a's `payoff?: DemoMove[]`.
- **Topic 8 puzzle shape:** `mode: "M"`, `toPlay: "b"`, `solution: { kind: "move", points: [openingAtari] }` (a single point), `payoff` = the full ladder line with move 0 equal to the solution point, `marks: [{x,y,kind:"mark"}]` on the White target.
- **Unique opening atari:** the generator keeps only ladders where exactly one of the target's two liberties is a winning opening atari.
- **Determinism / bank integrity:** topic-8 generation is **appended at the END of `buildBank`** (after topic 11) so the RNG stream for the existing 360 puzzles is unchanged and they stay byte-identical. Bank grows **360 → 400**. `npm run generate` stays deterministic.
- **Rung params:** rung 1 = 7×7, `requireFailingAlt: false`; rung 2 = 9×9, `requireFailingAlt: true` (the other atari is a legal atari that escapes — a tempting wrong turn).
- **Everything verified:** every ladder's payoff is replayed through `play()` in a permanent test; nothing ships on trust.
- Prompt copy (exact): `"Black to play — start the ladder to catch the stone."`
- Run tests with `npm test`; typecheck `npm run typecheck`; build `npm run build`; regenerate `npm run generate`.

---

## File Structure

**Create:**
- `src/generator/topics/ladder.ts` — `generateLadder(rng, opts)` + `winningOpenings` helper. Build-time.
- `src/generator/topics/ladder.test.ts` — generator invariants.

**Modify:**
- `src/generator/cli.ts` — wire topic 8 (append at end of `buildBank`); import `generateLadder`.
- `src/bank/bank.json` — regenerated (40 topic-8 puzzles appended; bank → 400).
- `src/bank/bank.test.ts` — topic-8 solvability block; 360→400 count + topic-list.
- `src/app/model/bank.test.ts` — topic-list assertion adds 8.
- `src/app/content/lessons.ts` — topic-8 animated lesson (verified payoff literal).
- `src/app/content/lessons.verify.test.ts` — T8 lesson verify; topic-list + count.
- `src/app/ui/MapScreen.tsx` — `TOPIC_TITLES` gains `8: "Ladder"`.
- `PLAN.md` — tracker: topic 8 done, 5b.2 (breaker) next.

---

## Task 1: Ladder generator (topic 8)

**Files:**
- Create: `src/generator/topics/ladder.ts`
- Test: `src/generator/topics/ladder.test.ts`

**Interfaces:**
- Consumes: `capturedUnderBestPlay`, `captureLine` from `../reader`; `annotate` from `../payoff`; `Board`, `Point` from `../../engine/board`; `play` from `../../engine/rules`; `group` from `../../engine/liberties`; `Rng`, `randint`, `shuffle` from `../../engine/rng`; `Puzzle` from `../types`.
- Produces: `generateLadder(rng: Rng, opts: { rung: number; size: number; count: number; requireFailingAlt: boolean }): Puzzle[]` and `winningOpenings(board: Board, t: Point): Point[]`.

- [ ] **Step 1: Write the failing test**

Create `src/generator/topics/ladder.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { generateLadder } from "./ladder";
import { makeRng } from "../../engine/rng";
import { Board } from "../../engine/board";
import { play } from "../../engine/rules";
import { group } from "../../engine/liberties";
import { capturedUnderBestPlay } from "../reader";

describe("generateLadder", () => {
  it("rung 1 (7x7): each puzzle has a unique opening atari and a payoff that captures the target", () => {
    const puzzles = generateLadder(makeRng(1), { rung: 1, size: 7, count: 8, requireFailingAlt: false });
    expect(puzzles).toHaveLength(8);
    for (const p of puzzles) {
      expect(p.topic).toBe(8);
      expect(p.mode).toBe("M");
      if (p.solution.kind !== "move") throw new Error("expected move solution");
      expect(p.solution.points).toHaveLength(1);
      const t = p.marks![0]!;
      // move 0 of the payoff is the opening atari (the solution)
      expect(p.payoff && p.payoff.length).toBeGreaterThan(0);
      expect(p.payoff![0]!.x).toBe(p.solution.points[0]!.x);
      expect(p.payoff![0]!.y).toBe(p.solution.points[0]!.y);
      // >= 2 black moves (a real multi-step ladder)
      expect(p.payoff!.filter((m) => m.c === "b").length).toBeGreaterThanOrEqual(2);
      // payoff replays to the target's capture
      let board = Board.from(p.size, p.stones);
      for (const m of p.payoff!) { const r = play(board, m.x, m.y, m.c); expect(r.ok).toBe(true); board = r.board; }
      expect(board.get(t.x, t.y)).toBeNull();
      // exactly one of the target's liberties is a winning opening atari
      const libs = group(Board.from(p.size, p.stones), t.x, t.y).liberties;
      const winners = libs.filter((m) => {
        const r = play(Board.from(p.size, p.stones), m.x, m.y, "b");
        if (!r.ok) return false;
        if (r.board.get(t.x, t.y) === null) return true;
        if (group(r.board, t.x, t.y).liberties.length !== 1) return false;
        return capturedUnderBestPlay(r.board, t, "w", 8);
      });
      expect(winners).toHaveLength(1);
    }
  });

  it("rung 2 (9x9): the OTHER atari is a legal atari that escapes (a tempting wrong turn)", () => {
    const puzzles = generateLadder(makeRng(2), { rung: 2, size: 9, count: 6, requireFailingAlt: true });
    expect(puzzles).toHaveLength(6);
    for (const p of puzzles) {
      if (p.solution.kind !== "move") throw new Error("expected move solution");
      const t = p.marks![0]!;
      const sol = p.solution.points[0]!;
      const before = Board.from(p.size, p.stones);
      const other = group(before, t.x, t.y).liberties.find((l) => !(l.x === sol.x && l.y === sol.y));
      expect(other).toBeDefined();
      const r = play(before, other!.x, other!.y, "b");
      expect(r.ok).toBe(true);
      expect(group(r.board, t.x, t.y).liberties.length).toBe(1); // it IS an atari
      expect(capturedUnderBestPlay(r.board, t, "w", 8)).toBe(false); // but it escapes
    }
  });

  it("is deterministic for a given seed", () => {
    const a = generateLadder(makeRng(7), { rung: 1, size: 7, count: 5, requireFailingAlt: false });
    const b = generateLadder(makeRng(7), { rung: 1, size: 7, count: 5, requireFailingAlt: false });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/generator/topics/ladder.test.ts`
Expected: FAIL — `Failed to resolve import "./ladder"`.

- [ ] **Step 3: Implement `ladder.ts`**

Create `src/generator/topics/ladder.ts`:

```ts
import { Board, Point } from "../../engine/board";
import { play } from "../../engine/rules";
import { group } from "../../engine/liberties";
import { capturedUnderBestPlay, captureLine } from "../reader";
import { annotate } from "../payoff";
import { Rng, randint, shuffle } from "../../engine/rng";
import { Puzzle } from "../types";

// Target liberties where Black's atari leaves the target in atari (1 liberty) and
// leads to capture under best play — the "winning opening" ataris of the ladder.
export function winningOpenings(board: Board, t: Point): Point[] {
  const out: Point[] = [];
  for (const m of group(board, t.x, t.y).liberties) {
    const r = play(board, m.x, m.y, "b");
    if (!r.ok) continue;
    if (r.board.get(t.x, t.y) === null) { out.push(m); continue; } // immediate capture
    if (group(r.board, t.x, t.y).liberties.length !== 1) continue;  // must be an atari
    if (capturedUnderBestPlay(r.board, t, "w", 8)) out.push(m);
  }
  return out;
}

export function generateLadder(
  rng: Rng,
  opts: { rung: number; size: number; count: number; requireFailingAlt: boolean },
): Puzzle[] {
  const { rung, size, count, requireFailingAlt } = opts;
  const out: Puzzle[] = [];
  const seen = new Set<string>();
  let guard = 0;

  while (out.length < count && guard++ < count * 5000) {
    const board = new Board(size);
    const t: Point = { x: randint(rng, 1, size - 2), y: randint(rng, 1, size - 2) };
    board.set(t.x, t.y, "w");
    // fill two of the four neighbours with Black -> leave exactly 2 liberties
    const nbrs = shuffle(rng, board.neighbors(t.x, t.y));
    for (let i = 0; i < 2; i++) board.set(nbrs[i]!.x, nbrs[i]!.y, "b");
    // optional diagonal "wall" stone that channels the run
    const diags = shuffle(rng, [
      { x: t.x + 1, y: t.y + 1 }, { x: t.x - 1, y: t.y + 1 },
      { x: t.x + 1, y: t.y - 1 }, { x: t.x - 1, y: t.y - 1 },
    ].filter((p) => p.x >= 0 && p.y >= 0 && p.x < size && p.y < size));
    if (diags.length && board.get(diags[0]!.x, diags[0]!.y) === null) board.set(diags[0]!.x, diags[0]!.y, "b");

    const tg = group(board, t.x, t.y);
    if (tg.liberties.length !== 2) continue;
    // clean shape: no Black helper stone is itself in atari
    if (board.stones().some((s) => s.c === "b" && group(board, s.x, s.y).liberties.length <= 1)) continue;

    const openings = winningOpenings(board, t);
    if (openings.length !== 1) continue; // UNIQUE winning opening atari
    const opening = openings[0]!;

    if (requireFailingAlt) {
      // the OTHER liberty must be a legal atari that does NOT capture (a tempting wrong turn)
      const other = tg.liberties.find((l) => !(l.x === opening.x && l.y === opening.y));
      if (!other) continue;
      const r = play(board, other.x, other.y, "b");
      if (!r.ok) continue;
      if (group(r.board, t.x, t.y).liberties.length !== 1) continue; // must be an atari
      if (capturedUnderBestPlay(r.board, t, "w", 8)) continue;        // must escape (fail)
    }

    const line = captureLine(board, t, "b", 8);
    if (!line) continue;
    if (line.filter((m) => m.c === "b").length < 2) continue; // a real multi-step ladder
    const payoff = annotate(size, board.stones(), line);

    const puzzle: Puzzle = {
      id: "tmp", topic: 8, rung, mode: "M", size, stones: board.stones(), toPlay: "b",
      prompt: "Black to play — start the ladder to catch the stone.",
      solution: { kind: "move", points: [opening] },
      marks: [{ x: t.x, y: t.y, kind: "mark" }],
      payoff,
    };
    const sig = JSON.stringify({ s: puzzle.stones, m: [t.x, t.y] });
    if (seen.has(sig)) continue;
    seen.add(sig);
    out.push(puzzle);
  }

  if (out.length < count) {
    throw new Error(`generateLadder: produced ${out.length}/${count} (rung ${rung}, size ${size})`);
  }
  return out;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/generator/topics/ladder.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/generator/topics/ladder.ts src/generator/topics/ladder.test.ts
git commit -m "feat(generator): ladder (topic 8) generator — unique opening atari + full payoff"
```

---

## Task 2: Wire topic 8 into the bank + regenerate + verify

**Files:**
- Modify: `src/generator/cli.ts`
- Modify: `src/bank/bank.json` (regenerated)
- Modify: `src/bank/bank.test.ts`
- Modify: `src/app/model/bank.test.ts`

**Interfaces:**
- Consumes: `generateLadder` from `./topics/ladder`; the committed `payoff` on every topic-8 puzzle.

- [ ] **Step 1: Add the failing bank-verification block + updated counts**

In `src/bank/bank.test.ts`:

(a) Update the shape test (currently asserts 360):

```ts
  it("has 400 puzzles, 20 per topic-rung, unique ids", () => {
    expect(bank.puzzles).toHaveLength(400);
    expect(new Set(bank.puzzles.map((p) => p.id)).size).toBe(400);
    const by = new Map<string, number>();
    for (const p of bank.puzzles) {
      const k = `t${p.topic}-r${p.rung}`;
      by.set(k, (by.get(k) ?? 0) + 1);
    }
    for (const t of [1, 2, 3, 4, 5, 6, 7, 8, 10, 11]) for (const r of [1, 2]) expect(by.get(`t${t}-r${r}`)).toBe(20);
  });
```

(b) Append a topic-8 block (the file already imports `Board`, `play`, `group`, `capturedUnderBestPlay`, `norm`):

```ts
const ladderPuzzles: [string, Puzzle][] = bank.puzzles.filter((p) => p.topic === 8).map((p) => [p.id, p]);

describe("bank.json — ladder puzzles catch the stone (topic 8)", () => {
  it.each(ladderPuzzles)("%s: unique opening atari; payoff replays to the target's capture", (_id, p) => {
    expect(p.solution.kind).toBe("move");
    if (p.solution.kind !== "move") return;
    expect(p.solution.points).toHaveLength(1);
    const sol = p.solution.points[0]!;
    const t = p.marks![0]!;
    // move 0 of the payoff is the opening atari (the solution)
    expect(p.payoff && p.payoff.length).toBeGreaterThan(0);
    expect(p.payoff![0]!.x).toBe(sol.x);
    expect(p.payoff![0]!.y).toBe(sol.y);
    expect(p.payoff!.filter((m) => m.c === "b").length).toBeGreaterThanOrEqual(2);
    // replay the payoff -> target captured, each stored `captures` is engine-truth
    let board = Board.from(p.size, p.stones);
    for (const m of p.payoff!) {
      const res = play(board, m.x, m.y, m.c);
      expect(res.ok).toBe(true);
      expect(norm(res.captured)).toBe(norm(m.captures ?? []));
      board = res.board;
    }
    expect(board.get(t.x, t.y)).toBeNull();
    // the opening atari is the UNIQUE winning opening among the target's liberties
    const before = Board.from(p.size, p.stones);
    const winners = group(before, t.x, t.y).liberties.filter((m) => {
      const r = play(Board.from(p.size, p.stones), m.x, m.y, "b");
      if (!r.ok) return false;
      if (r.board.get(t.x, t.y) === null) return true;
      if (group(r.board, t.x, t.y).liberties.length !== 1) return false;
      return capturedUnderBestPlay(r.board, t, "w", 8);
    });
    expect(winners).toHaveLength(1);
    // rung 2: the other atari is a legal atari that escapes (tempting wrong turn)
    if (p.rung === 2) {
      const other = group(before, t.x, t.y).liberties.find((l) => !(l.x === sol.x && l.y === sol.y));
      expect(other).toBeDefined();
      const r = play(before, other!.x, other!.y, "b");
      expect(r.ok).toBe(true);
      expect(group(r.board, t.x, t.y).liberties.length).toBe(1);
      expect(capturedUnderBestPlay(r.board, t, "w", 8)).toBe(false);
    }
  });
});
```

- [ ] **Step 2: Run it to verify it fails against the current bank**

Run: `npx vitest run src/bank/bank.test.ts`
Expected: FAIL — the committed bank has 360 puzzles and no topic 8 (`toHaveLength(400)` fails; `ladderPuzzles` is empty).

- [ ] **Step 3: Wire topic 8 into `buildBank` (appended LAST)**

In `src/generator/cli.ts`, add the import near the other topic imports:

```ts
import { generateLadder } from "./topics/ladder";
```

Then, in `buildBank`, immediately **after** the two topic-11 snapback `groups.push(...)` lines and **before** `return assembleBank(seed, groups);`, add:

```ts
  // Topic 8 — ladder: appended LAST so the RNG draws for every existing topic (and
  // hence their committed puzzles) are unchanged; only 40 new puzzles are added.
  groups.push(curateRung(generateLadder(rng, { rung: 1, size: 7, count: PER_RUNG, requireFailingAlt: false })));
  groups.push(curateRung(generateLadder(rng, { rung: 2, size: 9, count: PER_RUNG, requireFailingAlt: true })));
```

- [ ] **Step 4: Regenerate the bank**

Run: `npm run generate`
Expected: `Wrote 400 puzzles to .../src/bank/bank.json`.

- [ ] **Step 5: Confirm the diff is append-only (existing 360 unchanged)**

Run: `git diff src/bank/bank.json | grep -c '^-'`
Expected: a very small number (only the trailing `}` → `},` at the old array end flips). Then:
Run: `git diff src/bank/bank.json | grep -c '"topic": 8'`
Expected: `40`.

- [ ] **Step 6: Update the app-model topic list**

In `src/app/model/bank.test.ts`, update the topics assertion:

```ts
    expect(pb.topics()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 10, 11]);
```

- [ ] **Step 7: Run the bank + model suites to verify they pass**

Run: `npx vitest run src/bank/bank.test.ts src/app/model/bank.test.ts`
Expected: PASS — 400 puzzles, topic-8 block green, topics list includes 8.

- [ ] **Step 8: Commit**

```bash
git add src/generator/cli.ts src/bank/bank.json src/bank/bank.test.ts src/app/model/bank.test.ts
git commit -m "feat(bank): add topic 8 (ladder), regenerate to 400, verify payoffs"
```

---

## Task 3: Topic 8 concept lesson + map title

**Files:**
- Modify: `src/app/content/lessons.ts`
- Modify: `src/app/content/lessons.verify.test.ts`
- Modify: `src/app/ui/MapScreen.tsx`

**Interfaces:**
- Consumes: 5a's `LessonDiagram.payoff` field and the payoff-reveal path already in `LessonScreen`.

- [ ] **Step 1: Write the failing lesson-verify test + topic-list update**

In `src/app/content/lessons.verify.test.ts`:

(a) Update the coverage assertion (currently 9 topics):

```ts
  it("covers exactly the 10 current topics, each with title and body", () => {
    expect(LESSONS.map((l) => l.topic)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 10, 11]);
    for (const l of LESSONS) {
      expect(l.title.length).toBeGreaterThan(0);
      expect(l.body.length).toBeGreaterThanOrEqual(2);
      expect(l.diagram.caption.length).toBeGreaterThan(0);
    }
  });
```

(b) Append a T8 verification (the file already imports `Board`, `play`, `boardOf`, `lessonFor`, `marked`, `key`):

```ts
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/app/content/lessons.verify.test.ts`
Expected: FAIL — `lessonFor(8)` is undefined; the topics list doesn't include 8.

- [ ] **Step 3: Add the topic-8 lesson (verified payoff literal)**

In `src/app/content/lessons.ts`, insert this object into the `LESSONS` array **between the topic-7 entry and the topic-10 entry** (so `LESSONS.map(l => l.topic)` is `[…,7,8,10,11]`). The `payoff` was extracted with the real reader/engine and replays to a 4-stone capture:

```ts
  {
    topic: 8,
    title: "The ladder (shicho)",
    body: [
      "A ladder catches a running stone that can never quite get away.",
      "You keep it in atari — one liberty — and it flees in a zig-zag. Each time it runs, you atari again, herding it toward the edge.",
      "The marked white stone can't escape: chased into the corner, it finally runs out of room and is captured.",
    ],
    diagram: {
      size: 7,
      stones: [b(1, 1), b(1, 2), w(2, 2), b(2, 3)],
      marks: [{ x: 2, y: 2, kind: "mark" }],
      keyMove: [{ x: 3, y: 2 }],
      payoff: [
        { x: 3, y: 2, c: "b" },
        { x: 2, y: 1, c: "w" },
        { x: 3, y: 1, c: "b" },
        { x: 2, y: 0, c: "w" },
        { x: 3, y: 0, c: "b" },
        { x: 1, y: 0, c: "w" },
        { x: 0, y: 0, c: "b", captures: [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 1 }, { x: 2, y: 2 }] },
      ],
      caption: "Keep it in atari and chase it to the corner.",
    },
  },
```

- [ ] **Step 4: Run the verify test to confirm the lesson line is engine-true**

Run: `npx vitest run src/app/content/lessons.verify.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the map title**

In `src/app/ui/MapScreen.tsx`, add topic 8 to `TOPIC_TITLES` (keep it between 7 and 10):

```ts
export const TOPIC_TITLES: Record<number, string> = {
  1: "Liberties", 2: "Capture a stone", 3: "Capture a group",
  4: "Escape atari", 5: "Don't self-atari", 6: "Double atari",
  7: "Connect & cut", 8: "Ladder", 10: "Net", 11: "Snapback",
};
```

- [ ] **Step 6: Run the lesson + map tests**

Run: `npx vitest run src/app/content/lessons.verify.test.ts src/app/ui/MapScreen.test.tsx`
Expected: PASS. (If `MapScreen.test.tsx` asserts an exact topic-title set, extend it to include Ladder; the existing tests should otherwise be unaffected.)

- [ ] **Step 7: Commit**

```bash
git add src/app/content/lessons.ts src/app/content/lessons.verify.test.ts src/app/ui/MapScreen.tsx
git commit -m "feat(app): topic 8 (ladder) animated concept lesson + map title"
```

---

## Task 4: Full verification + tracker update

**Files:**
- Modify: `PLAN.md`

- [ ] **Step 1: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 2: Full test suite**

Run: `npm test`
Expected: all green; the bank suite reports 400 puzzles and the new topic-8 blocks pass.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: succeeds (tsc + vite build + PWA precache of the 400-puzzle bank).

- [ ] **Step 4: Update the roadmap tracker**

In `PLAN.md`, in the Tracker table, replace the row

```markdown
| 5b | Ladder (8) + Ladder-breaker (9) generators | 🔜 | reuse the capture-reader; bank → ~480 |
```

with:

```markdown
| 5b.1 | Ladder (8) — pick-the-start + animated payoff | ✅ | reuses 5a payoff; bank → 400 |
| 5b.2 | Ladder-breaker (9) generator | 🔜 | recognise a failing ladder; bank → ~420 |
```

And update the Phase 5 status note to record 5b.1 shipped. Also, in the Curriculum table near the top, change the topic-8/9 "intentionally gapped" note to reflect that topic 8 now ships (ladder), with topic 9 (ladder-breaker) still pending.

- [ ] **Step 5: Commit**

```bash
git add PLAN.md
git commit -m "docs: mark Phase 5b.1 (ladder) shipped; 5b.2 (ladder-breaker) next"
```

---

## Self-Review

**Spec coverage:**
- §2 no type changes; topic-8 puzzle shape (M, single-point opening-atari solution, full payoff, mark) → Task 1. ✅
- §3 generator (unique opening, rung ramp 7×7 / 9×9 + failing alt, ≥2 black moves, deterministic, fail-loud) → Task 1. ✅
- §3 determinism / append-at-end bank integrity → Task 2 (Steps 3, 5). ✅
- §4 grading unchanged (`checkAnswer` handles M single-point) → no code; asserted implicitly by reuse. ✅
- §5 no PlayerScreen change (reuse 5a) → confirmed by "no app runtime logic changes" constraint; topic 8 carries a payoff so the 5a path renders it. ✅
- §5 animated concept lesson → Task 3. ✅
- §6 progression reuse + bank 360→400 + map title → Tasks 2, 3. ✅
- §7 testing (generator invariants, bank solvability incl. unique-opening + failing-alt, lesson verify) → Tasks 1, 2, 3. ✅

**Placeholder scan:** none — every step has concrete code/commands; the lesson payoff is the engine-extracted literal.

**Type consistency:** `generateLadder(rng, {rung,size,count,requireFailingAlt})` and `winningOpenings(board,t)` defined in Task 1 and consumed identically in Task 2 (cli) and the tests; `payoff`/`DemoMove` and `solution.points` reuse 5a's committed types (no redefinition). Bank counts (400) consistent across Task 2's shape test and Task 4's expectations. Consistent.
