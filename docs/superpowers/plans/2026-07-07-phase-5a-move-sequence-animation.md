# Phase 5a — Move-sequence primitive + animated payoff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nets and snapbacks (puzzles and lessons) reveal their payoff by playing the capture out move-by-move, driven by a pre-computed, engine-verified move-sequence attached to the puzzle.

**Architecture:** A build-time extractor emits the capture line (net = "White resists longest, still caught"; snapback = the 3-ply recapture), replayed through the real rules engine so every removed-stone list is engine-truth. The line is stored on the puzzle/lesson as `payoff: DemoMove[]`. At runtime a pure fold reconstructs the position at any step, a React hook auto-plays it once (reduced-motion snaps to the end), and a `PayoffBoard` renders it with a Replay button. The rules engine never ships; the client only places/removes what the data says.

**Tech Stack:** TypeScript (ESM), React 18 + `useSyncExternalStore` MVVM, Vitest + jsdom + @testing-library/react, seeded generator CLI (`tsx`).

## Global Constraints

- **Engine never ships to the client.** No import of `src/engine/*` or `src/generator/*` from `src/app/model` or `src/app/ui` runtime code. Payoff replay in the app is a pure data fold.
- **Model/VM layers stay framework- and engine-free.** `src/app/model/*` imports neither React nor the engine.
- **Everything verified.** No payoff line ships on trust — every one is replayed through `play()` in a permanent test (bank solvability suite / lessons verify suite).
- **Deterministic content.** `npm run generate` reproduces `bank.json` byte-for-byte from the seed. 5a adds `payoff` fields only — **the bank stays 360 puzzles, 20 per topic-rung**; no puzzles added or removed.
- **The two `types.ts` copies stay mirrored** (`src/generator/types.ts` and `src/app/model/types.ts`) — any change to one is made to the other.
- **Prompts unchanged.** No copy changes to puzzle prompts in 5a.
- **`PlayerViewModel` is untouched.** Payoff is static data; animation is a view concern.
- Run the full suite with `npm test`; typecheck with `npm run typecheck`; build with `npm run build`.

---

## File Structure

**Create:**
- `src/generator/payoff.ts` — `PlayedMove` type + `annotate()` (replay a move line through the engine, recording captures). Build-time.
- `src/generator/payoff.test.ts` — unit tests for `annotate`.
- `src/app/model/sequence.ts` — pure fold: `applyDemoMove`, `positionAt`. Engine-free.
- `src/app/model/sequence.test.ts` — unit tests for the fold.
- `src/app/ui/useSequencePlayer.ts` — the timed animation hook.
- `src/app/ui/useSequencePlayer.test.ts` — fake-timer hook tests.
- `src/app/ui/PayoffBoard.tsx` — animated board + Replay button.
- `src/app/ui/PayoffBoard.test.tsx` — render/animation test.

**Modify:**
- `src/generator/types.ts` — add `DemoMove` + `payoff?` on `Puzzle`.
- `src/app/model/types.ts` — mirror `DemoMove` + `payoff?`.
- `src/generator/reader.ts` — add `captureLine` (net PV extractor).
- `src/generator/reader.test.ts` — tests for `captureLine`.
- `src/generator/topics/snapback.ts` — add `snapbackLine`; attach payoff in `generateSnapback`.
- `src/generator/topics/snapback.test.ts` — test `snapbackLine`.
- `src/generator/topics/net.ts` — attach payoff in `generateNet`.
- `src/generator/topics/net.test.ts` — assert generated nets carry a capturing payoff.
- `src/bank/bank.json` — regenerated (payoff added to 80 net/snapback puzzles).
- `src/bank/bank.test.ts` — payoff verification blocks for topics 10 and 11.
- `src/app/ui/Board.tsx` — optional `stones` override prop.
- `src/app/ui/Board.test.tsx` — override render test.
- `src/app/ui/PlayerScreen.tsx` — use `PayoffBoard` when resolved and payoff present.
- `src/app/ui/PlayerScreen.test.tsx` — payoff-reveal test.
- `src/app/content/lessons.ts` — `payoff?` on `LessonDiagram`; payoff literals for net + snapback lessons.
- `src/app/content/lessons.verify.test.ts` — verify the two lesson payoff lines.
- `src/app/styles.css` — payoff container + Replay button + stone fade.
- `PLAN.md` — tracker: 5a done, 5b remains.

---

## Task 1: Move-sequence types + `annotate`

**Files:**
- Modify: `src/generator/types.ts`
- Modify: `src/app/model/types.ts`
- Create: `src/generator/payoff.ts`
- Test: `src/generator/payoff.test.ts`

**Interfaces:**
- Produces: `DemoMove` (`{ x: number; y: number; c: Color; captures?: Point[] }`) on both `types.ts`; `Puzzle.payoff?: DemoMove[]`; `PlayedMove` (`{ x: number; y: number; c: Color }`) and `annotate(size: number, stones: Stone[], moves: PlayedMove[]): DemoMove[]` in `payoff.ts`.

- [ ] **Step 1: Add `DemoMove` + `payoff?` to the generator types**

In `src/generator/types.ts`, after the `SolutionSpec` type add:

```ts
export interface DemoMove { x: number; y: number; c: Color; captures?: Point[]; }
```

and add one field to the `Puzzle` interface (after `marks?`):

```ts
  payoff?: DemoMove[];
```

(`Color` and `Point` are already imported at the top of the file.)

- [ ] **Step 2: Mirror it in the app model types**

In `src/app/model/types.ts`, after the `Solution` type add:

```ts
export interface DemoMove { x: number; y: number; c: Color; captures?: Pt[]; }
```

and add to the `Puzzle` interface (after `marks?`):

```ts
  payoff?: DemoMove[];
```

(`Color` and `Pt` are already defined in this file.)

- [ ] **Step 3: Write the failing test for `annotate`**

Create `src/generator/payoff.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { annotate, type PlayedMove } from "./payoff";
import type { Stone } from "../engine/board";

describe("annotate", () => {
  it("records the stones each move removes by replaying through the engine", () => {
    // A 1-liberty white stone; Black fills the last liberty and captures it.
    const stones: Stone[] = [
      { x: 2, y: 2, c: "w" }, { x: 1, y: 2, c: "b" }, { x: 3, y: 2, c: "b" }, { x: 2, y: 1, c: "b" },
    ];
    const moves: PlayedMove[] = [{ x: 2, y: 3, c: "b" }];
    expect(annotate(5, stones, moves)).toEqual([
      { x: 2, y: 3, c: "b", captures: [{ x: 2, y: 2 }] },
    ]);
  });

  it("omits `captures` for a move that removes nothing", () => {
    const moves: PlayedMove[] = [{ x: 0, y: 0, c: "b" }];
    expect(annotate(5, [], moves)).toEqual([{ x: 0, y: 0, c: "b" }]);
  });

  it("throws on an illegal move", () => {
    const moves: PlayedMove[] = [{ x: 0, y: 0, c: "b" }, { x: 0, y: 0, c: "w" }];
    expect(() => annotate(5, [], moves)).toThrow(/illegal/);
  });
});
```

- [ ] **Step 4: Run it to verify it fails**

Run: `npx vitest run src/generator/payoff.test.ts`
Expected: FAIL — `Failed to resolve import "./payoff"`.

- [ ] **Step 5: Implement `payoff.ts`**

Create `src/generator/payoff.ts`:

```ts
import { Board, Stone, Color } from "../engine/board";
import { play } from "../engine/rules";
import type { DemoMove } from "./types";

export interface PlayedMove { x: number; y: number; c: Color; }

// Replay a move line from an initial position through the real rules engine,
// recording the stones each move removes. Build-time only — this is how a payoff
// line's `captures` become engine-truth rather than hand-counted.
export function annotate(size: number, stones: Stone[], moves: PlayedMove[]): DemoMove[] {
  let board = Board.from(size, stones);
  const out: DemoMove[] = [];
  for (const m of moves) {
    const res = play(board, m.x, m.y, m.c);
    if (!res.ok) throw new Error(`payoff move illegal at (${m.x},${m.y}) ${m.c}: ${res.reason}`);
    const dm: DemoMove = { x: m.x, y: m.y, c: m.c };
    if (res.captured.length) dm.captures = res.captured.map((p) => ({ x: p.x, y: p.y }));
    out.push(dm);
    board = res.board;
  }
  return out;
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/generator/payoff.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add src/generator/types.ts src/app/model/types.ts src/generator/payoff.ts src/generator/payoff.test.ts
git commit -m "feat(generator): move-sequence types + annotate() payoff builder"
```

---

## Task 2: `captureLine` — the net capture PV extractor

**Files:**
- Modify: `src/generator/reader.ts`
- Test: `src/generator/reader.test.ts`

**Interfaces:**
- Consumes: `PlayedMove` from `./payoff`; existing `ESCAPE_LIBS`, `defenderCaptureMoves` in `reader.ts`.
- Produces: `captureLine(board: Board, target: Point, toMove: Color, depth: number): PlayedMove[] | null`.

- [ ] **Step 1: Write the failing test**

Append to `src/generator/reader.test.ts` a new describe block (add the import at the top of the file: `import { captureLine } from "./reader";` — extend the existing import line to `import { capturedUnderBestPlay, captureLine } from "./reader";`):

```ts
describe("captureLine", () => {
  it("returns the capture line for a working edge-ladder, ending in the target's removal", () => {
    const b = Board.from(5, [{ x: 0, y: 2, c: "w" }, { x: 1, y: 2, c: "b" }]);
    const line = captureLine(b, { x: 0, y: 2 }, "b", 8);
    expect(line).not.toBeNull();
    // replay it; the target (0,2) must be gone at the end
    let board = b;
    for (const m of line!) {
      const r = play(board, m.x, m.y, m.c);
      expect(r.ok).toBe(true);
      board = r.board;
    }
    expect(board.get(0, 2)).toBeNull();
    // attacker moves first, colors alternate
    expect(line![0]!.c).toBe("b");
  });

  it("returns null when the stone runs free to 3+ liberties", () => {
    const b = Board.from(5, [{ x: 2, y: 2, c: "w" }, { x: 1, y: 2, c: "b" }, { x: 3, y: 2, c: "b" }]);
    expect(captureLine(b, { x: 2, y: 2 }, "b", 8)).toBeNull();
  });
});
```

(`play` is already imported in `reader.test.ts`? It is not — add `import { play } from "../engine/rules";` at the top if absent.)

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/generator/reader.test.ts`
Expected: FAIL — `captureLine is not a function` / no exported member.

- [ ] **Step 3: Implement `captureLine`**

At the top of `src/generator/reader.ts` add the import:

```ts
import type { PlayedMove } from "./payoff";
```

Append at the end of `src/generator/reader.ts`:

```ts
// Build-time. The principal variation that demonstrates the target's capture:
// attacker (Black) plays the shortest capturing line; defender (White) resists
// longest. Mirrors capturedUnderBestPlay's move model exactly, so a verified net
// always yields a non-null line. Returns null if the target is not captured within depth.
export function captureLine(board: Board, target: Point, toMove: Color, depth: number): PlayedMove[] | null {
  const g = group(board, target.x, target.y);
  if (g.stones.length === 0) return [];              // already captured
  if (g.liberties.length >= ESCAPE_LIBS) return null; // ran free
  if (depth <= 0) return null;

  if (toMove === "b") {
    // attacker: choose a capturing move, preferring the shortest resulting line
    let best: PlayedMove[] | null = null;
    for (const m of g.liberties) {
      const res = play(board, m.x, m.y, "b");
      if (!res.ok) continue;
      const tail = captureLine(res.board, target, "w", depth - 1);
      if (tail === null) continue;
      const line: PlayedMove[] = [{ x: m.x, y: m.y, c: "b" }, ...tail];
      if (best === null || line.length < best.length) best = line;
    }
    return best;
  }

  // defender (white): captured only if EVERY reply is still caught; show the most stubborn one
  const moves = [...g.liberties, ...defenderCaptureMoves(board, g.stones)];
  let longest: PlayedMove[] | null = null;
  let anyMove = false;
  for (const m of moves) {
    const res = play(board, m.x, m.y, "w");
    if (!res.ok) continue;
    anyMove = true;
    const tail = captureLine(res.board, target, "b", depth - 1);
    if (tail === null) return null; // white escapes this way -> not a forced capture
    const line: PlayedMove[] = [{ x: m.x, y: m.y, c: "w" }, ...tail];
    if (longest === null || line.length > longest.length) longest = line;
  }
  if (!anyMove) return []; // no legal defender move -> captured in place
  return longest;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/generator/reader.test.ts`
Expected: PASS (all existing tests + the 2 new ones).

- [ ] **Step 5: Commit**

```bash
git add src/generator/reader.ts src/generator/reader.test.ts
git commit -m "feat(generator): captureLine — net capture principal variation extractor"
```

---

## Task 3: `snapbackLine` — the snapback recapture line

**Files:**
- Modify: `src/generator/topics/snapback.ts`
- Test: `src/generator/topics/snapback.test.ts`

**Interfaces:**
- Produces: `snapbackLine(board: Board, p: Point): PlayedMove[] | null`.

- [ ] **Step 1: Write the failing test**

Append to `src/generator/topics/snapback.test.ts` (add `import { snapbackLine } from "./snapback";` — merge with the existing snapback import; ensure `Board` and `play` are imported in that test file, adding imports if absent):

```ts
describe("snapbackLine", () => {
  it("returns the 3-ply throw-in / capture / recapture line for a working snapback", () => {
    // The topic-11 lesson shape.
    const stones = [
      { x: 5, y: 3, c: "b" as const }, { x: 4, y: 4, c: "b" as const }, { x: 5, y: 4, c: "w" as const },
      { x: 6, y: 4, c: "b" as const }, { x: 4, y: 5, c: "b" as const }, { x: 5, y: 5, c: "w" as const },
      { x: 4, y: 6, c: "b" as const }, { x: 5, y: 6, c: "w" as const },
    ];
    const line = snapbackLine(Board.from(7, stones), { x: 6, y: 6 });
    expect(line).toEqual([
      { x: 6, y: 6, c: "b" },
      { x: 6, y: 5, c: "w" },
      { x: 6, y: 6, c: "b" },
    ]);
  });

  it("returns null for a point that does not snap back", () => {
    const stones = [{ x: 2, y: 2, c: "w" as const }];
    expect(snapbackLine(Board.from(5, stones), { x: 0, y: 0 })).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/generator/topics/snapback.test.ts`
Expected: FAIL — `snapbackLine is not a function`.

- [ ] **Step 3: Implement `snapbackLine`**

At the top of `src/generator/topics/snapback.ts` add:

```ts
import { annotate, type PlayedMove } from "../payoff";
```

Add this function after `snapbackWorks` (it repeats the same replay, returning the moves):

```ts
// The concrete 3-ply snapback line: Black throws in at p, White captures it by
// filling the last liberty, Black replays p to snap the now-short White group off.
export function snapbackLine(board: Board, p: Point): PlayedMove[] | null {
  const r1 = play(board, p.x, p.y, "b");
  if (!r1.ok || r1.captured.length > 0) return null;
  const g = group(r1.board, p.x, p.y);
  if (g.liberties.length !== 1) return null;
  const lib = g.liberties[0]!;
  const r2 = play(r1.board, lib.x, lib.y, "w");
  if (!r2.ok || r2.captured.length !== g.stones.length) return null;
  const r3 = play(r2.board, p.x, p.y, "b");
  if (!r3.ok || r3.captured.length < 1) return null;
  return [{ x: p.x, y: p.y, c: "b" }, { x: lib.x, y: lib.y, c: "w" }, { x: p.x, y: p.y, c: "b" }];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/generator/topics/snapback.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/generator/topics/snapback.ts src/generator/topics/snapback.test.ts
git commit -m "feat(generator): snapbackLine — concrete 3-ply recapture line"
```

---

## Task 4: Attach payoff to generated snapback puzzles

**Files:**
- Modify: `src/generator/topics/snapback.ts`
- Test: `src/generator/topics/snapback.test.ts`

**Interfaces:**
- Consumes: `snapbackLine`, `annotate`.
- Produces: every puzzle from `generateSnapback` has `payoff: DemoMove[]` built from the canonical (first) throw-in.

- [ ] **Step 1: Write the failing test**

Append to `src/generator/topics/snapback.test.ts` (ensure `makeRng` is imported — `import { makeRng } from "../../engine/rng";` — and `generateSnapback`, `play`, `Board`):

```ts
describe("generateSnapback payoff", () => {
  it("every generated puzzle carries a payoff whose final move recaptures >= min", () => {
    const puzzles = generateSnapback(makeRng(42), { rung: 1, size: 7, count: 5, minRecapture: 2 });
    for (const p of puzzles) {
      expect(p.payoff && p.payoff.length).toBe(3);
      // move 0 is a listed solution point
      if (p.solution.kind !== "move") throw new Error("expected move solution");
      const m0 = p.payoff![0]!;
      expect(p.solution.points.some((q) => q.x === m0.x && q.y === m0.y)).toBe(true);
      // replay to the end; the last move recaptures >= 2
      let board = Board.from(p.size, p.stones);
      let lastCap = 0;
      for (const m of p.payoff!) {
        const r = play(board, m.x, m.y, m.c);
        expect(r.ok).toBe(true);
        lastCap = r.captured.length;
        board = r.board;
      }
      expect(lastCap).toBeGreaterThanOrEqual(2);
    }
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/generator/topics/snapback.test.ts`
Expected: FAIL — `p.payoff` is undefined (`expect(undefined).toBe(3)`).

- [ ] **Step 3: Attach the payoff in `generateSnapback`**

In `src/generator/topics/snapback.ts`, replace the puzzle-construction block

```ts
    const puzzle: Puzzle = {
      id: "tmp", topic: 11, rung, mode: "M", size, stones: board.stones(), toPlay: "b",
      prompt: "Black to play — set up a snapback.",
      solution: { kind: "move", points: throwins },
    };
```

with:

```ts
    const line = snapbackLine(board, throwins[0]!);
    if (!line) continue; // defensive — throwins already passed snapbackWorks
    const puzzle: Puzzle = {
      id: "tmp", topic: 11, rung, mode: "M", size, stones: board.stones(), toPlay: "b",
      prompt: "Black to play — set up a snapback.",
      solution: { kind: "move", points: throwins },
      payoff: annotate(size, board.stones(), line),
    };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/generator/topics/snapback.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/generator/topics/snapback.ts src/generator/topics/snapback.test.ts
git commit -m "feat(generator): attach snapback payoff line to generated puzzles"
```

---

## Task 5: Attach payoff to generated net puzzles

**Files:**
- Modify: `src/generator/topics/net.ts`
- Test: `src/generator/topics/net.test.ts`

**Interfaces:**
- Consumes: `captureLine` from `../reader`, `annotate` + `PlayedMove` from `../payoff`.
- Produces: every puzzle from `generateNet` has `payoff: DemoMove[]` built from the canonical (first) net point, ending in the target's capture.

- [ ] **Step 1: Write the failing test**

Append to `src/generator/topics/net.test.ts` (ensure imports: `import { generateNet } from "./net";`, `import { makeRng } from "../../engine/rng";`, `import { Board } from "../../engine/board";`, `import { play } from "../../engine/rules";` — add any that are absent):

```ts
describe("generateNet payoff", () => {
  it("every generated puzzle carries a payoff that replays to the target's capture", () => {
    const puzzles = generateNet(makeRng(7), { rung: 1, size: 7, count: 5, depth: 4 });
    for (const p of puzzles) {
      expect(p.payoff && p.payoff.length).toBeGreaterThan(0);
      const target = p.marks![0]!; // the netted stone
      if (p.solution.kind !== "move") throw new Error("expected move solution");
      const m0 = p.payoff![0]!;
      expect(p.solution.points.some((q) => q.x === m0.x && q.y === m0.y)).toBe(true);
      let board = Board.from(p.size, p.stones);
      for (const m of p.payoff!) {
        const r = play(board, m.x, m.y, m.c);
        expect(r.ok).toBe(true);
        board = r.board;
      }
      expect(board.get(target.x, target.y)).toBeNull(); // netted stone captured
    }
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/generator/topics/net.test.ts`
Expected: FAIL — `p.payoff` undefined.

- [ ] **Step 3: Attach the payoff in `generateNet`**

In `src/generator/topics/net.ts`, extend the reader import and add the payoff import:

```ts
import { capturedUnderBestPlay, captureLine } from "../reader";
import { annotate, type PlayedMove } from "../payoff";
```

Then replace the puzzle-construction block

```ts
    const puzzle: Puzzle = {
      id: "tmp", topic: 10, rung, mode: "M", size, stones: board.stones(), toPlay: "b",
      prompt: "Black to play — net the stone so it can't run.",
      solution: { kind: "move", points: nets },
      marks: [{ x: t.x, y: t.y, kind: "mark" }],
    };
```

with:

```ts
    // Payoff: demonstrate the capture from the canonical (first) net point,
    // extracted at the bank's verification depth (8).
    const canonical = nets[0]!;
    const afterNet = play(board, canonical.x, canonical.y, "b");
    const tail = afterNet.ok ? captureLine(afterNet.board, t, "w", 8) : null;
    if (!tail) continue; // defensive — a verified net always yields a line
    const line: PlayedMove[] = [{ x: canonical.x, y: canonical.y, c: "b" }, ...tail];
    const puzzle: Puzzle = {
      id: "tmp", topic: 10, rung, mode: "M", size, stones: board.stones(), toPlay: "b",
      prompt: "Black to play — net the stone so it can't run.",
      solution: { kind: "move", points: nets },
      marks: [{ x: t.x, y: t.y, kind: "mark" }],
      payoff: annotate(size, board.stones(), line),
    };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/generator/topics/net.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/generator/topics/net.ts src/generator/topics/net.test.ts
git commit -m "feat(generator): attach net capture payoff line to generated puzzles"
```

---

## Task 6: Regenerate the bank + verify payoff in the solvability suite

**Files:**
- Modify: `src/bank/bank.json` (regenerated)
- Modify: `src/bank/bank.test.ts`

**Interfaces:**
- Consumes: committed `payoff` on every topic-10 and topic-11 puzzle.

- [ ] **Step 1: Add the failing payoff-verification blocks**

Append to `src/bank/bank.test.ts` (the file already imports `Board`, `play`, `norm`, and has `netPuzzles`/`snapPuzzles`):

```ts
describe("bank.json — net payoff captures the target (topic 10)", () => {
  it.each(netPuzzles)("%s: payoff replays legally, captures match the engine, target removed", (_id, p) => {
    expect(p.payoff && p.payoff.length).toBeGreaterThan(0);
    if (p.solution.kind !== "move") return;
    const t = p.marks![0]!;
    const first = p.payoff![0]!;
    expect(p.solution.points.some((q) => q.x === first.x && q.y === first.y)).toBe(true);
    let board = Board.from(p.size, p.stones);
    for (const m of p.payoff!) {
      const res = play(board, m.x, m.y, m.c);
      expect(res.ok).toBe(true);
      expect(norm(res.captured)).toBe(norm(m.captures ?? []));
      board = res.board;
    }
    expect(board.get(t.x, t.y)).toBeNull();
  });
});

describe("bank.json — snapback payoff snaps the group off (topic 11)", () => {
  it.each(snapPuzzles)("%s: payoff replays legally, captures match, final move recaptures >= min", (_id, p) => {
    if (p.solution.kind !== "move") return;
    const min = p.rung === 2 ? 3 : 2;
    expect(p.payoff).toHaveLength(3);
    const first = p.payoff![0]!;
    expect(p.solution.points.some((q) => q.x === first.x && q.y === first.y)).toBe(true);
    let board = Board.from(p.size, p.stones);
    let lastCap = 0;
    for (const m of p.payoff!) {
      const res = play(board, m.x, m.y, m.c);
      expect(res.ok).toBe(true);
      expect(norm(res.captured)).toBe(norm(m.captures ?? []));
      lastCap = res.captured.length;
      board = res.board;
    }
    expect(lastCap).toBeGreaterThanOrEqual(min);
  });
});
```

- [ ] **Step 2: Run it to verify it fails against the current bank**

Run: `npx vitest run src/bank/bank.test.ts`
Expected: FAIL — the committed bank has no `payoff` yet (`expect(undefined)` failures on topic 10/11).

- [ ] **Step 3: Regenerate the bank**

Run: `npm run generate`
Expected: `Wrote 360 puzzles to .../src/bank/bank.json`.

- [ ] **Step 4: Run the full bank suite to verify it passes**

Run: `npx vitest run src/bank/bank.test.ts`
Expected: PASS — including the shape test still reporting 360 puzzles / 20 per topic-rung, and the new payoff blocks.

- [ ] **Step 5: Sanity-check the diff is payoff-only**

Run: `git diff --stat src/bank/bank.json`
Expected: only `src/bank/bank.json` changed. Spot-check with `git diff src/bank/bank.json | grep -c '"payoff"'` → expect `80`.

- [ ] **Step 6: Commit**

```bash
git add src/bank/bank.json src/bank/bank.test.ts
git commit -m "feat(bank): regenerate with net/snapback payoff lines + verify them"
```

---

## Task 7: Pure sequence fold (`applyDemoMove`, `positionAt`)

**Files:**
- Create: `src/app/model/sequence.ts`
- Test: `src/app/model/sequence.test.ts`

**Interfaces:**
- Produces: `applyDemoMove(stones: Stone[], m: DemoMove): Stone[]`, `positionAt(initial: Stone[], payoff: DemoMove[], step: number): Stone[]`. Engine-free (imports only `../model/types`).

- [ ] **Step 1: Write the failing test**

Create `src/app/model/sequence.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { applyDemoMove, positionAt } from "./sequence";
import type { Stone, DemoMove } from "./types";

const initial: Stone[] = [{ x: 0, y: 0, c: "w" }];

describe("applyDemoMove", () => {
  it("adds the placed stone and removes captured stones", () => {
    const m: DemoMove = { x: 0, y: 1, c: "b", captures: [{ x: 0, y: 0 }] };
    expect(applyDemoMove(initial, m)).toEqual([{ x: 0, y: 1, c: "b" }]);
  });

  it("adds the placed stone when nothing is captured", () => {
    const m: DemoMove = { x: 1, y: 0, c: "b" };
    expect(applyDemoMove(initial, m)).toEqual([
      { x: 0, y: 0, c: "w" }, { x: 1, y: 0, c: "b" },
    ]);
  });
});

describe("positionAt", () => {
  const payoff: DemoMove[] = [
    { x: 1, y: 0, c: "b" },
    { x: 0, y: 1, c: "b", captures: [{ x: 0, y: 0 }] },
  ];
  it("step 0 is the initial position", () => {
    expect(positionAt(initial, payoff, 0)).toEqual(initial);
  });
  it("folds up to `step` moves", () => {
    expect(positionAt(initial, payoff, 1)).toEqual([
      { x: 0, y: 0, c: "w" }, { x: 1, y: 0, c: "b" },
    ]);
    expect(positionAt(initial, payoff, 2)).toEqual([
      { x: 1, y: 0, c: "b" }, { x: 0, y: 1, c: "b" },
    ]);
  });
  it("clamps step to the payoff length", () => {
    expect(positionAt(initial, payoff, 99)).toEqual(positionAt(initial, payoff, 2));
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/app/model/sequence.test.ts`
Expected: FAIL — `Failed to resolve import "./sequence"`.

- [ ] **Step 3: Implement `sequence.ts`**

Create `src/app/model/sequence.ts`:

```ts
import type { Stone, DemoMove } from "./types";

// Pure, engine-free replay of a payoff line for rendering. Placing a stone drops
// any stones the move captured, then adds the played stone.
export function applyDemoMove(stones: Stone[], m: DemoMove): Stone[] {
  const removed = new Set((m.captures ?? []).map((c) => `${c.x},${c.y}`));
  const kept = stones.filter((s) => !removed.has(`${s.x},${s.y}`));
  return [...kept, { x: m.x, y: m.y, c: m.c }];
}

// The board position after the first `step` moves of the payoff (clamped).
export function positionAt(initial: Stone[], payoff: DemoMove[], step: number): Stone[] {
  let stones = initial;
  const n = Math.min(step, payoff.length);
  for (let i = 0; i < n; i++) stones = applyDemoMove(stones, payoff[i]!);
  return stones;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/app/model/sequence.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/model/sequence.ts src/app/model/sequence.test.ts
git commit -m "feat(app): pure engine-free payoff fold (applyDemoMove, positionAt)"
```

---

## Task 8: `useSequencePlayer` hook

**Files:**
- Create: `src/app/ui/useSequencePlayer.ts`
- Test: `src/app/ui/useSequencePlayer.test.ts`

**Interfaces:**
- Consumes: `positionAt` from `../model/sequence`.
- Produces: `useSequencePlayer(initial: Stone[], payoff: DemoMove[], stepMs?: number): { stones: Stone[]; playing: boolean; done: boolean; replay: () => void }`.

- [ ] **Step 1: Write the failing test**

Create `src/app/ui/useSequencePlayer.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSequencePlayer } from "./useSequencePlayer";
import type { Stone, DemoMove } from "../model/types";

const initial: Stone[] = [{ x: 0, y: 0, c: "w" }];
const payoff: DemoMove[] = [
  { x: 1, y: 0, c: "b" },
  { x: 0, y: 1, c: "b", captures: [{ x: 0, y: 0 }] },
];

describe("useSequencePlayer", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("auto-advances one move per tick and applies captures", () => {
    const { result } = renderHook(() => useSequencePlayer(initial, payoff, 100));
    expect(result.current.stones).toHaveLength(1);
    expect(result.current.playing).toBe(true);
    act(() => { vi.advanceTimersByTime(100); });
    expect(result.current.stones).toHaveLength(2);
    act(() => { vi.advanceTimersByTime(100); });
    expect(result.current.stones).toHaveLength(2);
    expect(result.current.stones.every((s) => s.c === "b")).toBe(true);
    expect(result.current.done).toBe(true);
    expect(result.current.playing).toBe(false);
  });

  it("replay restarts from the initial position", () => {
    const { result } = renderHook(() => useSequencePlayer(initial, payoff, 100));
    act(() => { vi.advanceTimersByTime(200); });
    expect(result.current.done).toBe(true);
    act(() => { result.current.replay(); });
    expect(result.current.stones).toHaveLength(1);
    expect(result.current.playing).toBe(true);
  });

  it("jumps to the final position under reduced motion", () => {
    (window as unknown as { matchMedia: unknown }).matchMedia = vi.fn().mockReturnValue({ matches: true });
    try {
      const { result } = renderHook(() => useSequencePlayer(initial, payoff, 100));
      expect(result.current.done).toBe(true);
      expect(result.current.stones.every((s) => s.c === "b")).toBe(true);
    } finally {
      delete (window as unknown as { matchMedia?: unknown }).matchMedia;
    }
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/app/ui/useSequencePlayer.test.ts`
Expected: FAIL — `Failed to resolve import "./useSequencePlayer"`.

- [ ] **Step 3: Implement the hook**

Create `src/app/ui/useSequencePlayer.ts`:

```ts
import { useState, useEffect, useMemo, useRef } from "react";
import type { Stone, DemoMove } from "../model/types";
import { positionAt } from "../model/sequence";

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export interface SequencePlayer {
  stones: Stone[];
  playing: boolean;
  done: boolean;
  replay: () => void;
}

// Auto-plays a payoff line once on mount, one move every `stepMs`. Under
// prefers-reduced-motion it starts (and replays) at the final position.
export function useSequencePlayer(initial: Stone[], payoff: DemoMove[], stepMs = 450): SequencePlayer {
  const reduced = useRef(prefersReducedMotion()).current;
  const end = payoff.length;
  const [step, setStep] = useState(reduced ? end : 0);

  useEffect(() => {
    if (reduced || step >= end) return;
    const id = setTimeout(() => setStep((s) => s + 1), stepMs);
    return () => clearTimeout(id);
  }, [step, end, reduced, stepMs]);

  const stones = useMemo(() => positionAt(initial, payoff, step), [initial, payoff, step]);
  const replay = () => setStep(reduced ? end : 0);
  return { stones, playing: step < end, done: step >= end, replay };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/app/ui/useSequencePlayer.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/ui/useSequencePlayer.ts src/app/ui/useSequencePlayer.test.ts
git commit -m "feat(app): useSequencePlayer — timed payoff animation hook"
```

---

## Task 9: `Board` stones override

**Files:**
- Modify: `src/app/ui/Board.tsx`
- Test: `src/app/ui/Board.test.tsx`

**Interfaces:**
- Produces: `Board` accepts optional `stones?: Stone[]`; when set it renders those stones (and computes tap occupancy from them) instead of `puzzle.stones`.

- [ ] **Step 1: Write the failing test**

Append to `src/app/ui/Board.test.tsx`:

```ts
  it("renders the override stones instead of the puzzle stones when `stones` is set", () => {
    const override = [
      { x: 0, y: 0, c: "b" as const },
      { x: 1, y: 1, c: "w" as const },
    ];
    const { container } = render(<Board puzzle={capture} stones={override} />);
    expect(container.querySelectorAll("circle.stone").length).toBe(2);
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/app/ui/Board.test.tsx`
Expected: FAIL — renders 4 stones (the puzzle's), not 2. (TypeScript will also flag the unknown `stones` prop.)

- [ ] **Step 3: Add the override prop**

In `src/app/ui/Board.tsx`, extend the imports and props:

```ts
import type { Puzzle, Pt, Stone } from "../model/types";

export interface BoardProps {
  puzzle: Puzzle;
  reveal?: boolean;
  onTapPoint?: (p: Pt) => void;
  stones?: Stone[];
}
```

Change the destructuring + stones source at the top of the component:

```ts
export function Board({ puzzle, reveal, onTapPoint, stones: override }: BoardProps) {
  const { size } = puzzle;
  const stones = override ?? puzzle.stones;
```

(The rest of the component already references the local `stones`, so no further change is needed.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/app/ui/Board.test.tsx`
Expected: PASS (all existing + the new override test).

- [ ] **Step 5: Commit**

```bash
git add src/app/ui/Board.tsx src/app/ui/Board.test.tsx
git commit -m "feat(app): Board accepts an optional stones override for animation"
```

---

## Task 10: `PayoffBoard` component + styles

**Files:**
- Create: `src/app/ui/PayoffBoard.tsx`
- Test: `src/app/ui/PayoffBoard.test.tsx`
- Modify: `src/app/styles.css`

**Interfaces:**
- Consumes: `useSequencePlayer`, `Board`.
- Produces: `PayoffBoard({ puzzle: Puzzle; payoff: DemoMove[] })` — renders the animated board + a Replay button (disabled while playing).

- [ ] **Step 1: Write the failing test**

Create `src/app/ui/PayoffBoard.test.tsx`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { PayoffBoard } from "./PayoffBoard";
import type { Puzzle, DemoMove } from "../model/types";

const puzzle: Puzzle = {
  id: "x", topic: 10, rung: 1, mode: "M", size: 5, toPlay: "b", prompt: "",
  stones: [
    { x: 2, y: 2, c: "w" }, { x: 1, y: 2, c: "b" }, { x: 3, y: 2, c: "b" }, { x: 2, y: 1, c: "b" },
  ],
  solution: { kind: "move", points: [{ x: 2, y: 3 }] },
};
const payoff: DemoMove[] = [{ x: 2, y: 3, c: "b", captures: [{ x: 2, y: 2 }] }];

describe("PayoffBoard", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("plays the line to the final position and offers Replay", () => {
    const { container } = render(<PayoffBoard puzzle={puzzle} payoff={payoff} />);
    expect(container.querySelectorAll("circle.stone").length).toBe(4); // initial
    act(() => { vi.advanceTimersByTime(450); });
    const stones = container.querySelectorAll("circle.stone");
    expect(stones.length).toBe(4); // white captured, black played -> still 4, all black
    expect(screen.getByRole("button", { name: /Replay/ })).toBeDefined();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/app/ui/PayoffBoard.test.tsx`
Expected: FAIL — `Failed to resolve import "./PayoffBoard"`.

- [ ] **Step 3: Implement `PayoffBoard`**

Create `src/app/ui/PayoffBoard.tsx`:

```tsx
import type { Puzzle, DemoMove } from "../model/types";
import { Board } from "./Board";
import { useSequencePlayer } from "./useSequencePlayer";

export function PayoffBoard({ puzzle, payoff }: { puzzle: Puzzle; payoff: DemoMove[] }) {
  const { stones, playing, replay } = useSequencePlayer(puzzle.stones, payoff);
  return (
    <div className="payoff">
      <Board puzzle={puzzle} stones={stones} />
      <button className="replay" onClick={replay} disabled={playing} aria-label="Replay the sequence">
        Replay
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/app/ui/PayoffBoard.test.tsx`
Expected: PASS.

- [ ] **Step 5: Add styles**

Append to `src/app/styles.css`:

```css
/* Animated payoff (net / snapback reveal) */
.payoff { display: flex; flex-direction: column; align-items: center; gap: 10px; }
.payoff .replay {
  font: inherit; padding: 8px 18px; border-radius: 999px; cursor: pointer;
  border: 1.5px solid var(--accent); color: var(--accent); background: transparent;
}
.payoff .replay:disabled { opacity: .5; cursor: default; }
.board .stone { transition: opacity .2s ease; }
```

- [ ] **Step 6: Commit**

```bash
git add src/app/ui/PayoffBoard.tsx src/app/ui/PayoffBoard.test.tsx src/app/styles.css
git commit -m "feat(app): PayoffBoard — animated capture reveal with Replay"
```

---

## Task 11: Wire the payoff reveal into PlayerScreen

**Files:**
- Modify: `src/app/ui/PlayerScreen.tsx`
- Test: `src/app/ui/PlayerScreen.test.tsx`

**Interfaces:**
- Consumes: `PayoffBoard`.
- Produces: when the puzzle is resolved (`correct`/`revealed`) and has a `payoff`, PlayerScreen renders `PayoffBoard`; otherwise the existing static `Board` reveal.

- [ ] **Step 1: Write the failing test**

Append to `src/app/ui/PlayerScreen.test.tsx` (the fixtures `mem`, imports for `PuzzleBank`, `ProgressStore`, `PlayerViewModel`, `Bank` are already present):

```ts
  it("a solved puzzle with a payoff shows the animated Replay, not the static reveal", () => {
    vi.useFakeTimers();
    try {
      const netBank: Bank = { seed: 0, stage: "B", puzzles: [{
        id: "n", topic: 10, rung: 1, mode: "M", size: 5, toPlay: "b", prompt: "Net it.",
        stones: [{ x: 2, y: 2, c: "w" }, { x: 1, y: 2, c: "b" }, { x: 3, y: 2, c: "b" }, { x: 2, y: 1, c: "b" }],
        solution: { kind: "move", points: [{ x: 2, y: 3 }] },
        payoff: [{ x: 2, y: 3, c: "b", captures: [{ x: 2, y: 2 }] }],
      }]};
      const pb = new PuzzleBank(netBank);
      const vm = new PlayerViewModel(pb, new ProgressStore(mem(), pb.rungRefs()), 10, 1);
      const { container } = render(<PlayerScreen player={vm} onExit={vi.fn()} />);
      const tap = Array.from(container.querySelectorAll("[data-tap]")).find(
        (t) => t.getAttribute("cx") === "104" && t.getAttribute("cy") === "144",
      );
      fireEvent.click(tap!);
      expect(screen.getByText(/Correct/)).toBeDefined();
      expect(screen.getByRole("button", { name: /Replay/ })).toBeDefined();
    } finally {
      vi.useRealTimers();
    }
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/app/ui/PlayerScreen.test.tsx`
Expected: FAIL — no Replay button (static reveal is rendered).

- [ ] **Step 3: Wire in PayoffBoard**

In `src/app/ui/PlayerScreen.tsx`, add the import:

```ts
import { PayoffBoard } from "./PayoffBoard";
```

Replace the `board-hold` block:

```tsx
      <div className="board-hold">
        <Board
          puzzle={p}
          reveal={resolved}
          onTapPoint={p.mode === "M" && !resolved ? (pt) => submit({ kind: "move", point: pt }) : undefined}
        />
      </div>
```

with:

```tsx
      <div className="board-hold">
        {resolved && p.payoff ? (
          <PayoffBoard puzzle={p} payoff={p.payoff} />
        ) : (
          <Board
            puzzle={p}
            reveal={resolved}
            onTapPoint={p.mode === "M" && !resolved ? (pt) => submit({ kind: "move", point: pt }) : undefined}
          />
        )}
      </div>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/app/ui/PlayerScreen.test.tsx`
Expected: PASS (all existing + the new payoff test).

- [ ] **Step 5: Commit**

```bash
git add src/app/ui/PlayerScreen.tsx src/app/ui/PlayerScreen.test.tsx
git commit -m "feat(app): PlayerScreen plays the payoff on reveal for net/snapback"
```

---

## Task 12: Lesson payoff data + LessonScreen animation

**Files:**
- Modify: `src/app/content/lessons.ts`
- Modify: `src/app/ui/LessonScreen.tsx`
- Test: `src/app/content/lessons.verify.test.ts`

**Interfaces:**
- Consumes: `PayoffBoard`; `DemoMove` type.
- Produces: `LessonDiagram.payoff?: DemoMove[]`; net (topic 10) and snapback (topic 11) lessons carry verified payoff lines; `LessonScreen` animates them.

- [ ] **Step 1: Write the failing test**

Append to `src/app/content/lessons.verify.test.ts` (it already imports `Board`, `play`, `boardOf`, `lessonFor`, `marked`):

```ts
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/app/content/lessons.verify.test.ts`
Expected: FAIL — `l.diagram.payoff` is undefined.

- [ ] **Step 3: Add `payoff?` to the `LessonDiagram` type**

In `src/app/content/lessons.ts`, extend the type import to include `DemoMove`:

```ts
import type { Stone, Mark, Pt, DemoMove } from "../model/types";
```

and add to the `LessonDiagram` interface (after `keyMove?`):

```ts
  /** Pre-computed, engine-verified capture line played on reveal (net/snapback). */
  payoff?: DemoMove[];
```

- [ ] **Step 4: Add the verified payoff literals**

These lines were extracted with the same reader/engine used to verify the bank (net = `captureLine` at depth 8; snapback = `snapbackLine`), then annotated through `play()`.

In the **topic 10** lesson `diagram`, add after `keyMove: [{ x: 6, y: 5 }],`:

```ts
      payoff: [
        { x: 6, y: 5, c: "b" },
        { x: 6, y: 4, c: "w" },
        { x: 5, y: 5, c: "b" },
        { x: 6, y: 3, c: "w" },
        { x: 6, y: 2, c: "b", captures: [{ x: 6, y: 3 }, { x: 6, y: 4 }, { x: 5, y: 4 }] },
      ],
```

In the **topic 11** lesson `diagram`, add after `keyMove: [{ x: 6, y: 6 }],`:

```ts
      payoff: [
        { x: 6, y: 6, c: "b" },
        { x: 6, y: 5, c: "w", captures: [{ x: 6, y: 6 }] },
        { x: 6, y: 6, c: "b", captures: [{ x: 5, y: 6 }, { x: 5, y: 5 }, { x: 5, y: 4 }, { x: 6, y: 5 }] },
      ],
```

- [ ] **Step 5: Run the verify test to confirm the lines are engine-true**

Run: `npx vitest run src/app/content/lessons.verify.test.ts`
Expected: PASS.

- [ ] **Step 6: Animate the payoff in LessonScreen**

In `src/app/ui/LessonScreen.tsx`, add the import:

```ts
import { PayoffBoard } from "./PayoffBoard";
```

Replace the `lesson-board` block:

```tsx
        <div className="lesson-board">
          <Board puzzle={diagramPuzzle(lesson)} reveal={showMove} />
        </div>
```

with:

```tsx
        <div className="lesson-board">
          {lesson.diagram.payoff ? (
            <PayoffBoard puzzle={diagramPuzzle(lesson)} payoff={lesson.diagram.payoff} />
          ) : (
            <Board puzzle={diagramPuzzle(lesson)} reveal={showMove} />
          )}
        </div>
```

- [ ] **Step 7: Run the lesson + screen tests**

Run: `npx vitest run src/app/content/lessons.verify.test.ts src/app/ui/LessonScreen.test.tsx`
Expected: PASS. (If `LessonScreen.test.tsx` asserts on the static net/snapback ghost specifically, update it to accept the animated board; the existing tests use topic 2, which has no payoff, so they should be unaffected.)

- [ ] **Step 8: Commit**

```bash
git add src/app/content/lessons.ts src/app/content/lessons.verify.test.ts src/app/ui/LessonScreen.tsx
git commit -m "feat(app): net/snapback lessons play their verified payoff on reveal"
```

---

## Task 13: Full verification + tracker update

**Files:**
- Modify: `PLAN.md`

- [ ] **Step 1: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 2: Full test suite**

Run: `npm test`
Expected: all green; total count is the prior 485 + the tests added here (payoff, captureLine, snapbackLine, generator payoff, bank payoff, sequence, hook, PayoffBoard, PlayerScreen, Board override, lesson verify).

- [ ] **Step 3: Build (incl. PWA precache of the new bank)**

Run: `npm run build`
Expected: succeeds; `bank.json` (with payoff) is precached.

- [ ] **Step 4: Update the roadmap tracker**

In `PLAN.md`, in the Tracker table, replace the four `| 5 | … | 🔜 | … |` rows with:

```markdown
| 5a | Move-sequence primitive + `annotate` | ✅ | engine-verified `payoff` on Puzzle/Lesson |
| 5a | Animated net/snapback payoff (reveals + lessons) | ✅ | auto-play once + Replay; reduced-motion snaps |
| 5b | Interactive sequence player (you play → engine replies) | 🔜 | reuses the 5a `DemoMove` primitive |
| 5b | Ladder (8) + Ladder-breaker (9) generators | 🔜 | reuse the capture-reader; bank → ~480 |
```

And under the **Phase 5** heading, add a one-line status note:

```markdown
> **5a shipped** — nets/snapbacks reveal their capture move-by-move. **5b** (interactive player + ladders) is the next slice.
```

- [ ] **Step 5: Commit**

```bash
git add PLAN.md
git commit -m "docs: mark Phase 5a shipped; 5b (interactive + ladders) is next"
```

---

## Self-Review

**Spec coverage:**
- §2 data model (`DemoMove`, `payoff?`, both `types.ts`) → Task 1. ✅
- §3.1 snapback line → Task 3; attach → Task 4. ✅
- §3.2 net "longest resistance" extractor → Task 2; attach → Task 5. ✅
- §3.3 bank regeneration + verification → Task 6. ✅
- §4.1 `useSequencePlayer` (auto-play once, reduced-motion, replay) → Task 8, over the pure fold in Task 7. ✅
- §4.2 Board `stones` override → Task 9. ✅
- §5.1 PlayerScreen reveal wiring (VM untouched) → Task 11. ✅
- §5.2 LessonScreen + lesson payoff data → Task 12. ✅
- §6 testing (solvability suite, lessons verify, hook fake-timers, Board/PlayerScreen/LessonScreen renders, extractor units) → Tasks 2,3,6,7,8,9,10,11,12. ✅

**Placeholder scan:** none — every step has concrete code/commands and the two lesson payoff lines are the engine-extracted literals.

**Type consistency:** `DemoMove`/`payoff?` mirrored across both `types.ts` (Task 1); `PlayedMove` defined in `payoff.ts` (Task 1) and consumed by `captureLine` (Task 2), `snapbackLine`/`generateNet` (Tasks 3–5); `useSequencePlayer` signature (Task 8) matches its consumer `PayoffBoard` (Task 10); `Board`'s `stones?` prop (Task 9) matches `PayoffBoard`'s usage; `positionAt` (Task 7) matches the hook (Task 8). Consistent.
