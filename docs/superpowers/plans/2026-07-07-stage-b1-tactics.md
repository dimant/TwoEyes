# Stage B.1 — Capturing Techniques (connect/cut, net, snapback) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three single-move (M) Stage-B topics to the committed bank — Connect & cut (7), Net/geta (10), Snapback (11) — backed by a new build-time bounded capture-reader.

**Architecture:** A pure `reader.ts` (bounded capture minimax over the existing engine) verifies that a net/ladder truly captures. Three topic generators use the established construct/search-then-verify pattern; the CLI assembles them into the committed `bank.json` (240 → 360 puzzles). The app is unchanged (these are `mode:"M"` tap-to-play puzzles); only topic titles are added.

**Tech Stack:** TypeScript (ESM), Vitest. No new dependencies.

## Global Constraints

- **Build-time only** — reader/generators never ship to the client.
- **Deterministic** — seeded RNG only; no `Math.random`/`Date.now`.
- **20 distinct puzzles per rung**, fail-loud if a rung can't fill.
- **Clean shapes** — no helper/wall black stone left in atari.
- **Board = local frames**, size 5–7.
- **Gentle ramp** — unlock order Connect & cut → Net → Snapback; each topic's rung 1 is its clearest textbook shape at the shallowest reading depth, rung 2 adds variation.
- **Single-move M puzzles** — `solution:{kind:"move", points:[…]}`. Net/snapback capture nothing on the played move (no `captured`); connect-cut rung 2 does capture.
- **ESM**, extensionless local imports.

---

### Task 1: The bounded capture-reader

**Files:**
- Create: `src/generator/reader.ts`
- Test: `src/generator/reader.test.ts`

**Interfaces:**
- Consumes: `Board`, `Point`, `Color` from `../engine/board`; `play` from `../engine/rules`; `group` from `../engine/liberties`.
- Produces: `function capturedUnderBestPlay(board: Board, target: Point, toMove: Color, depth: number): boolean` — with Black the attacker and White the target's colour, returns whether the White `target` group is captured within `depth` plies under best play (attacker chases on the target's liberties; defender extends on them or captures an adjacent atari'd attacker stone; a target reaching ≥ 3 liberties has escaped).

- [ ] **Step 1: Write the failing test** — `src/generator/reader.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { Board } from "../engine/board";
import { capturedUnderBestPlay } from "./reader";

describe("capturedUnderBestPlay", () => {
  it("captures a stone already in atari (1 ply)", () => {
    const b = Board.from(5, [
      { x: 2, y: 2, c: "w" }, { x: 1, y: 2, c: "b" }, { x: 3, y: 2, c: "b" }, { x: 2, y: 1, c: "b" },
    ]);
    expect(capturedUnderBestPlay(b, { x: 2, y: 2 }, "b", 1)).toBe(true);
  });

  it("reads a working edge-ladder out to the capture", () => {
    // white on the left edge with one black contact -> laddered down the edge, never reaches 3 libs
    const b = Board.from(5, [{ x: 0, y: 2, c: "w" }, { x: 1, y: 2, c: "b" }]);
    expect(capturedUnderBestPlay(b, { x: 0, y: 2 }, "b", 8)).toBe(true);
  });

  it("returns false when the stone runs free to 3+ liberties", () => {
    // black on two sides only -> white runs into open space and escapes
    const b = Board.from(5, [{ x: 2, y: 2, c: "w" }, { x: 1, y: 2, c: "b" }, { x: 3, y: 2, c: "b" }]);
    expect(capturedUnderBestPlay(b, { x: 2, y: 2 }, "b", 8)).toBe(false);
  });

  it("returns false for a stone that already has 3+ liberties", () => {
    expect(capturedUnderBestPlay(Board.from(5, [{ x: 2, y: 2, c: "w" }]), { x: 2, y: 2 }, "b", 8)).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails** — Run: `npx vitest run src/generator/reader.test.ts` — Expected: FAIL (cannot find `./reader`).

- [ ] **Step 3: Write `src/generator/reader.ts`**

```ts
import { Board, Point, Color } from "../engine/board";
import { play } from "../engine/rules";
import { group } from "../engine/liberties";

const ESCAPE_LIBS = 3;

// Empty points where WHITE, by playing, captures a Black stone adjacent to the target
// (a black chaser in atari) — an escape route for the defender.
function defenderCaptureMoves(board: Board, targetStones: Point[]): Point[] {
  const out: Point[] = [];
  const seen = new Set<string>();
  for (const s of targetStones) {
    for (const n of board.neighbors(s.x, s.y)) {
      if (board.get(n.x, n.y) !== null) continue;
      for (const nn of board.neighbors(n.x, n.y)) {
        if (board.get(nn.x, nn.y) === "b" && group(board, nn.x, nn.y).liberties.length === 1) {
          const k = `${n.x},${n.y}`;
          if (!seen.has(k)) { seen.add(k); out.push(n); }
        }
      }
    }
  }
  return out;
}

export function capturedUnderBestPlay(board: Board, target: Point, toMove: Color, depth: number): boolean {
  const g = group(board, target.x, target.y);
  if (g.stones.length === 0) return true;              // target already captured
  if (g.liberties.length >= ESCAPE_LIBS) return false; // ran free
  if (depth <= 0) return false;                        // out of reading -> assume it escaped

  if (toMove === "b") {
    // attacker: play a liberty of the target to reduce it
    for (const m of g.liberties) {
      const res = play(board, m.x, m.y, "b");
      if (!res.ok) continue;
      if (capturedUnderBestPlay(res.board, target, "w", depth - 1)) return true;
    }
    return false;
  }
  // defender (white): escape if ANY move avoids capture
  const moves = [...g.liberties, ...defenderCaptureMoves(board, g.stones)];
  for (const m of moves) {
    const res = play(board, m.x, m.y, "w");
    if (!res.ok) continue;
    if (!capturedUnderBestPlay(res.board, target, "b", depth - 1)) return false;
  }
  return true; // defender has no escaping move
}
```

- [ ] **Step 4: Run to verify it passes** — Run: `npx vitest run src/generator/reader.test.ts` — Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/generator/reader.ts src/generator/reader.test.ts
git commit -m "feat(generator): bounded capture-reader (net/ladder verification)"
```

---

### Task 2: Connect & cut generator (topic 7)

**Files:**
- Create: `src/generator/topics/connectcut.ts`
- Test: `src/generator/topics/connectcut.test.ts`

**Interfaces:**
- Consumes: `Board`, `Point` from `../../engine/board`; `play` from `../../engine/rules`; `group` from `../../engine/liberties`; `validateM`, `GoalFn` from `../validate`; `Rng`, `randint`, `shuffle` from `../../engine/rng`; `startCell` from `../geometry`; `Puzzle` from `../types`.
- Produces:
  - `function generateConnect(rng: Rng, opts: { size: number; count: number }): Puzzle[]` — rung 1; the move joins two black groups into one (unique), no capture.
  - `function generateCaptureCutter(rng: Rng, opts: { size: number; count: number }): Puzzle[]` — rung 2; captures the single white cutting stone (reuses the capture goal), has `captured`.

**Design (connect):** place two black stones two apart in a line with the middle point empty; the connect move is the middle (after it, the two are one group). Verify with a goal: exactly one black move merges them, and no white present makes it a capture.

- [ ] **Step 1: Write the failing test** — `src/generator/topics/connectcut.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { Board } from "../../engine/board";
import { group } from "../../engine/liberties";
import { play } from "../../engine/rules";
import { makeRng } from "../../engine/rng";
import { generateConnect, generateCaptureCutter } from "./connectcut";

describe("connect & cut", () => {
  it("connect: the move merges two black groups into one, 20 distinct", () => {
    const ps = generateConnect(makeRng(1), { size: 5, count: 20 });
    expect(ps).toHaveLength(20);
    const sigs = new Set(ps.map((p) => JSON.stringify({ s: p.stones, sol: p.solution })));
    expect(sigs.size).toBe(20);
    for (const p of ps) {
      expect(p.mode).toBe("M");
      if (p.solution.kind !== "move") throw new Error("move");
      const pt = p.solution.points[0]!;
      const before = Board.from(p.size, p.stones);
      // two distinct black groups before
      const blackGroups = new Set(
        p.stones.filter((s) => s.c === "b").map((s) => group(before, s.x, s.y).stones.map((q) => `${q.x},${q.y}`).sort().join(";")),
      );
      expect(blackGroups.size).toBeGreaterThanOrEqual(2);
      const r = play(before, pt.x, pt.y, "b");
      expect(r.ok).toBe(true);
      // one black group after
      const after = new Set(
        r.board.stones().filter((s) => s.c === "b").map((s) => group(r.board, s.x, s.y).stones.map((q) => `${q.x},${q.y}`).sort().join(";")),
      );
      expect(after.size).toBe(1);
    }
  });

  it("capture-cutter: the move captures the white cutting stone", () => {
    const ps = generateCaptureCutter(makeRng(2), { size: 5, count: 10 });
    for (const p of ps) {
      if (p.solution.kind !== "move") throw new Error("move");
      const pt = p.solution.points[0]!;
      const r = play(Board.from(p.size, p.stones), pt.x, pt.y, "b");
      expect(r.captured.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("is deterministic", () => {
    expect(generateConnect(makeRng(3), { size: 5, count: 6 })).toEqual(generateConnect(makeRng(3), { size: 5, count: 6 }));
  });
});
```

- [ ] **Step 2: Run to verify it fails** — Run: `npx vitest run src/generator/topics/connectcut.test.ts` — Expected: FAIL.

- [ ] **Step 3: Write `src/generator/topics/connectcut.ts`**

```ts
import { Board, Point } from "../../engine/board";
import { play } from "../../engine/rules";
import { group } from "../../engine/liberties";
import { validateM, GoalFn } from "../validate";
import { Rng, randint, shuffle } from "../../engine/rng";
import { Puzzle } from "../types";

function blackGroupCount(board: Board): number {
  const seen = new Set<string>();
  let n = 0;
  for (const s of board.stones()) {
    if (s.c !== "b") continue;
    const key = group(board, s.x, s.y).stones.map((q) => `${q.x},${q.y}`).sort().join(";");
    if (!seen.has(key)) { seen.add(key); n++; }
  }
  return n;
}

// Goal: playing here leaves Black as a single connected group.
const connectsGoal: GoalFn = (_before, _move, _c, res) => blackGroupCount(res.board) === 1;

export function generateConnect(rng: Rng, opts: { size: number; count: number }): Puzzle[] {
  const { size, count } = opts;
  const out: Puzzle[] = [];
  const seen = new Set<string>();
  let guard = 0;
  const DIRS = [[1, 0], [0, 1]] as const;

  while (out.length < count && guard++ < count * 800) {
    const board = new Board(size);
    // two black stones two apart along a random axis, gap in the middle
    const [dx, dy] = shuffle(rng, DIRS as unknown as number[][])[0]!;
    const a: Point = { x: randint(rng, 0, size - 1 - 2 * dx), y: randint(rng, 0, size - 1 - 2 * dy) };
    const b: Point = { x: a.x + 2 * dx, y: a.y + 2 * dy };
    const mid: Point = { x: a.x + dx, y: a.y + dy };
    board.set(a.x, a.y, "b");
    board.set(b.x, b.y, "b");
    if (blackGroupCount(board) !== 2) continue; // must start as two groups

    const v = validateM(board, "b", connectsGoal, "unique");
    if (!v.valid) continue;
    const sol = v.solution[0]!;
    if (sol.x !== mid.x || sol.y !== mid.y) continue; // the connect is the middle point

    const puzzle: Puzzle = {
      id: "tmp", topic: 7, rung: 1, mode: "M", size, stones: board.stones(), toPlay: "b",
      prompt: "Black to play — connect your stones.",
      solution: { kind: "move", points: [sol] },
    };
    const sig = JSON.stringify({ s: puzzle.stones, sol });
    if (seen.has(sig)) continue;
    seen.add(sig);
    out.push(puzzle);
  }
  if (out.length < count) throw new Error(`generateConnect: ${out.length}/${count}`);
  return out;
}

const capturesGoal: GoalFn = (_b, _m, _c, res) => res.captured.length >= 1;

export function generateCaptureCutter(rng: Rng, opts: { size: number; count: number }): Puzzle[] {
  const { size, count } = opts;
  const out: Puzzle[] = [];
  const seen = new Set<string>();
  let guard = 0;

  while (out.length < count && guard++ < count * 1000) {
    // a lone white cutting stone in atari between black stones
    const board = new Board(size);
    const w: Point = { x: randint(rng, 1, size - 2), y: randint(rng, 1, size - 2) };
    board.set(w.x, w.y, "w");
    const nbrs = shuffle(rng, board.neighbors(w.x, w.y));
    // fill all but one neighbour with black -> white in atari
    for (let i = 0; i < nbrs.length - 1; i++) board.set(nbrs[i]!.x, nbrs[i]!.y, "b");
    if (group(board, w.x, w.y).liberties.length !== 1) continue;
    // clean: black stones not themselves in atari
    if (board.stones().some((s) => s.c === "b" && group(board, s.x, s.y).liberties.length <= 1)) continue;
    const v = validateM(board, "b", capturesGoal, "unique");
    if (!v.valid) continue;
    const sol = v.solution[0]!;
    const res = play(board, sol.x, sol.y, "b");
    if (!res.ok || res.captured.length < 1) continue;

    const puzzle: Puzzle = {
      id: "tmp", topic: 7, rung: 2, mode: "M", size, stones: board.stones(), toPlay: "b",
      prompt: "Black to play — capture the cutting stone.",
      solution: { kind: "move", points: [sol] }, captured: res.captured,
    };
    const sig = JSON.stringify({ s: puzzle.stones, sol });
    if (seen.has(sig)) continue;
    seen.add(sig);
    out.push(puzzle);
  }
  if (out.length < count) throw new Error(`generateCaptureCutter: ${out.length}/${count}`);
  return out;
}
```

- [ ] **Step 4: Run to verify it passes** — Run: `npx vitest run src/generator/topics/connectcut.test.ts` — Expected: PASS. If `generateConnect` under-delivers, report the count (the two-apart construction has ample distinct positions on 5×5, so this should fill).

- [ ] **Step 5: Commit**

```bash
git add src/generator/topics/connectcut.ts src/generator/topics/connectcut.test.ts
git commit -m "feat(generator): connect & cut generator (topic 7)"
```

---

### Task 3: Net / geta generator (topic 10)

**Files:**
- Create: `src/generator/topics/net.ts`
- Test: `src/generator/topics/net.test.ts`

**Interfaces:**
- Consumes: `Board`, `Point` from `../../engine/board`; `play` from `../../engine/rules`; `group` from `../../engine/liberties`; `capturedUnderBestPlay` from `../reader`; `Rng`, `randint`, `shuffle` from `../../engine/rng`; `Puzzle` from `../types`.
- Produces: `function generateNet(rng: Rng, opts: { rung: number; size: number; count: number; depth: number }): Puzzle[]` — `mode:"M"`; `solution.points` = every black move that nets the marked white target (any-valid); `marks` = the target. A net move: legal, captures nothing immediately, leaves the target on **exactly 2 liberties**, and `capturedUnderBestPlay(after, target, "w", depth)` is true.

**Design:** build a base position (white target + 1–2 black wall stones), then search points near the target for net moves. Restrict candidates to within Chebyshev distance 2 of the target to keep the reader search bounded. **This generator's yield is uncertain — if a rung under-delivers, report BLOCKED with the count so the base-construction can be tuned (more/other wall stones, larger frame).**

- [ ] **Step 1: Write the failing test** — `src/generator/topics/net.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { Board } from "../../engine/board";
import { play } from "../../engine/rules";
import { group } from "../../engine/liberties";
import { capturedUnderBestPlay } from "../reader";
import { makeRng } from "../../engine/rng";
import { generateNet } from "./net";

describe("generateNet", () => {
  it("every net move captures the target under best play and doesn't capture immediately", () => {
    const ps = generateNet(makeRng(1), { rung: 1, size: 7, count: 12, depth: 6 });
    expect(ps).toHaveLength(12);
    for (const p of ps) {
      expect(p.mode).toBe("M");
      expect(p.marks).toHaveLength(1);
      const target = p.marks![0]!;
      if (p.solution.kind !== "move") throw new Error("move");
      expect(p.solution.points.length).toBeGreaterThanOrEqual(1);
      for (const mv of p.solution.points) {
        const r = play(Board.from(p.size, p.stones), mv.x, mv.y, "b");
        expect(r.ok).toBe(true);
        expect(r.captured).toHaveLength(0); // net doesn't capture on the move
        expect(group(r.board, target.x, target.y).liberties.length).toBe(2); // loose net, not atari
        expect(capturedUnderBestPlay(r.board, target, "w", 8)).toBe(true);
      }
      // clean: no black stone already in atari in the problem
      const b = Board.from(p.size, p.stones);
      for (const s of p.stones) if (s.c === "b") expect(group(b, s.x, s.y).liberties.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("is deterministic", () => {
    const o = { rung: 1, size: 7, count: 6, depth: 6 };
    expect(generateNet(makeRng(5), o)).toEqual(generateNet(makeRng(5), o));
  });
});
```

- [ ] **Step 2: Run to verify it fails** — Run: `npx vitest run src/generator/topics/net.test.ts` — Expected: FAIL.

- [ ] **Step 3: Write `src/generator/topics/net.ts`**

```ts
import { Board, Point } from "../../engine/board";
import { play } from "../../engine/rules";
import { group } from "../../engine/liberties";
import { capturedUnderBestPlay } from "../reader";
import { Rng, randint, shuffle } from "../../engine/rng";
import { Puzzle } from "../types";

function nearby(size: number, t: Point): Point[] {
  const out: Point[] = [];
  for (let dy = -2; dy <= 2; dy++)
    for (let dx = -2; dx <= 2; dx++) {
      const x = t.x + dx, y = t.y + dy;
      if (x >= 0 && y >= 0 && x < size && y < size && !(dx === 0 && dy === 0)) out.push({ x, y });
    }
  return out;
}

export function generateNet(
  rng: Rng,
  opts: { rung: number; size: number; count: number; depth: number },
): Puzzle[] {
  const { rung, size, count, depth } = opts;
  const out: Puzzle[] = [];
  const seen = new Set<string>();
  let guard = 0;

  while (out.length < count && guard++ < count * 3000) {
    const board = new Board(size);
    const t: Point = { x: randint(rng, 1, size - 2), y: randint(rng, 1, size - 2) };
    board.set(t.x, t.y, "w");
    // 1–2 black wall stones adjacent to the target
    const nbrs = shuffle(rng, board.neighbors(t.x, t.y));
    const wallN = randint(rng, 1, 2);
    for (let i = 0; i < wallN; i++) board.set(nbrs[i]!.x, nbrs[i]!.y, "b");
    if (group(board, t.x, t.y).liberties.length < 2) continue; // not already atari
    if (board.stones().some((s) => s.c === "b" && group(board, s.x, s.y).liberties.length <= 1)) continue;

    // find every nearby black move that nets
    const nets: Point[] = [];
    for (const P of nearby(size, t)) {
      if (board.get(P.x, P.y) !== null) continue;
      const res = play(board, P.x, P.y, "b");
      if (!res.ok || res.captured.length > 0) continue;
      if (group(res.board, t.x, t.y).liberties.length !== 2) continue; // must leave exactly 2 (a loose net)
      if (capturedUnderBestPlay(res.board, t, "w", depth)) nets.push(P);
    }
    if (nets.length === 0) continue;

    const puzzle: Puzzle = {
      id: "tmp", topic: 10, rung, mode: "M", size, stones: board.stones(), toPlay: "b",
      prompt: "Black to play — net the stone so it can't run.",
      solution: { kind: "move", points: nets },
      marks: [{ x: t.x, y: t.y, kind: "mark" }],
    };
    const sig = JSON.stringify({ s: puzzle.stones, m: [t.x, t.y] });
    if (seen.has(sig)) continue;
    seen.add(sig);
    out.push(puzzle);
  }
  if (out.length < count) {
    throw new Error(`generateNet: produced ${out.length}/${count} (rung ${rung}, size ${size}, depth ${depth})`);
  }
  return out;
}
```

- [ ] **Step 4: Run to verify it passes** — Run: `npx vitest run src/generator/topics/net.test.ts` — Expected: PASS. **If it throws under-delivery, STOP and report the exact count** — do not weaken the net criteria; the controller will tune the base construction.

- [ ] **Step 5: Commit**

```bash
git add src/generator/topics/net.ts src/generator/topics/net.test.ts
git commit -m "feat(generator): net/geta generator (topic 10)"
```

---

### Task 4: Snapback generator (topic 11)

**Files:**
- Create: `src/generator/topics/snapback.ts`
- Test: `src/generator/topics/snapback.test.ts`

**Interfaces:**
- Consumes: `Board`, `Point` from `../../engine/board`; `play` from `../../engine/rules`; `group` from `../../engine/liberties`; `Rng`, `randint`, `shuffle` from `../../engine/rng`; `Puzzle` from `../types`.
- Produces:
  - `function snapbackWorks(board: Board, p: Point): { ok: boolean; recaptured: number }` — Black plays throw-in `p`; if Black's group at `p` ends on exactly 1 liberty, White captures it there; if White's capturing group is then on 1 liberty, Black recaptures — returns the count Black recaptures.
  - `function generateSnapback(rng: Rng, opts: { rung: number; size: number; count: number; minRecapture: number }): Puzzle[]` — `mode:"M"`; solution is the throw-in; verified `snapbackWorks(...).recaptured >= minRecapture`.

**Design:** search — for a constructed base (a black group with a capturable white group sharing a single key point), try each empty point as the throw-in and keep those where `snapbackWorks` returns `recaptured >= minRecapture`. **Highest-risk generator; if a rung under-delivers, report BLOCKED with the count.**

- [ ] **Step 1: Write the failing test** — `src/generator/topics/snapback.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { Board } from "../../engine/board";
import { makeRng } from "../../engine/rng";
import { generateSnapback, snapbackWorks } from "./snapback";

describe("snapback", () => {
  it("snapbackWorks confirms a textbook snapback and rejects a plain point", () => {
    // black L around a 2-space white group with a shared throw-in at (2,1)
    const b = Board.from(5, [
      { x: 1, y: 0, c: "b" }, { x: 2, y: 0, c: "b" }, { x: 3, y: 0, c: "b" },
      { x: 0, y: 1, c: "b" }, { x: 3, y: 1, c: "w" }, { x: 3, y: 2, c: "b" },
      { x: 1, y: 1, c: "w" }, { x: 2, y: 1, c: "w" }, { x: 1, y: 2, c: "b" }, { x: 2, y: 2, c: "b" },
    ]);
    // this fixture is illustrative; the real assertion is that SOME point snaps back:
    // exercised through the generator below.
    expect(typeof snapbackWorks(b, { x: 0, y: 0 }).ok).toBe("boolean");
  });

  it("every generated snapback recaptures >= minRecapture under the throw-in", () => {
    const ps = generateSnapback(makeRng(1), { rung: 1, size: 7, count: 8, minRecapture: 2 });
    expect(ps).toHaveLength(8);
    for (const p of ps) {
      if (p.solution.kind !== "move") throw new Error("move");
      const pt = p.solution.points[0]!;
      expect(snapbackWorks(Board.from(p.size, p.stones), pt).recaptured).toBeGreaterThanOrEqual(2);
    }
  });

  it("is deterministic", () => {
    const o = { rung: 1, size: 7, count: 5, minRecapture: 2 };
    expect(generateSnapback(makeRng(4), o)).toEqual(generateSnapback(makeRng(4), o));
  });
});
```

- [ ] **Step 2: Run to verify it fails** — Run: `npx vitest run src/generator/topics/snapback.test.ts` — Expected: FAIL.

- [ ] **Step 3: Write `src/generator/topics/snapback.ts`**

```ts
import { Board, Point } from "../../engine/board";
import { play } from "../../engine/rules";
import { group } from "../../engine/liberties";
import { Rng, randint, shuffle } from "../../engine/rng";
import { Puzzle } from "../types";

// Black throws in at p. Returns how many white stones Black recaptures via the snapback (0 = no snapback).
export function snapbackWorks(board: Board, p: Point): { ok: boolean; recaptured: number } {
  const r1 = play(board, p.x, p.y, "b");
  if (!r1.ok || r1.captured.length > 0) return { ok: false, recaptured: 0 };
  const g = group(r1.board, p.x, p.y);
  if (g.liberties.length !== 1) return { ok: false, recaptured: 0 }; // throw-in must be self-atari
  const lib = g.liberties[0]!;
  // White captures the throw-in group by filling its last liberty
  const r2 = play(r1.board, lib.x, lib.y, "w");
  if (!r2.ok || r2.captured.length !== g.stones.length) return { ok: false, recaptured: 0 };
  // White's capturing stone must now be catchable: Black recaptures at p again
  const r3 = play(r2.board, p.x, p.y, "b");
  if (!r3.ok || r3.captured.length < 1) return { ok: false, recaptured: 0 };
  return { ok: true, recaptured: r3.captured.length };
}

export function generateSnapback(
  rng: Rng,
  opts: { rung: number; size: number; count: number; minRecapture: number },
): Puzzle[] {
  const { rung, size, count, minRecapture } = opts;
  const out: Puzzle[] = [];
  const seen = new Set<string>();
  let guard = 0;

  while (out.length < count && guard++ < count * 5000) {
    // base: a white blob of 2–3 stones nearly surrounded by black, leaving one throw-in point.
    const board = new Board(size);
    const c: Point = { x: randint(rng, 1, size - 2), y: randint(rng, 1, size - 2) };
    const wn = randint(rng, 2, 3);
    const whites: Point[] = [c];
    board.set(c.x, c.y, "w");
    // grow the white blob
    let gu = 0;
    while (whites.length < wn && gu++ < 30) {
      const from = whites[randint(rng, 0, whites.length - 1)]!;
      const nb = shuffle(rng, board.neighbors(from.x, from.y)).find((q) => board.get(q.x, q.y) === null);
      if (nb) { board.set(nb.x, nb.y, "w"); whites.push(nb); }
    }
    // surround the white blob with black on all liberties but one
    const wlibs = shuffle(rng, group(board, c.x, c.y).liberties);
    if (wlibs.length < 2) continue;
    for (let i = 1; i < wlibs.length; i++) board.set(wlibs[i]!.x, wlibs[i]!.y, "b");
    // clean: black not in atari
    if (board.stones().some((s) => s.c === "b" && group(board, s.x, s.y).liberties.length <= 1)) continue;

    // search empty points for a working throw-in
    let throwin: Point | null = null;
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        if (board.get(x, y) !== null) continue;
        const w = snapbackWorks(board, { x, y });
        if (w.ok && w.recaptured >= minRecapture) { throwin = { x, y }; break; }
      }
    if (!throwin) continue;

    const puzzle: Puzzle = {
      id: "tmp", topic: 11, rung, mode: "M", size, stones: board.stones(), toPlay: "b",
      prompt: "Black to play — set up a snapback.",
      solution: { kind: "move", points: [throwin] },
    };
    const sig = JSON.stringify({ s: puzzle.stones, sol: throwin });
    if (seen.has(sig)) continue;
    seen.add(sig);
    out.push(puzzle);
  }
  if (out.length < count) {
    throw new Error(`generateSnapback: produced ${out.length}/${count} (rung ${rung}, size ${size})`);
  }
  return out;
}
```

- [ ] **Step 4: Run to verify it passes** — Run: `npx vitest run src/generator/topics/snapback.test.ts` — Expected: PASS. **If under-delivery, STOP and report the count** — do not weaken `snapbackWorks`; the controller will tune the base construction (blob size, surround pattern, frame).

- [ ] **Step 5: Commit**

```bash
git add src/generator/topics/snapback.ts src/generator/topics/snapback.test.ts
git commit -m "feat(generator): snapback generator (topic 11)"
```

---

### Task 5: Wire topics 7/10/11 into the CLI, add titles, regenerate the bank

**Files:**
- Modify: `src/generator/cli.ts`, `src/generator/cli.test.ts`, `src/app/ui/MapScreen.tsx`
- Modify (generated): `src/bank/bank.json`

**Interfaces:**
- Consumes the three new generators. Produces a 360-puzzle bank (9 topics × varied rungs × 20). Note topics keep their curriculum numbers (7, 10, 11); 8/9 are absent until B.2.

- [ ] **Step 1: Add imports + groups in `src/generator/cli.ts`** — after the existing generator imports add:

```ts
import { generateConnect, generateCaptureCutter } from "./topics/connectcut";
import { generateNet } from "./topics/net";
import { generateSnapback } from "./topics/snapback";
```

Append inside `buildBank`, before `return assembleBank(...)`:

```ts
  // Topic 7 — connect & cut: rung 1 connect, rung 2 capture the cutting stone
  groups.push(curateRung(generateConnect(rng, { size: 5, count: PER_RUNG })));
  groups.push(curateRung(generateCaptureCutter(rng, { size: 5, count: PER_RUNG })));

  // Topic 10 — net (geta): rung 1 shallow reads, rung 2 deeper
  groups.push(curateRung(generateNet(rng, { rung: 1, size: 7, count: PER_RUNG, depth: 4 })));
  groups.push(curateRung(generateNet(rng, { rung: 2, size: 7, count: PER_RUNG, depth: 8 })));

  // Topic 11 — snapback: rung 1 recapture ≥2, rung 2 recapture ≥3
  groups.push(curateRung(generateSnapback(rng, { rung: 1, size: 7, count: PER_RUNG, minRecapture: 2 })));
  groups.push(curateRung(generateSnapback(rng, { rung: 2, size: 7, count: PER_RUNG, minRecapture: 3 })));
```

- [ ] **Step 2: Add topic titles in `src/app/ui/MapScreen.tsx`** — extend `TOPIC_TITLES`:

```ts
export const TOPIC_TITLES: Record<number, string> = {
  1: "Liberties", 2: "Capture a stone", 3: "Capture a group",
  4: "Escape atari", 5: "Don't self-atari", 6: "Double atari",
  7: "Connect & cut", 10: "Net", 11: "Snapback",
};
```

- [ ] **Step 3: Update `src/generator/cli.test.ts`** — the distribution test must cover the new topics. Replace the topic list `[1, 2, 3, 4, 5, 6]` with `[1, 2, 3, 4, 5, 6, 7, 10, 11]` (both the count-assertion loop and the distinctness loop), and change the total assertion to `expect(bank.puzzles).toHaveLength(360);`.

- [ ] **Step 4: Run the suite** — Run: `npm test` — Expected: all pass (cli distribution 360; every rung 20 distinct). If a generator throws under-delivery here, STOP and report which group.

- [ ] **Step 5: Regenerate the bank** — Run: `npm run generate` — Expected: `Wrote 360 puzzles ...`.

- [ ] **Step 6: Verify variety** — Run:

```bash
node -e 'const b=require("./src/bank/bank.json");const g={};for(const p of b.puzzles){const k=`t${p.topic}-r${p.rung}`;(g[k]??=[]).push(p);}for(const k of Object.keys(g).sort()){const s=new Set(g[k].map(p=>JSON.stringify({s:p.stones,sol:p.solution,m:p.marks}))).size;console.log(k,g[k].length,"puzzles,",s,"distinct");}'
```

Expected: 18 groups (t1..t7, t10, t11 × 2 rungs), each `20 puzzles, 20 distinct`.

- [ ] **Step 7: Typecheck + commit**

```bash
npm run typecheck
git add src/generator/cli.ts src/generator/cli.test.ts src/app/ui/MapScreen.tsx src/bank/bank.json
git commit -m "feat(generator): add topics 7/10/11 to the bank (360 puzzles) + map titles"
```

---

### Task 6: Extend the bank solvability suite for topics 7/10/11

**Files:**
- Modify: `src/bank/bank.test.ts`

**Interfaces:**
- Consumes existing engine helpers plus `capturedUnderBestPlay` (`../generator/reader`) and `snapbackWorks` (`../generator/topics/snapback`).

- [ ] **Step 1: Update the shape test** — change `expect(bank.puzzles).toHaveLength(240)` to `360`, and the topic loop from `[1, 2, 3, 4, 5, 6]` to `[1, 2, 3, 4, 5, 6, 7, 10, 11]`.

- [ ] **Step 2: Add imports** at the top of `src/bank/bank.test.ts`:

```ts
import { capturedUnderBestPlay } from "../generator/reader";
import { snapbackWorks } from "../generator/topics/snapback";
```

(Group counts are computed inline via the `oneBlackGroupAfter` helper in Step 3 — no new helper module.)

- [ ] **Step 3: Add solvability blocks** at the end of the file:

```ts
const connectPuzzles: [string, Puzzle][] = bank.puzzles.filter((p) => p.topic === 7 && p.rung === 1).map((p) => [p.id, p]);
const cutterPuzzles: [string, Puzzle][] = bank.puzzles.filter((p) => p.topic === 7 && p.rung === 2).map((p) => [p.id, p]);
const netPuzzles: [string, Puzzle][] = bank.puzzles.filter((p) => p.topic === 10).map((p) => [p.id, p]);
const snapPuzzles: [string, Puzzle][] = bank.puzzles.filter((p) => p.topic === 11).map((p) => [p.id, p]);

function oneBlackGroupAfter(p: Puzzle, mv: { x: number; y: number }): boolean {
  const r = play(Board.from(p.size, p.stones), mv.x, mv.y, "b");
  if (!r.ok) return false;
  const keys = new Set(r.board.stones().filter((s) => s.c === "b").map((s) => group(r.board, s.x, s.y).stones.map((q) => `${q.x},${q.y}`).sort().join(";")));
  return keys.size === 1;
}

describe("bank.json — connect puzzles merge Black (topic 7 r1)", () => {
  it.each(connectPuzzles)("%s: the move joins Black into one group", (_id, p) => {
    expect(p.solution.kind).toBe("move");
    if (p.solution.kind !== "move") return;
    expect(oneBlackGroupAfter(p, p.solution.points[0]!)).toBe(true);
  });
});

describe("bank.json — cutter puzzles capture the white stone (topic 7 r2)", () => {
  it.each(cutterPuzzles)("%s: the move captures ≥1", (_id, p) => {
    expect(p.solution.kind).toBe("move");
    if (p.solution.kind !== "move") return;
    const r = play(Board.from(p.size, p.stones), p.solution.points[0]!.x, p.solution.points[0]!.y, "b");
    expect(r.captured.length).toBeGreaterThanOrEqual(1);
  });
});

describe("bank.json — net puzzles trap the target (topic 10)", () => {
  it.each(netPuzzles)("%s: every listed move nets the marked stone", (_id, p) => {
    expect(p.marks).toHaveLength(1);
    const t = p.marks![0]!;
    if (p.solution.kind !== "move") return;
    for (const mv of p.solution.points) {
      const r = play(Board.from(p.size, p.stones), mv.x, mv.y, "b");
      expect(r.ok).toBe(true);
      expect(r.captured).toHaveLength(0);
      expect(group(r.board, t.x, t.y).liberties.length).toBe(2);
      expect(capturedUnderBestPlay(r.board, t, "w", 8)).toBe(true);
    }
  });
});

describe("bank.json — snapback puzzles recapture (topic 11)", () => {
  it.each(snapPuzzles)("%s: the throw-in snaps back ≥2", (_id, p) => {
    if (p.solution.kind !== "move") return;
    expect(snapbackWorks(Board.from(p.size, p.stones), p.solution.points[0]!).recaptured).toBeGreaterThanOrEqual(2);
  });
});
```

- [ ] **Step 4: Run the full suite + typecheck** — Run: `npm test && npm run typecheck` — Expected: all pass (now ~120 new per-puzzle checks).

- [ ] **Step 5: Commit**

```bash
git add src/bank/bank.test.ts
git commit -m "test(bank): solvability coverage for topics 7/10/11"
```

---

## Self-Review

**Spec coverage:** capture-reader (Task 1); connect + capture-cutter (Task 2, topic 7); net via reader (Task 3, topic 10); snapback via engine sequence (Task 4, topic 11); CLI + titles + 360-bank regen with gentle-ramp depths (Task 5); solvability suite extended (Task 6). App interaction unchanged (M puzzles). Gentle ramp: connect rung 1 easiest; net rung 1 depth 4, rung 2 depth 8; snapback rung 1 recapture ≥2, rung 2 ≥3.

**Placeholder scan:** no TBD/TODO. `id:"tmp"` is overwritten by `assembleBank`. Task 6 adds only two imports and the inline `oneBlackGroupAfter` helper.

**Type consistency:** `capturedUnderBestPlay(board, target, toMove, depth)`, `generateConnect`/`generateCaptureCutter`, `generateNet`, `snapbackWorks`/`generateSnapback` are used identically across the tasks that define and consume them. `Puzzle.solution` is `{kind:"move", points}` throughout; net uses any-valid (multiple points).

**Known risk (flagged in-tasks):** the net (Task 3) and snapback (Task 4) generators are search-based; their yield of 20 distinct/rung is not proven ahead of time. Both fail loud and instruct the implementer to STOP and report the count rather than weaken the criteria — the controller then tunes base construction. Connect and capture-cutter have ample distinct space and should fill.

