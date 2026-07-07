# Stage A Topics 4–6 (Escape · Self-atari · Double atari) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add generators for the remaining Stage A topics — 4 (escaping atari), 5 (don't self-atari), 6 (double atari) — and grow the committed `bank.json` to all 6 topics (240 puzzles), fully engine-verified.

**Architecture:** Same build-time pipeline as topics 1–3. Extract the shared placement helpers into `geometry.ts`, add one generator per new topic (each with a topic-specific goal predicate validated through the existing `validateM`), wire them into the CLI, regenerate the committed bank, and extend the bank solvability suite to cover the new topics' semantics.

**Tech Stack:** Node ≥20, TypeScript (ESM), Vitest, `tsx`.

## Global Constraints

- **Build-time only**; the engine never ships to the client.
- **Deterministic** — seeded RNG only (no `Math.random`/`Date.now`); same seed → same bank.
- **20 distinct puzzles per rung**; generators throw fail-loud if they cannot reach the count.
- **Clean shapes** — reject any position where a *helper* black stone is itself in atari.
- **Board = local frames**, size 5–7.
- **Solution policy:** `unique` for double atari (topic 6); `any-valid` for escape (topic 4); topic 5 is a computed Q verdict (no move search).
- **ESM**, extensionless local imports.

---

### Task 1: Extract shared geometry

**Files:**
- Create: `src/generator/geometry.ts`
- Modify: `src/generator/topics/atari.ts` (import `Region`/`startCell`/`growBlob` from geometry instead of defining them)
- Test: `src/generator/geometry.test.ts`

**Interfaces:**
- Produces: `type Region = "interior" | "edge" | "any"`; `function startCell(rng: Rng, size: number, region: Region): Point`; `function growBlob(rng: Rng, size: number, n: number, region: Region): Point[] | null`.

- [ ] **Step 1: Write the failing test** — `src/generator/geometry.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { makeRng } from "../engine/rng";
import { startCell, growBlob } from "./geometry";

describe("geometry", () => {
  it("interior start never lands on the border", () => {
    const r = makeRng(1);
    for (let i = 0; i < 100; i++) {
      const p = startCell(r, 7, "interior");
      expect(p.x).toBeGreaterThanOrEqual(1);
      expect(p.x).toBeLessThanOrEqual(5);
      expect(p.y).toBeGreaterThanOrEqual(1);
      expect(p.y).toBeLessThanOrEqual(5);
    }
  });

  it("edge start always lands on the border", () => {
    const r = makeRng(2);
    for (let i = 0; i < 100; i++) {
      const p = startCell(r, 7, "edge");
      expect(p.x === 0 || p.x === 6 || p.y === 0 || p.y === 6).toBe(true);
    }
  });

  it("growBlob returns a connected blob of the requested size", () => {
    const blob = growBlob(makeRng(3), 7, 4, "any");
    expect(blob).not.toBeNull();
    expect(blob!).toHaveLength(4);
    // all distinct
    expect(new Set(blob!.map((p) => `${p.x},${p.y}`)).size).toBe(4);
  });

  it("is deterministic", () => {
    expect(growBlob(makeRng(5), 7, 3, "any")).toEqual(growBlob(makeRng(5), 7, 3, "any"));
  });
});
```

- [ ] **Step 2: Run test to verify it fails** — Run: `npx vitest run src/generator/geometry.test.ts` — Expected: FAIL (cannot find `./geometry`).

- [ ] **Step 3: Create `src/generator/geometry.ts`** (moved verbatim from `atari.ts`)

```ts
import { Point } from "../engine/board";
import { Rng, randint, shuffle } from "../engine/rng";

export type Region = "interior" | "edge" | "any";

export function startCell(rng: Rng, size: number, region: Region): Point {
  if (region === "interior") {
    return { x: randint(rng, 1, size - 2), y: randint(rng, 1, size - 2) };
  }
  if (region === "edge") {
    const along = randint(rng, 0, size - 1);
    const side = randint(rng, 0, 3);
    if (side === 0) return { x: along, y: 0 };
    if (side === 1) return { x: along, y: size - 1 };
    if (side === 2) return { x: 0, y: along };
    return { x: size - 1, y: along };
  }
  return { x: randint(rng, 0, size - 1), y: randint(rng, 0, size - 1) };
}

// Grow a connected blob of `n` points from a region-seeded start.
export function growBlob(rng: Rng, size: number, n: number, region: Region): Point[] | null {
  const start = startCell(rng, size, region);
  const blob: Point[] = [start];
  const inBlob = (p: Point) => blob.some((q) => q.x === p.x && q.y === p.y);
  while (blob.length < n) {
    const frontier: Point[] = [];
    for (const s of blob)
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const p = { x: s.x + dx, y: s.y + dy };
        if (p.x >= 0 && p.y >= 0 && p.x < size && p.y < size && !inBlob(p)) frontier.push(p);
      }
    if (frontier.length === 0) return null;
    blob.push(shuffle(rng, frontier)[0] as Point);
  }
  return blob;
}
```

- [ ] **Step 4: Update `src/generator/topics/atari.ts`** — remove the local `type Region`, `startCell`, and `growBlob` definitions (lines defining them) and instead import them:

Replace the top imports block so it reads:

```ts
import { Board, Point } from "../../engine/board";
import { play } from "../../engine/rules";
import { group } from "../../engine/liberties";
import { validateM, GoalFn } from "../validate";
import { Rng, randint, shuffle } from "../../engine/rng";
import { Region, growBlob } from "../geometry";
import { Puzzle } from "../types";
```

Then delete the `type Region = ...`, the whole `function startCell(...) { ... }`, and the whole `function growBlob(...) { ... }` blocks from `atari.ts` (they now live in `geometry.ts`). Leave `generateCapture` and `capturesAtLeast` unchanged. Note `randint`/`shuffle` are still used by `generateCapture`, keep them imported.

- [ ] **Step 5: Run tests** — Run: `npm test` — Expected: all pass (geometry tests green; `atari.test.ts` still green — behavior unchanged).

- [ ] **Step 6: Verify the bank is unchanged** — Run: `npm run generate && git diff --stat src/bank/bank.json` — Expected: **no diff** (refactor must not change output). If `bank.json` changed, the refactor altered behavior — revert and fix.

- [ ] **Step 7: Commit**

```bash
git add src/generator/geometry.ts src/generator/geometry.test.ts src/generator/topics/atari.ts
git commit -m "refactor(generator): extract shared placement geometry"
```

---

### Task 2: Topic 4 generator — escaping atari (M, any-valid)

**Files:**
- Create: `src/generator/topics/escape.ts`
- Test: `src/generator/topics/escape.test.ts`

**Interfaces:**
- Consumes: `Board`, `Point` from `../../engine/board`; `group` from `../../engine/liberties`; `validateM`, `GoalFn` from `../validate`; `Rng`, `shuffle` from `../../engine/rng`; `Region`, `startCell` from `../geometry`; `Puzzle` from `../types`.
- Produces: `function generateEscape(rng: Rng, opts: { rung: number; size: number; count: number; region: Region }): Puzzle[]`.

**Design:** place one black target stone, fill all-but-one of its neighbours with white (target is now in atari), require every white group to have ≥2 liberties (so the only rescue is extension, not capture), then validate that at least one Black move leaves the target group with ≥2 liberties. `marks` carries the target; `solution.points` is every valid escape.

- [ ] **Step 1: Write the failing test** — `src/generator/topics/escape.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { Board } from "../../engine/board";
import { play } from "../../engine/rules";
import { group } from "../../engine/liberties";
import { makeRng } from "../../engine/rng";
import { generateEscape } from "./escape";

describe("generateEscape", () => {
  it("target starts in atari; every listed move rescues it to >=2 liberties", () => {
    const puzzles = generateEscape(makeRng(1), { rung: 1, size: 7, count: 20, region: "interior" });
    expect(puzzles).toHaveLength(20);
    for (const p of puzzles) {
      expect(p.mode).toBe("M");
      expect(p.marks).toHaveLength(1);
      const target = p.marks![0]!;
      const before = Board.from(p.size, p.stones);
      expect(group(before, target.x, target.y).liberties.length).toBe(1); // in atari
      expect(p.solution.kind).toBe("move");
      if (p.solution.kind === "move") {
        expect(p.solution.points.length).toBeGreaterThanOrEqual(1);
        for (const mv of p.solution.points) {
          const r = play(Board.from(p.size, p.stones), mv.x, mv.y, "b");
          expect(r.ok).toBe(true);
          expect(group(r.board, target.x, target.y).liberties.length).toBeGreaterThanOrEqual(2);
        }
      }
    }
  });

  it("no helper black stone is in atari, and it is deterministic", () => {
    const a = generateEscape(makeRng(4), { rung: 2, size: 7, count: 10, region: "edge" });
    for (const p of a) {
      const b = Board.from(p.size, p.stones);
      const target = p.marks![0]!;
      for (const s of p.stones)
        if (s.c === "b" && !(s.x === target.x && s.y === target.y))
          expect(group(b, s.x, s.y).liberties.length).toBeGreaterThanOrEqual(2);
    }
    expect(a).toEqual(generateEscape(makeRng(4), { rung: 2, size: 7, count: 10, region: "edge" }));
  });
});
```

- [ ] **Step 2: Run test to verify it fails** — Run: `npx vitest run src/generator/topics/escape.test.ts` — Expected: FAIL (cannot find `./escape`).

- [ ] **Step 3: Write `src/generator/topics/escape.ts`**

```ts
import { Board, Point } from "../../engine/board";
import { group } from "../../engine/liberties";
import { validateM, GoalFn } from "../validate";
import { Rng, shuffle } from "../../engine/rng";
import { Region, startCell } from "../geometry";
import { Puzzle } from "../types";

// A move rescues the target if, afterwards, the target is still on the board
// and its group has >= 2 liberties.
function escapeGoal(target: Point): GoalFn {
  return (_before, _move, _color, res) => {
    if (res.board.get(target.x, target.y) !== "b") return false;
    return group(res.board, target.x, target.y).liberties.length >= 2;
  };
}

export function generateEscape(
  rng: Rng,
  opts: { rung: number; size: number; count: number; region: Region },
): Puzzle[] {
  const { rung, size, count, region } = opts;
  const out: Puzzle[] = [];
  const seen = new Set<string>();
  let guard = 0;

  while (out.length < count && guard++ < count * 800) {
    const target = startCell(rng, size, region);
    const board = new Board(size);
    board.set(target.x, target.y, "b");

    const nbrs = board.neighbors(target.x, target.y);
    if (nbrs.length < 2) continue; // need at least one to fill and one to leave open
    const shuffled = shuffle(rng, nbrs);
    const fill = shuffled.slice(1); // leave shuffled[0] open -> single liberty
    for (const p of fill) board.set(p.x, p.y, "w");

    // target must be in atari
    if (group(board, target.x, target.y).liberties.length !== 1) continue;
    // every white attacker must be settled (>= 2 liberties) so escape is by extension
    const whiteSettled = board
      .stones()
      .every((s) => s.c !== "w" || group(board, s.x, s.y).liberties.length >= 2);
    if (!whiteSettled) continue;

    const v = validateM(board, "b", escapeGoal(target), "any-valid");
    if (!v.valid) continue;

    const puzzle: Puzzle = {
      id: "tmp",
      topic: 4,
      rung,
      mode: "M",
      size,
      stones: board.stones(),
      toPlay: "b",
      prompt: "Black to play — save the stone in atari.",
      solution: { kind: "move", points: v.solution },
      marks: [{ x: target.x, y: target.y, kind: "mark" }],
    };

    const sig = JSON.stringify({ s: puzzle.stones, m: [target.x, target.y] });
    if (seen.has(sig)) continue;
    seen.add(sig);
    out.push(puzzle);
  }

  if (out.length < count) {
    throw new Error(`generateEscape: produced ${out.length}/${count} puzzles (rung ${rung}, size ${size})`);
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes** — Run: `npx vitest run src/generator/topics/escape.test.ts` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/generator/topics/escape.ts src/generator/topics/escape.test.ts
git commit -m "feat(generator): escape-atari generator (topic 4)"
```

---

### Task 3: Topic 5 generator — don't self-atari (Q-binary)

**Files:**
- Create: `src/generator/topics/selfatari.ts`
- Test: `src/generator/topics/selfatari.test.ts`

**Interfaces:**
- Consumes: `Board`, `Point` from `../../engine/board`; `play` from `../../engine/rules`; `group` from `../../engine/liberties`; `Rng`, `randint`, `shuffle` from `../../engine/rng`; `Region`, `startCell` from `../geometry`; `Puzzle` from `../types`.
- Produces:
  - `function isSelfAtari(board: Board, cand: Point): boolean` — playing Black at `cand` is legal-but-leaves ≤1 liberty capturing nothing, OR is outright illegal (suicide).
  - `function generateSelfAtari(rng: Rng, opts: { rung: number; size: number; count: number; region: Region }): Puzzle[]` — `mode: "Q-binary"`, one marked candidate point, `solution: { kind: "choice", id: "self-atari" | "safe" }`. Half the puzzles are each answer.

**Design:** the board holds only settled white stones and one **empty marked candidate**. To force "self-atari", fill `deg-1` of the candidate's neighbours with white (leaving one liberty). For "safe", fill ≤ `deg-2`. Verify with `isSelfAtari` and balance the two answers within the rung.

- [ ] **Step 1: Write the failing test** — `src/generator/topics/selfatari.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { Board } from "../../engine/board";
import { makeRng } from "../../engine/rng";
import { generateSelfAtari, isSelfAtari } from "./selfatari";

describe("generateSelfAtari", () => {
  it("labels match the engine and both answers appear, balanced", () => {
    const puzzles = generateSelfAtari(makeRng(1), { rung: 1, size: 7, count: 20, region: "interior" });
    expect(puzzles).toHaveLength(20);
    let selfAtari = 0, safe = 0;
    for (const p of puzzles) {
      expect(p.mode).toBe("Q-binary");
      expect(p.marks).toHaveLength(1);
      expect(p.solution.kind).toBe("choice");
      const cand = p.marks![0]!;
      const board = Board.from(p.size, p.stones);
      expect(board.get(cand.x, cand.y)).toBeNull(); // candidate is an empty point
      const truth = isSelfAtari(board, cand) ? "self-atari" : "safe";
      if (p.solution.kind === "choice") expect(p.solution.id).toBe(truth);
      if (truth === "self-atari") selfAtari++; else safe++;
    }
    expect(selfAtari).toBe(10);
    expect(safe).toBe(10);
  });

  it("is deterministic", () => {
    const opts = { rung: 1, size: 7, count: 12, region: "interior" as const };
    expect(generateSelfAtari(makeRng(7), opts)).toEqual(generateSelfAtari(makeRng(7), opts));
  });
});
```

- [ ] **Step 2: Run test to verify it fails** — Run: `npx vitest run src/generator/topics/selfatari.test.ts` — Expected: FAIL (cannot find `./selfatari`).

- [ ] **Step 3: Write `src/generator/topics/selfatari.ts`**

```ts
import { Board, Point } from "../../engine/board";
import { play } from "../../engine/rules";
import { group } from "../../engine/liberties";
import { Rng, randint, shuffle } from "../../engine/rng";
import { Region, startCell } from "../geometry";
import { Puzzle } from "../types";

export function isSelfAtari(board: Board, cand: Point): boolean {
  const res = play(board, cand.x, cand.y, "b");
  if (!res.ok) return true; // suicide / illegal -> definitely "don't play here"
  if (res.captured.length > 0) return false; // capturing is fine
  return group(res.board, cand.x, cand.y).liberties.length <= 1;
}

function build(rng: Rng, size: number, region: Region, wantSelfAtari: boolean): { board: Board; cand: Point } | null {
  const cand = startCell(rng, size, region);
  const board = new Board(size);
  const nbrs = shuffle(rng, board.neighbors(cand.x, cand.y));
  const deg = nbrs.length;
  if (deg < 2) return null;
  const whiteCount = wantSelfAtari ? deg - 1 : randint(rng, 0, deg - 2);
  for (let i = 0; i < whiteCount; i++) board.set(nbrs[i]!.x, nbrs[i]!.y, "w");
  return { board, cand };
}

export function generateSelfAtari(
  rng: Rng,
  opts: { rung: number; size: number; count: number; region: Region },
): Puzzle[] {
  const { rung, size, count, region } = opts;
  const out: Puzzle[] = [];
  const seen = new Set<string>();
  const need = { "self-atari": Math.ceil(count / 2), safe: Math.floor(count / 2) };
  const have = { "self-atari": 0, safe: 0 };
  let guard = 0;

  while (out.length < count && guard++ < count * 800) {
    const wantSelfAtari = have["self-atari"] < need["self-atari"] &&
      (have["safe"] >= need["safe"] || (guard % 2 === 0));
    const built = build(rng, size, region, wantSelfAtari);
    if (!built) continue;
    const { board, cand } = built;

    // every white stone must be settled (>= 2 liberties): keeps shapes clean and
    // guarantees playing `cand` captures nothing.
    const whiteSettled = board
      .stones()
      .every((s) => s.c !== "w" || group(board, s.x, s.y).liberties.length >= 2);
    if (!whiteSettled) continue;

    const truth = isSelfAtari(board, cand) ? "self-atari" : "safe";
    if (have[truth] >= need[truth]) continue;

    const puzzle: Puzzle = {
      id: "tmp",
      topic: 5,
      rung,
      mode: "Q-binary",
      size,
      stones: board.stones(),
      toPlay: "b",
      prompt: "If Black plays the marked point, is it self-atari?",
      solution: { kind: "choice", id: truth },
      marks: [{ x: cand.x, y: cand.y, kind: "target" }],
    };

    const sig = JSON.stringify({ s: puzzle.stones, c: [cand.x, cand.y] });
    if (seen.has(sig)) continue;
    seen.add(sig);
    have[truth]++;
    out.push(puzzle);
  }

  if (out.length < count) {
    throw new Error(`generateSelfAtari: produced ${out.length}/${count} puzzles (rung ${rung}, size ${size})`);
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes** — Run: `npx vitest run src/generator/topics/selfatari.test.ts` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/generator/topics/selfatari.ts src/generator/topics/selfatari.test.ts
git commit -m "feat(generator): self-atari recognition generator (topic 5)"
```

---

### Task 4: Topic 6 generator — double atari (M, unique)

**Files:**
- Create: `src/generator/topics/doubleatari.ts`
- Test: `src/generator/topics/doubleatari.test.ts`

**Interfaces:**
- Consumes: `Board`, `Point` from `../../engine/board`; `group` from `../../engine/liberties`; `validateM`, `GoalFn` from `../validate`; `Rng`, `shuffle` from `../../engine/rng`; `startCell` from `../geometry`; `Puzzle` from `../types`.
- Produces: `function generateDoubleAtari(rng: Rng, opts: { rung: number; size: number; count: number }): Puzzle[]` — `mode: "M"`, `solution` = the unique double-atari point, `ataris` = the two threatened white stones, no `captured`.

**Design:** pick an interior move point `P`; place two lone white stones on two of `P`'s neighbours; for each, fill all-but-one of its *other* liberties with black so it has exactly two liberties (`P` + one). Playing `P` drops both to one liberty (double atari) without capturing. Validate uniqueness with a goal that counts distinct white neighbour groups reduced to one liberty.

- [ ] **Step 1: Write the failing test** — `src/generator/topics/doubleatari.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { Board } from "../../engine/board";
import { play } from "../../engine/rules";
import { group } from "../../engine/liberties";
import { makeRng } from "../../engine/rng";
import { generateDoubleAtari } from "./doubleatari";

describe("generateDoubleAtari", () => {
  it("the move puts two distinct white stones into atari and captures nothing", () => {
    const puzzles = generateDoubleAtari(makeRng(1), { rung: 1, size: 7, count: 20 });
    expect(puzzles).toHaveLength(20);
    for (const p of puzzles) {
      expect(p.mode).toBe("M");
      expect(p.solution.kind).toBe("move");
      if (p.solution.kind !== "move") continue;
      expect(p.solution.points).toHaveLength(1);
      const mv = p.solution.points[0]!;
      const r = play(Board.from(p.size, p.stones), mv.x, mv.y, "b");
      expect(r.ok).toBe(true);
      expect(r.captured).toHaveLength(0); // atari, not capture
      // count distinct white neighbour groups now in atari
      const seen = new Set<string>();
      let atariCount = 0;
      for (const n of r.board.neighbors(mv.x, mv.y)) {
        if (r.board.get(n.x, n.y) !== "w") continue;
        const g = group(r.board, n.x, n.y);
        const key = g.stones.map((s) => `${s.x},${s.y}`).sort().join(";");
        if (seen.has(key)) continue;
        seen.add(key);
        if (g.liberties.length === 1) atariCount++;
      }
      expect(atariCount).toBeGreaterThanOrEqual(2);
    }
  });

  it("no helper black stone is in atari, and it is deterministic", () => {
    const a = generateDoubleAtari(makeRng(3), { rung: 1, size: 7, count: 10 });
    for (const p of a) {
      const b = Board.from(p.size, p.stones);
      for (const s of p.stones)
        if (s.c === "b") expect(group(b, s.x, s.y).liberties.length).toBeGreaterThanOrEqual(2);
    }
    expect(a).toEqual(generateDoubleAtari(makeRng(3), { rung: 1, size: 7, count: 10 }));
  });
});
```

- [ ] **Step 2: Run test to verify it fails** — Run: `npx vitest run src/generator/topics/doubleatari.test.ts` — Expected: FAIL (cannot find `./doubleatari`).

- [ ] **Step 3: Write `src/generator/topics/doubleatari.ts`**

```ts
import { Board, Point } from "../../engine/board";
import { group } from "../../engine/liberties";
import { validateM, GoalFn } from "../validate";
import { Rng, shuffle } from "../../engine/rng";
import { startCell } from "../geometry";
import { Puzzle } from "../types";

// After the move, >= 2 distinct white neighbour groups have exactly one liberty,
// and nothing was captured.
const doubleAtariGoal: GoalFn = (_before, move, _color, res) => {
  if (res.captured.length > 0) return false;
  const seen = new Set<string>();
  let count = 0;
  for (const n of res.board.neighbors(move.x, move.y)) {
    if (res.board.get(n.x, n.y) !== "w") continue;
    const g = group(res.board, n.x, n.y);
    const key = g.stones.map((s) => `${s.x},${s.y}`).sort().join(";");
    if (seen.has(key)) continue;
    seen.add(key);
    if (g.liberties.length === 1) count++;
  }
  return count >= 2;
};

export function generateDoubleAtari(
  rng: Rng,
  opts: { rung: number; size: number; count: number },
): Puzzle[] {
  const { rung, size, count } = opts;
  const out: Puzzle[] = [];
  const seen = new Set<string>();
  let guard = 0;

  while (out.length < count && guard++ < count * 1200) {
    const p = startCell(rng, size, "interior");
    const board = new Board(size);
    const dirs = shuffle(rng, board.neighbors(p.x, p.y));
    if (dirs.length < 2) continue;
    const whites = [dirs[0]!, dirs[1]!];
    board.set(whites[0].x, whites[0].y, "w");
    board.set(whites[1].x, whites[1].y, "w");

    // Give each white exactly two liberties: P plus one kept escape; fill the rest with black.
    let ok = true;
    for (const w of whites) {
      const others = board
        .neighbors(w.x, w.y)
        .filter((q) => board.get(q.x, q.y) === null && !(q.x === p.x && q.y === p.y));
      if (others.length < 1) { ok = false; break; }
      const keep = shuffle(rng, others);
      for (let i = 1; i < keep.length; i++) board.set(keep[i]!.x, keep[i]!.y, "b");
    }
    if (!ok) continue;
    if (whites.some((w) => group(board, w.x, w.y).liberties.length !== 2)) continue;

    const v = validateM(board, "b", doubleAtariGoal, "unique");
    if (!v.valid) continue;
    // clean shape: helper black stones must be settled
    if (board.stones().some((s) => s.c === "b" && group(board, s.x, s.y).liberties.length <= 1)) continue;

    const move = v.solution[0]!;
    const puzzle: Puzzle = {
      id: "tmp",
      topic: 6,
      rung,
      mode: "M",
      size,
      stones: board.stones(),
      toPlay: "b",
      prompt: "Black to play — atari two stones at once.",
      solution: { kind: "move", points: [move] },
      ataris: whites.map((w) => ({ x: w.x, y: w.y })),
    };

    const sig = JSON.stringify({ s: puzzle.stones, sol: move });
    if (seen.has(sig)) continue;
    seen.add(sig);
    out.push(puzzle);
  }

  if (out.length < count) {
    throw new Error(`generateDoubleAtari: produced ${out.length}/${count} puzzles (rung ${rung}, size ${size})`);
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes** — Run: `npx vitest run src/generator/topics/doubleatari.test.ts` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/generator/topics/doubleatari.ts src/generator/topics/doubleatari.test.ts
git commit -m "feat(generator): double-atari generator (topic 6)"
```

---

### Task 5: Wire topics 4–6 into the CLI and regenerate the bank

**Files:**
- Modify: `src/generator/cli.ts`
- Modify: `src/generator/cli.test.ts`
- Modify (generated): `src/bank/bank.json`

**Interfaces:**
- Consumes the three new generators plus the existing ones.
- Produces: `buildBank(seed)` now emits **6 topics × 2 rungs × 20 = 240** puzzles; `curateRung` also spreads Q-binary answers.

- [ ] **Step 1: Update `curateRung` and `buildBank` in `src/generator/cli.ts`**

Add the new imports after the existing generator imports:

```ts
import { generateEscape } from "./topics/escape";
import { generateSelfAtari } from "./topics/selfatari";
import { generateDoubleAtari } from "./topics/doubleatari";
```

Replace the `key` function inside `curateRung` so Q-binary interleaves by answer:

```ts
  const key = (p: Puzzle): number => {
    if (p.mode === "Q-count" && p.solution.kind === "value") return p.solution.value;
    if (p.mode === "Q-binary" && p.solution.kind === "choice") return p.solution.id === "safe" ? 0 : 1;
    return p.stones.length;
  };
```

Append these groups inside `buildBank`, before `return assembleBank(...)`:

```ts
  // Topic 4 — escape atari: rung 1 interior, rung 2 edge
  groups.push(curateRung(generateEscape(rng, { rung: 1, size: 7, count: PER_RUNG, region: "interior" })));
  groups.push(curateRung(generateEscape(rng, { rung: 2, size: 7, count: PER_RUNG, region: "edge" })));

  // Topic 5 — don't self-atari (Q-binary): rung 1 interior, rung 2 any
  groups.push(curateRung(generateSelfAtari(rng, { rung: 1, size: 7, count: PER_RUNG, region: "interior" })));
  groups.push(curateRung(generateSelfAtari(rng, { rung: 2, size: 7, count: PER_RUNG, region: "any" })));

  // Topic 6 — double atari: two rungs
  groups.push(curateRung(generateDoubleAtari(rng, { rung: 1, size: 7, count: PER_RUNG })));
  groups.push(curateRung(generateDoubleAtari(rng, { rung: 2, size: 7, count: PER_RUNG })));
```

- [ ] **Step 2: Update `src/generator/cli.test.ts`** — the distribution test must cover 6 topics. Change the loop `for (const t of [1, 2, 3])` to `for (const t of [1, 2, 3, 4, 5, 6])` (both occurrences: the count assertion in the first test and the distinctness loop in the third test). Add a total-count assertion in the first test after the existing loop:

```ts
    expect(bank.puzzles).toHaveLength(240);
```

- [ ] **Step 3: Run the suite** — Run: `npm test` — Expected: all pass (cli distribution now 240; every rung still 20 distinct).

- [ ] **Step 4: Regenerate the bank** — Run: `npm run generate` — Expected: `Wrote 240 puzzles ...`. If any generator throws an under-delivery error, STOP and report BLOCKED with the failing group.

- [ ] **Step 5: Verify variety** — Run:

```bash
node -e 'const b=require("./src/bank/bank.json");const g={};for(const p of b.puzzles){const k=`t${p.topic}-r${p.rung}`;(g[k]??=[]).push(p);}for(const k of Object.keys(g).sort()){const s=new Set(g[k].map(p=>JSON.stringify({s:p.stones,sol:p.solution,m:p.marks}))).size;console.log(k,g[k].length,"puzzles,",s,"distinct");}'
```

Expected: 12 groups, each `20 puzzles, 20 distinct`.

- [ ] **Step 6: Commit**

```bash
git add src/generator/cli.ts src/generator/cli.test.ts src/bank/bank.json
git commit -m "feat(generator): add topics 4-6 to the bank (240 puzzles)"
```

---

### Task 6: Extend the bank solvability suite for topics 4–6

**Files:**
- Modify: `src/bank/bank.test.ts`

**Interfaces:**
- Consumes: existing engine + `goalMoves` from `../generator/validate`; adds `isSelfAtari` from `../generator/topics/selfatari`.

**Design:** the current suite treats every `M` puzzle as a capture. Split M by topic: capture (2, 3), escape (4), double atari (6). Add a Q-binary (topic 5) block.

- [ ] **Step 1: Update the shape test count** — in `src/bank/bank.test.ts`, change `expect(bank.puzzles).toHaveLength(120);` to `expect(bank.puzzles).toHaveLength(240);` and the two rung loops from `[1, 2, 3]` to `[1, 2, 3, 4, 5, 6]`.

- [ ] **Step 2: Scope the existing capture block to topics 2 & 3** — change the `mPuzzles` filter from `p.mode === "M"` to `p.mode === "M" && (p.topic === 2 || p.topic === 3)`. Leave that block's body unchanged.

- [ ] **Step 3: Add new blocks** at the end of the file (before the final closing), plus the extra import at the top:

Add to the imports:

```ts
import { isSelfAtari } from "../generator/topics/selfatari";
```

Add these describe blocks:

```ts
const escapePuzzles: [string, Puzzle][] = bank.puzzles.filter((p) => p.topic === 4).map((p) => [p.id, p]);
const dblPuzzles: [string, Puzzle][] = bank.puzzles.filter((p) => p.topic === 6).map((p) => [p.id, p]);
const binPuzzles: [string, Puzzle][] = bank.puzzles.filter((p) => p.mode === "Q-binary").map((p) => [p.id, p]);

describe("bank.json — escape puzzles are solvable (topic 4)", () => {
  it.each(escapePuzzles)("%s: target starts in atari and every listed move rescues it", (_id, p) => {
    expect(p.mode).toBe("M");
    expect(p.marks).toHaveLength(1);
    const target = p.marks![0]!;
    const before = Board.from(p.size, p.stones);
    expect(group(before, target.x, target.y).liberties.length).toBe(1);
    expect(p.solution.kind).toBe("move");
    if (p.solution.kind !== "move") return;
    expect(p.solution.points.length).toBeGreaterThanOrEqual(1);
    for (const mv of p.solution.points) {
      const r = play(Board.from(p.size, p.stones), mv.x, mv.y, "b");
      expect(r.ok).toBe(true);
      expect(group(r.board, target.x, target.y).liberties.length).toBeGreaterThanOrEqual(2);
    }
    for (const s of p.stones)
      if (s.c === "b" && !(s.x === target.x && s.y === target.y))
        expect(group(before, s.x, s.y).liberties.length).toBeGreaterThanOrEqual(2);
  });
});

describe("bank.json — double-atari puzzles are solvable (topic 6)", () => {
  it.each(dblPuzzles)("%s: unique move ataris two distinct white stones, no capture", (_id, p) => {
    expect(p.solution.kind).toBe("move");
    if (p.solution.kind !== "move") return;
    expect(p.solution.points).toHaveLength(1);
    const mv = p.solution.points[0]!;
    const board = Board.from(p.size, p.stones);
    const r = play(board, mv.x, mv.y, "b");
    expect(r.ok).toBe(true);
    expect(r.captured).toHaveLength(0);
    const seen = new Set<string>();
    let atari = 0;
    for (const n of r.board.neighbors(mv.x, mv.y)) {
      if (r.board.get(n.x, n.y) !== "w") continue;
      const g = group(r.board, n.x, n.y);
      const key = g.stones.map((s) => `${s.x},${s.y}`).sort().join(";");
      if (seen.has(key)) continue;
      seen.add(key);
      if (g.liberties.length === 1) atari++;
    }
    expect(atari).toBeGreaterThanOrEqual(2);
    // unique
    const winners = goalMoves(board, "b", (_b, m, _c, res) => {
      if (res.captured.length > 0) return false;
      const s2 = new Set<string>(); let c = 0;
      for (const n of res.board.neighbors(m.x, m.y)) {
        if (res.board.get(n.x, n.y) !== "w") continue;
        const g = group(res.board, n.x, n.y);
        const k = g.stones.map((z) => `${z.x},${z.y}`).sort().join(";");
        if (s2.has(k)) continue; s2.add(k);
        if (g.liberties.length === 1) c++;
      }
      return c >= 2;
    });
    expect(winners).toHaveLength(1);
    expect(winners[0]).toEqual(mv);
    for (const s of p.stones)
      if (s.c === "b") expect(group(board, s.x, s.y).liberties.length).toBeGreaterThanOrEqual(2);
  });
});

describe("bank.json — self-atari verdicts are correct (topic 5)", () => {
  it.each(binPuzzles)("%s: recorded verdict matches the engine", (_id, p) => {
    expect(p.mode).toBe("Q-binary");
    expect(p.marks).toHaveLength(1);
    const cand = p.marks![0]!;
    const board = Board.from(p.size, p.stones);
    expect(board.get(cand.x, cand.y)).toBeNull();
    expect(p.solution.kind).toBe("choice");
    if (p.solution.kind !== "choice") return;
    const truth = isSelfAtari(board, cand) ? "self-atari" : "safe";
    expect(p.solution.id).toBe(truth);
  });
});
```

- [ ] **Step 4: Run the full suite** — Run: `npm test` — Expected: all pass (now ~360+ tests including the new per-puzzle solvability checks for topics 4–6).

- [ ] **Step 5: Typecheck** — Run: `npm run typecheck` — Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/bank/bank.test.ts
git commit -m "test(bank): solvability coverage for topics 4-6"
```

---

## Self-Review

**Spec coverage:** topic 4 escape (Task 2, any-valid, target-in-atari + ≥2-after), topic 5 self-atari recognition (Task 3, Q-binary, balanced, engine-labelled), topic 6 double atari (Task 4, unique, two-groups-atari, no capture). Shared geometry deduped (Task 1). Bank grows to 240 and stays curated + reproducible (Task 5). Solvability suite covers every new topic's real semantics (Task 6).

**Placeholder scan:** none — every code step is complete. `id: "tmp"` is overwritten by `assembleBank`.

**Type consistency:** `Region`, `startCell`, `growBlob` (geometry); `generateEscape`, `generateSelfAtari`/`isSelfAtari`, `generateDoubleAtari`; `GoalFn`/`validateM`/`goalMoves`; `Puzzle` `solution` kinds (`move` with `points[]`, `choice` with `id`) — all used consistently with their definitions and with `types.ts` (`Mode` already includes `Q-binary`/`Q-choice`; `SolutionSpec` already includes `choice`).

**Deferred (noted, not in scope):** topic 5 M "connect-to-save" form (Q recognition ships first); topic 6 two-stone-group targets (both rungs use lone white stones, varied only by search); the app's rendering of `Q-binary` verdict input and `ataris` highlight (belongs to the app plan).
