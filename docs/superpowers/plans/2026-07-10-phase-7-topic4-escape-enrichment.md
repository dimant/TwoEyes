# Phase 7 — Topic 4 (Escape atari) enrichment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Topic 4's monotonous lone-stone-extend puzzles with two distinct sub-skills — rung 1 "run to safety" (1–3 stone groups) and rung 2 "capture the attacker to escape" — without changing the bank envelope (still 440 puzzles).

**Architecture:** Add two new construct-and-verify generators to `src/generator/topics/escape.ts` alongside the existing `generateEscape` (which is **frozen** and retained only as an RNG spacer). Wire them into `buildBank` with their own derived seed, generated at the *end* of the build so the shared RNG stream feeding topics 5/6/7/10/11 is untouched and their committed puzzles stay byte-identical.

**Tech Stack:** TypeScript (ESM), Vitest, the project's go engine (`src/engine/`) and generator harness (`src/generator/`). No new dependencies.

## Global Constraints

- **Everything engine-verified** — every generated puzzle is proven solvable by replaying its solution through `src/engine/rules.ts::play`. No shape ships on trust.
- **Deterministic bank** — `npm run generate` must be reproducible; generators consume a seeded `Rng` only.
- **Bank envelope unchanged** — 11 topics × 2 rungs × 20 = **440** puzzles. Topic 4 stays at 20 per rung, mode `M`, size 7.
- **Reproducibility discipline** — topics 5/6/7/10/11's committed puzzles in `src/bank/bank.json` must be byte-for-byte unchanged; only Topic 4's 40 puzzles change.
- **Fail-loud** — a generator throws if it cannot fill its `count`; never ship a short rung.
- **No UI changes** — puzzles remain single-move `M`; the player/board/lesson layers are untouched.

---

## Task 1: Rung-1 generator — `generateEscapeRun` (richer extend shapes, 1–3 stones)

**Files:**
- Modify: `src/generator/topics/escape.ts` (add imports + new exported function; leave existing `generateEscape` untouched)
- Test: `src/generator/topics/escape.test.ts` (add a `describe("generateEscapeRun")` block)

**Interfaces:**
- Consumes: `Board` (`../../engine/board`), `group` (`../../engine/liberties`), `play` (`../../engine/rules`), `Rng, shuffle, randint` (`../../engine/rng`), `Region, growBlob` (`../geometry`), `validateM` and the module-local `escapeGoal` (already defined in `escape.ts`), `Puzzle` (`../types`).
- Produces: `generateEscapeRun(rng: Rng, opts: { rung: number; size: number; count: number; region: Region; maxGroup: number }): Puzzle[]` — each puzzle is a black group of 1..`maxGroup` stones in atari whose only escape is extending at its single liberty (no captures involved). `marks` lists **all** target-group stones; `marks[0]` is the representative used by tests.

- [ ] **Step 1: Write the failing test**

Add to `src/generator/topics/escape.test.ts` (keep the existing `describe("generateEscape")` block as-is):

```typescript
import { generateEscapeRun, generateEscapeCapture } from "./escape";

describe("generateEscapeRun", () => {
  it("target group (1-3 stones) starts in atari; every move escapes by pure extension", () => {
    const puzzles = generateEscapeRun(makeRng(1), { rung: 1, size: 7, count: 20, region: "any", maxGroup: 3 });
    expect(puzzles).toHaveLength(20);
    for (const p of puzzles) {
      expect(p.mode).toBe("M");
      expect(p.marks!.length).toBeGreaterThanOrEqual(1);
      expect(p.marks!.length).toBeLessThanOrEqual(3);
      const rep = p.marks![0]!;
      const before = Board.from(p.size, p.stones);
      // marked stones form one connected black group in atari
      expect(before.get(rep.x, rep.y)).toBe("b");
      expect(group(before, rep.x, rep.y).liberties.length).toBe(1);
      expect(p.solution.kind).toBe("move");
      if (p.solution.kind === "move") {
        expect(p.solution.points.length).toBeGreaterThanOrEqual(1);
        for (const mv of p.solution.points) {
          const r = play(before, mv.x, mv.y, "b");
          expect(r.ok).toBe(true);
          expect(r.captured.length).toBe(0); // pure extension, nothing captured
          expect(group(r.board, rep.x, rep.y).liberties.length).toBeGreaterThanOrEqual(2);
        }
      }
    }
  });

  it("no white attacker is left in atari, and it is deterministic", () => {
    const a = generateEscapeRun(makeRng(7), { rung: 1, size: 7, count: 10, region: "any", maxGroup: 3 });
    for (const p of a) {
      const b = Board.from(p.size, p.stones);
      for (const s of p.stones)
        if (s.c === "w") expect(group(b, s.x, s.y).liberties.length).toBeGreaterThanOrEqual(2);
    }
    expect(a).toEqual(generateEscapeRun(makeRng(7), { rung: 1, size: 7, count: 10, region: "any", maxGroup: 3 }));
  });
});
```

Also update the top-of-file imports in `escape.test.ts` if `play` is not already imported (it is imported already; confirm the line `import { play } from "../../engine/rules";` exists).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/generator/topics/escape.test.ts -t generateEscapeRun`
Expected: FAIL — `generateEscapeRun` is not exported (import error / "is not a function").

- [ ] **Step 3: Update `escape.ts` imports**

Change the import block at the top of `src/generator/topics/escape.ts` to:

```typescript
import { Board, Point } from "../../engine/board";
import { group } from "../../engine/liberties";
import { play } from "../../engine/rules";
import { validateM, GoalFn } from "../validate";
import { Rng, shuffle, randint } from "../../engine/rng";
import { Region, startCell, growBlob } from "../geometry";
import { Puzzle } from "../types";
```

(`startCell` stays — the frozen `generateEscape` still uses it.)

- [ ] **Step 4: Write the `generateEscapeRun` implementation**

Append to `src/generator/topics/escape.ts` (below the existing `generateEscape`):

```typescript
// --- Phase 7 enrichment ------------------------------------------------------
// generateEscape (above) is FROZEN: it is retained only as an RNG spacer in
// buildBank so that topics generated after Topic 4 keep their committed puzzles.
// The two generators below produce the real, enriched Topic 4 content and are
// invoked from buildBank with their own seed.

export function generateEscapeRun(
  rng: Rng,
  opts: { rung: number; size: number; count: number; region: Region; maxGroup: number },
): Puzzle[] {
  const { rung, size, count, region, maxGroup } = opts;
  const out: Puzzle[] = [];
  const seen = new Set<string>();
  let guard = 0;

  while (out.length < count && guard++ < count * 2000) {
    const k = randint(rng, 1, maxGroup);
    const blob = growBlob(rng, size, k, region);
    if (!blob) continue;

    const board = new Board(size);
    for (const p of blob) board.set(p.x, p.y, "b");
    const rep = blob[0]!;

    // Reduce the whole black group to a single liberty (atari): fill all but one
    // of its liberties with white; the point left open is the escape point.
    const libs = group(board, rep.x, rep.y).liberties;
    if (libs.length < 2) continue; // need one to fill and one to leave open
    const shuffled = shuffle(rng, libs);
    for (const p of shuffled.slice(1)) board.set(p.x, p.y, "w");
    if (group(board, rep.x, rep.y).liberties.length !== 1) continue;

    // Pure extension only: every white attacker must be settled (>= 2 liberties),
    // so no black move captures white (capture-to-escape is rung 2's job).
    const whiteSettled = board
      .stones()
      .every((s) => s.c !== "w" || group(board, s.x, s.y).liberties.length >= 2);
    if (!whiteSettled) continue;

    const v = validateM(board, "b", escapeGoal(rep), "any-valid");
    if (!v.valid) continue;

    const marks = blob.map((p) => ({ x: p.x, y: p.y, kind: "mark" as const }));
    const puzzle: Puzzle = {
      id: "tmp", topic: 4, rung, mode: "M", size,
      stones: board.stones(), toPlay: "b",
      prompt: "Black to play — save your group.",
      solution: { kind: "move", points: v.solution },
      marks,
    };

    const sig = JSON.stringify({ s: puzzle.stones, sol: v.solution, m: marks });
    if (seen.has(sig)) continue;
    seen.add(sig);
    out.push(puzzle);
  }

  if (out.length < count) {
    throw new Error(`generateEscapeRun: produced ${out.length}/${count} puzzles (rung ${rung}, size ${size})`);
  }
  return out;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/generator/topics/escape.test.ts -t generateEscapeRun`
Expected: PASS (both `generateEscapeRun` specs). If the first spec throws `produced <20/20`, the generator could not fill on seed 1 — raise the `guard` multiplier or confirm `region`/`maxGroup`; do not lower `count`.

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/generator/topics/escape.ts src/generator/topics/escape.test.ts
git commit -m "feat(generator): Topic 4 rung 1 — escape by extension for 1-3 stone groups

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013CsZD5HwrD78GC6o8uPZ5F"
```

---

## Task 2: Rung-2 generator — `generateEscapeCapture` (capture the attacker to escape)

**Files:**
- Modify: `src/generator/topics/escape.ts` (add two module-local helpers + the exported generator)
- Test: `src/generator/topics/escape.test.ts` (add a `describe("generateEscapeCapture")` block)

**Interfaces:**
- Consumes: everything Task 1 imported, plus the module-local helpers `adjacentWhiteGroups` and `allGroupsAlive` defined in this task.
- Produces: `generateEscapeCapture(rng: Rng, opts: { rung: number; size: number; count: number; region: Region }): Puzzle[]` — each puzzle is a black group (1–2 stones) in atari at liberty **L** where an adjacent white group is in atari at a different point **C**; the solution captures white, and playing **L** (plain extension) does **not** rescue Black. `marks` lists all target-group stones.

- [ ] **Step 1: Write the failing test**

Add to `src/generator/topics/escape.test.ts`:

```typescript
describe("generateEscapeCapture", () => {
  it("target in atari; escape is by capture; plain extension at own liberty fails", () => {
    const puzzles = generateEscapeCapture(makeRng(2), { rung: 2, size: 7, count: 20, region: "any" });
    expect(puzzles).toHaveLength(20);
    for (const p of puzzles) {
      expect(p.mode).toBe("M");
      const rep = p.marks![0]!;
      const before = Board.from(p.size, p.stones);
      const libs = group(before, rep.x, rep.y).liberties;
      expect(libs.length).toBe(1); // target in atari
      const L = libs[0]!;

      // Plain extension at the group's own liberty must NOT rescue it.
      const ext = play(before, L.x, L.y, "b");
      const extEscaped =
        ext.ok && ext.board.get(rep.x, rep.y) === "b" &&
        group(ext.board, rep.x, rep.y).liberties.length >= 2;
      expect(extEscaped).toBe(false);

      expect(p.solution.kind).toBe("move");
      if (p.solution.kind === "move") {
        expect(p.solution.points.length).toBeGreaterThanOrEqual(1);
        for (const mv of p.solution.points) {
          // the escaping move is at a different point than L
          expect(mv.x === L.x && mv.y === L.y).toBe(false);
          const r = play(before, mv.x, mv.y, "b");
          expect(r.ok).toBe(true);
          expect(r.captured.length).toBeGreaterThan(0); // escape is by capture
          expect(group(r.board, rep.x, rep.y).liberties.length).toBeGreaterThanOrEqual(2);
        }
      }
    }
  });

  it("is deterministic", () => {
    const opts = { rung: 2, size: 7, count: 8, region: "any" as const };
    expect(generateEscapeCapture(makeRng(5), opts)).toEqual(generateEscapeCapture(makeRng(5), opts));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/generator/topics/escape.test.ts -t generateEscapeCapture`
Expected: FAIL — `generateEscapeCapture` is not exported.

- [ ] **Step 3: Add the module-local helpers**

Append to `src/generator/topics/escape.ts` (above `generateEscapeCapture`, below `generateEscapeRun`):

```typescript
// Distinct white groups adjacent to any stone of `blob`, one representative
// point per group (deduped by the group's canonical stone set).
function adjacentWhiteGroups(board: Board, blob: Point[]): Point[] {
  const reps: Point[] = [];
  const seen = new Set<string>();
  for (const s of blob) {
    for (const n of board.neighbors(s.x, s.y)) {
      if (board.get(n.x, n.y) !== "w") continue;
      const g = group(board, n.x, n.y);
      const key = g.stones.map((p) => `${p.x},${p.y}`).sort().join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      reps.push({ x: n.x, y: n.y });
    }
  }
  return reps;
}

// A directly-constructed position is legal only if no group already has zero
// liberties. (Atari groups — exactly one liberty — are fine.)
function allGroupsAlive(board: Board): boolean {
  return board.stones().every((s) => group(board, s.x, s.y).liberties.length >= 1);
}
```

- [ ] **Step 4: Write the `generateEscapeCapture` implementation**

Append to `src/generator/topics/escape.ts`:

```typescript
export function generateEscapeCapture(
  rng: Rng,
  opts: { rung: number; size: number; count: number; region: Region },
): Puzzle[] {
  const { rung, size, count, region } = opts;
  const out: Puzzle[] = [];
  const seen = new Set<string>();
  let guard = 0;

  while (out.length < count && guard++ < count * 4000) {
    const k = randint(rng, 1, 2);
    const blob = growBlob(rng, size, k, region);
    if (!blob) continue;

    const board = new Board(size);
    for (const p of blob) board.set(p.x, p.y, "b");
    const rep = blob[0]!;

    // Atari the black group at a single liberty L.
    const libsB = group(board, rep.x, rep.y).liberties;
    if (libsB.length < 2) continue;
    const shuffledB = shuffle(rng, libsB);
    const L = shuffledB[0]!;
    for (const p of shuffledB.slice(1)) board.set(p.x, p.y, "w");
    if (group(board, rep.x, rep.y).liberties.length !== 1) continue;

    // Put one adjacent white group into atari at a point C != L by filling its
    // other liberties with black helpers. Capturing it (at C) must free Black,
    // while extending at L must not.
    let built = false;
    for (const wg of shuffle(rng, adjacentWhiteGroups(board, blob))) {
      const wlibs = group(board, wg.x, wg.y).liberties;
      // If L is one of this group's liberties we cannot reduce it to a single
      // non-L liberty without touching L (Black's escape point) — skip it.
      if (wlibs.some((p) => p.x === L.x && p.y === L.y)) continue;
      if (wlibs.length < 1) continue;

      const trial = board.clone();
      const shuffledW = shuffle(rng, wlibs);
      // Leave shuffledW[0] = C open; fill the rest with black helpers.
      for (const p of shuffledW.slice(1)) trial.set(p.x, p.y, "b");

      if (group(trial, wg.x, wg.y).liberties.length !== 1) continue; // white now in atari at C
      if (group(trial, rep.x, rep.y).liberties.length !== 1) continue; // black still in atari at L
      if (!allGroupsAlive(trial)) continue; // legal position

      const v = validateM(trial, "b", escapeGoal(rep), "any-valid");
      if (!v.valid) continue;
      // Discriminator: plain extension at L must NOT be an escape.
      if (v.solution.some((p) => p.x === L.x && p.y === L.y)) continue;
      // Every escaping move must capture white.
      const allCaptures = v.solution.every((mv) => play(trial, mv.x, mv.y, "b").captured.length > 0);
      if (!allCaptures) continue;

      const marks = blob.map((p) => ({ x: p.x, y: p.y, kind: "mark" as const }));
      const puzzle: Puzzle = {
        id: "tmp", topic: 4, rung, mode: "M", size,
        stones: trial.stones(), toPlay: "b",
        prompt: "Black to play — save your group.",
        solution: { kind: "move", points: v.solution },
        marks,
      };
      const sig = JSON.stringify({ s: puzzle.stones, sol: v.solution, m: marks });
      if (seen.has(sig)) continue;
      seen.add(sig);
      out.push(puzzle);
      built = true;
      break;
    }
    if (!built) continue;
  }

  if (out.length < count) {
    throw new Error(`generateEscapeCapture: produced ${out.length}/${count} puzzles (rung ${rung}, size ${size})`);
  }
  return out;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/generator/topics/escape.test.ts -t generateEscapeCapture`
Expected: PASS.
**If the first spec throws `produced <20/20`** on size 7, this construction is genuinely tight. In that case bump the rung-2 board to size 9 in the test (`size: 9`) and record that the same change must be made in Task 3's `buildBank` wiring. Size does not affect reproducibility here (this generator uses its own seed). Do **not** lower `count` or relax the `allCaptures` / discriminator guards.

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/generator/topics/escape.ts src/generator/topics/escape.test.ts
git commit -m "feat(generator): Topic 4 rung 2 — capture the attacker to escape atari

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013CsZD5HwrD78GC6o8uPZ5F"
```

---

## Task 3: Wire enriched Topic 4 into `buildBank`, regenerate, verify reproducibility

**Files:**
- Modify: `src/generator/cli.ts` (imports; replace the inline Topic 4 block with an RNG spacer; append enriched Topic 4 at the end)
- Modify: `src/generator/cli.test.ts` (add a Topic-4 invariant test)
- Modify: `src/bank/bank.json` (regenerated output)

**Interfaces:**
- Consumes: `generateEscapeRun`, `generateEscapeCapture` (Task 1/2); existing `makeRng`, `buildBank`, `assembleBank`.
- Produces: a regenerated `bank.json` where Topic 4's 40 puzzles are the enriched ones and every other topic is byte-identical to the previous bank.

- [ ] **Step 1: Snapshot the current bank for the reproducibility check**

Run:
```bash
cp src/bank/bank.json /private/tmp/claude-501/-Users-diman-src-golife/2093e215-84a2-4ed1-97e4-32f930df263f/scratchpad/bank-old.json
```
Expected: file copied (no output).

- [ ] **Step 2: Add the Topic-4 invariant test to `cli.test.ts`**

Add these imports at the top of `src/generator/cli.test.ts`:

```typescript
import { Board } from "../engine/board";
import { play } from "../engine/rules";
import { group } from "../engine/liberties";
```

Add this `it` block inside the `describe("buildBank", ...)`:

```typescript
it("topic 4 rung 1 escapes by extension; rung 2 escapes by capture", () => {
  const bank = buildBank(20260706);
  const byRung = (rung: number) => bank.puzzles.filter((p) => p.topic === 4 && p.rung === rung);

  for (const p of byRung(1)) {
    const board = Board.from(p.size, p.stones);
    const rep = p.marks![0]!;
    expect(group(board, rep.x, rep.y).liberties.length).toBe(1);
    if (p.solution.kind === "move")
      for (const mv of p.solution.points) {
        const r = play(board, mv.x, mv.y, "b");
        expect(r.ok).toBe(true);
        expect(r.captured.length).toBe(0);
        expect(group(r.board, rep.x, rep.y).liberties.length).toBeGreaterThanOrEqual(2);
      }
  }

  for (const p of byRung(2)) {
    const board = Board.from(p.size, p.stones);
    const rep = p.marks![0]!;
    const libs = group(board, rep.x, rep.y).liberties;
    expect(libs.length).toBe(1);
    const L = libs[0]!;
    const ext = play(board, L.x, L.y, "b");
    const extEscaped =
      ext.ok && ext.board.get(rep.x, rep.y) === "b" &&
      group(ext.board, rep.x, rep.y).liberties.length >= 2;
    expect(extEscaped).toBe(false);
    if (p.solution.kind === "move")
      for (const mv of p.solution.points) {
        const r = play(board, mv.x, mv.y, "b");
        expect(r.ok).toBe(true);
        expect(r.captured.length).toBeGreaterThan(0);
        expect(group(r.board, rep.x, rep.y).liberties.length).toBeGreaterThanOrEqual(2);
      }
  }
});
```

- [ ] **Step 3: Run the new test to verify it fails**

Run: `npx vitest run src/generator/cli.test.ts -t "topic 4 rung 1 escapes"`
Expected: FAIL — the committed bank still has the OLD lone-stone Topic 4 (rung 2 puzzles escape by extension, so `captured.length` is 0 and `extEscaped` is true), so the rung-2 assertions fail.

- [ ] **Step 4: Update `cli.ts` imports**

Change line 6 of `src/generator/cli.ts` from:

```typescript
import { generateEscape } from "./topics/escape";
```
to:
```typescript
import { generateEscape, generateEscapeRun, generateEscapeCapture } from "./topics/escape";
```

- [ ] **Step 5: Replace the inline Topic 4 block with an RNG spacer**

Replace these lines in `buildBank` (currently the Topic 4 comment + two `groups.push(... generateEscape ...)` lines):

```typescript
  // Topic 4 — escape atari: rung 1 interior, rung 2 edge
  groups.push(curateRung(generateEscape(rng, { rung: 1, size: 7, count: PER_RUNG, region: "interior" })));
  groups.push(curateRung(generateEscape(rng, { rung: 2, size: 7, count: PER_RUNG, region: "edge" })));
```

with:

```typescript
  // Topic 4 — escape atari. RNG SPACER: the (now frozen) generateEscape is
  // replayed here purely to consume the shared RNG stream exactly as the
  // committed bank did, so topics 5/6/7/10/11 below stay byte-for-byte identical.
  // curateRung() is pure (no RNG), so only generateEscape() needs replaying.
  // The real, ENRICHED Topic 4 is generated from its own seed at the end of
  // buildBank (see below), like topics 8/9.
  generateEscape(rng, { rung: 1, size: 7, count: PER_RUNG, region: "interior" });
  generateEscape(rng, { rung: 2, size: 7, count: PER_RUNG, region: "edge" });
```

- [ ] **Step 6: Append enriched Topic 4 at the end of `buildBank`**

Immediately before `return assembleBank(seed, groups);` (after the Topic 9 pushes), add:

```typescript
  // Topic 4 (enriched) — drawn from its OWN seed so edits here never disturb
  // other topics, and appended last so its slot in the shared stream is
  // irrelevant (mirrors topics 8/9). Rung 1: run to safety (1-3 stone groups).
  // Rung 2: capture the attacker to escape.
  const escapeRng = makeRng(seed ^ 0x00457363); // "Esc"
  groups.push(curateRung(generateEscapeRun(escapeRng, { rung: 1, size: 7, count: PER_RUNG, region: "any", maxGroup: 3 })));
  groups.push(curateRung(generateEscapeCapture(escapeRng, { rung: 2, size: 7, count: PER_RUNG, region: "any" })));
```

> If Task 2 Step 5 forced rung 2 to size 9, use `size: 9` in the `generateEscapeCapture` call here.

- [ ] **Step 7: Regenerate the bank**

Run: `npm run generate`
Expected: `Wrote 440 puzzles to .../src/bank/bank.json`. If it throws `generateEscapeCapture: produced <20/20`, apply the size-9 fallback from Task 2 Step 5 to both the generator test and this wiring, then re-run.

- [ ] **Step 8: Verify topics other than 4 are byte-identical**

Run:
```bash
SCRATCH=/private/tmp/claude-501/-Users-diman-src-golife/2093e215-84a2-4ed1-97e4-32f930df263f/scratchpad
jq -S '.puzzles | map(select(.topic != 4))' "$SCRATCH/bank-old.json" > "$SCRATCH/old-others.json"
jq -S '.puzzles | map(select(.topic != 4))' src/bank/bank.json > "$SCRATCH/new-others.json"
diff "$SCRATCH/old-others.json" "$SCRATCH/new-others.json" && echo "NON-TOPIC-4 PUZZLES IDENTICAL"
```
Expected: `NON-TOPIC-4 PUZZLES IDENTICAL` (empty diff). If the diff is non-empty, the spacer did not preserve the RNG stream — recheck that the Step-5 spacer calls use the exact original `region`/`count`/`size` and that no code before the Topic 4 slot changed.

- [ ] **Step 9: Run the full test suite + typecheck + build**

Run: `npm test`
Expected: all pass, including the new `cli.test.ts` Topic-4 invariant and the 440-count/determinism specs.

Run: `npm run typecheck`
Expected: no errors.

Run: `npm run build`
Expected: builds clean.

- [ ] **Step 10: Commit**

```bash
git add src/generator/cli.ts src/generator/cli.test.ts src/bank/bank.json
git commit -m "feat(bank): ship enriched Topic 4 (escape atari); isolate its RNG seed

Rung 1 now uses 1-3 stone groups; rung 2 teaches capture-to-escape. The old
generator is retained as an RNG spacer so topics 5/6/7/10/11 are unchanged.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013CsZD5HwrD78GC6o8uPZ5F"
```

---

## Task 4: Update the project tracker

**Files:**
- Modify: `PLAN.md` (roadmap Phase 7 bullet + tracker row + test count)

**Interfaces:**
- Consumes: the passing test count printed by `npm test` in Task 3 Step 9.
- Produces: documentation reflecting Topic 4 enrichment as shipped.

- [ ] **Step 1: Update the roadmap bullet**

In `PLAN.md` under `### Phase 7 — Content enrichment`, change the header marker from `📋 planned` to `🚧 in progress` and change the Topic 4 bullet to mark it shipped:

```markdown
### Phase 7 — Content enrichment  🚧 in progress
- **Topic 4 (Escape atari)** ✅ *shipped* — rung 1 now drills escape-by-extension
  on 1–3 stone groups; rung 2 teaches **capture-to-escape** (you're in atari, the
  attacker is too — capture it), with the plain-extension "run" engine-verified to
  fail. Generated from an isolated seed so the rest of the bank is unchanged.
- **Smith 1908 tier** — Arthur Smith's *The Game of Go* (public domain, ~99 audited
  problems) as a curated enrichment set beyond the generated bank.
```

- [ ] **Step 2: Update the tracker row**

In the Tracker table, change the Topic 4 row from:

```markdown
| 7 | Topic 4 (Escape atari) enrichment | 📋 | weakest generator |
```
to:
```markdown
| 7 | Topic 4 (Escape atari) enrichment | ✅ | rung 1: 1–3 stone extend; rung 2: capture-to-escape; isolated RNG seed |
```

- [ ] **Step 3: Update the test count line**

In `PLAN.md` line ~11, update `**Tests:** 706 passing` to the new total printed by `npm test` in Task 3 Step 9 (replace `706` with the actual number).

- [ ] **Step 4: Commit**

```bash
git add PLAN.md
git commit -m "docs: mark Phase 7 Topic 4 enrichment shipped

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013CsZD5HwrD78GC6o8uPZ5F"
```

---

## Self-Review

**Spec coverage:**
- Rung 1 richer shapes (1–3 stones, pure extension, attackers settled, curated) → Task 1 + Task 3 Step 6 (`maxGroup: 3`). ✓
- Rung 2 capture-to-escape (adjacent white in atari at C≠L; extend-at-L fails; solution is capture) → Task 2. ✓
- Mark all target-group stones → both generators set `marks = blob.map(...)`. ✓
- RNG isolation (own seed, appended last, others byte-identical) → Task 3 Steps 5/6/8. ✓
- Engine-verified tests incl. rung-2 discriminator → Task 1/2 tests + Task 3 cli.test.ts invariant. ✓
- Fail-loud guards → both generators `throw` on shortfall. ✓
- Bank stays 440, no UI changes → envelope untouched; existing cli.test.ts 440 spec still runs. ✓
- Rung-2 yield risk → Task 2 Step 5 size-9 fallback documented. ✓

**Placeholder scan:** No TBD/TODO; every code step shows complete code; every command has expected output. ✓

**Type consistency:** `generateEscapeRun`/`generateEscapeCapture` signatures match between escape.ts, escape.test.ts, and cli.ts. `escapeGoal(rep: Point)` reused unchanged. `marks[0]` is the representative in both generators and all tests. `play(...).captured` used consistently per `PlayResult`. ✓
