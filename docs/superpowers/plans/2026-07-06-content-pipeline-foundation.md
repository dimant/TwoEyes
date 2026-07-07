# Content Pipeline (Foundation + Topics 1–3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the deterministic, build-time content pipeline — a minimal go rules engine, a generate-then-validate loop, and generators for Stage A topics 1–3 — that emits a committed `src/bank/bank.json`.

**Architecture:** Pure TypeScript, no framework. A small immutable-ish `Board` + rules functions (liberties, capture, legality) power a validator that enumerates every legal move to confirm a puzzle's solution and uniqueness policy. Per-topic generators propose positions with a seeded RNG and keep only validated ones. A CLI assembles topics into `bank.json`, which is committed to the repo (the app bundles it unchanged; builds never regenerate).

**Tech Stack:** Node ≥20, TypeScript (ESM), Vitest, `tsx` for running the CLI.

## Global Constraints

- **Public-domain content only** — this pipeline generates all content; no external problem data.
- **Build-time only** — this engine never ships to the client; the app reads `bank.json` and does no go logic.
- **Deterministic** — generation uses a **seeded RNG** (`mulberry32`); the same seed produces the same bank. No `Math.random`, no `Date.now`.
- **Board = local frames**, `size` between **5 and 7** inclusive.
- **20 validated puzzles per rung.**
- **Solution policy:** `unique` for all Stage A M-topics (exactly one goal-achieving move); `any-valid` reserved for escape (topic 4, later plan).
- **Module system:** ESM (`"type": "module"`), TypeScript `moduleResolution: "bundler"`, all local imports omit extensions.

---

### Task 1: Repo toolchain

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`
- Test: `src/engine/smoke.test.ts`

**Interfaces:**
- Produces: a working `npm test` (Vitest) and `npm run generate` script wired to `src/generator/cli.ts` (created in Task 10).

- [ ] **Step 1: Create `.gitignore`**

```
node_modules/
dist/
*.log
.DS_Store
```

- [ ] **Step 2: Create `package.json`**

```json
{
  "name": "go-beginners",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "generate": "tsx src/generator/cli.ts"
  },
  "devDependencies": {
    "@types/node": "^20.11.0",
    "tsx": "^4.7.0",
    "typescript": "^5.4.0",
    "vitest": "^1.4.0"
  }
}
```

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["node"]
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { include: ["src/**/*.test.ts"] },
});
```

- [ ] **Step 5: Write a smoke test at `src/engine/smoke.test.ts`**

```ts
import { describe, it, expect } from "vitest";

describe("toolchain", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 6: Install and run**

Run: `npm install && npm test`
Expected: 1 passing test.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: toolchain (ts, vitest, tsx)"
```

---

### Task 2: Board model

**Files:**
- Create: `src/engine/board.ts`
- Test: `src/engine/board.test.ts`

**Interfaces:**
- Produces:
  - `type Color = "b" | "w"`, `type Cell = Color | null`, `interface Point { x: number; y: number }`, `interface Stone extends Point { c: Color }`
  - `class Board` with: `constructor(size: number)`, `readonly size`, `inBounds(x,y): boolean`, `get(x,y): Cell`, `set(x,y,c: Cell): void`, `clone(): Board`, `neighbors(x,y): Point[]`, `stones(): Stone[]`, `static from(size: number, stones: Stone[]): Board`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { Board } from "./board";

describe("Board", () => {
  it("sets and gets stones", () => {
    const b = new Board(5);
    b.set(2, 2, "b");
    expect(b.get(2, 2)).toBe("b");
    expect(b.get(0, 0)).toBeNull();
  });

  it("reports bounds", () => {
    const b = new Board(5);
    expect(b.inBounds(0, 0)).toBe(true);
    expect(b.inBounds(4, 4)).toBe(true);
    expect(b.inBounds(5, 0)).toBe(false);
    expect(b.inBounds(-1, 0)).toBe(false);
  });

  it("lists orthogonal neighbours, clipped to the board", () => {
    const b = new Board(5);
    expect(b.neighbors(0, 0)).toEqual([{ x: 1, y: 0 }, { x: 0, y: 1 }]);
    expect(b.neighbors(2, 2).length).toBe(4);
  });

  it("clone is independent", () => {
    const b = new Board(5);
    b.set(1, 1, "w");
    const c = b.clone();
    c.set(1, 1, null);
    expect(b.get(1, 1)).toBe("w");
    expect(c.get(1, 1)).toBeNull();
  });

  it("from() builds a board and stones() reads it back", () => {
    const b = Board.from(5, [{ x: 0, y: 0, c: "b" }, { x: 4, y: 4, c: "w" }]);
    expect(b.stones()).toEqual([{ x: 0, y: 0, c: "b" }, { x: 4, y: 4, c: "w" }]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/board.test.ts`
Expected: FAIL — cannot find module `./board`.

- [ ] **Step 3: Write minimal implementation**

```ts
export type Color = "b" | "w";
export type Cell = Color | null;
export interface Point { x: number; y: number; }
export interface Stone extends Point { c: Color; }

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

export class Board {
  readonly size: number;
  private grid: Cell[];

  constructor(size: number) {
    this.size = size;
    this.grid = new Array(size * size).fill(null);
  }

  static from(size: number, stones: Stone[]): Board {
    const b = new Board(size);
    for (const s of stones) b.set(s.x, s.y, s.c);
    return b;
  }

  private idx(x: number, y: number): number { return y * this.size + x; }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.size && y < this.size;
  }

  get(x: number, y: number): Cell { return this.grid[this.idx(x, y)] ?? null; }

  set(x: number, y: number, c: Cell): void { this.grid[this.idx(x, y)] = c; }

  clone(): Board {
    const b = new Board(this.size);
    b.grid = this.grid.slice();
    return b;
  }

  neighbors(x: number, y: number): Point[] {
    const out: Point[] = [];
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy;
      if (this.inBounds(nx, ny)) out.push({ x: nx, y: ny });
    }
    return out;
  }

  stones(): Stone[] {
    const out: Stone[] = [];
    for (let y = 0; y < this.size; y++)
      for (let x = 0; x < this.size; x++) {
        const c = this.get(x, y);
        if (c) out.push({ x, y, c });
      }
    return out;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/board.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/engine/board.ts src/engine/board.test.ts
git commit -m "feat(engine): board model"
```

---

### Task 3: Liberties (flood-fill)

**Files:**
- Create: `src/engine/liberties.ts`
- Test: `src/engine/liberties.test.ts`

**Interfaces:**
- Consumes: `Board`, `Point`, `Color` from `./board`.
- Produces:
  - `interface GroupInfo { stones: Point[]; liberties: Point[]; }`
  - `function group(board: Board, x: number, y: number): GroupInfo` (empty arrays if the point is empty)
  - `function libertyCount(board: Board, x: number, y: number): number`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { Board } from "./board";
import { group, libertyCount } from "./liberties";

describe("liberties", () => {
  it("counts 4 for a lone stone in the centre", () => {
    const b = Board.from(5, [{ x: 2, y: 2, c: "b" }]);
    expect(libertyCount(b, 2, 2)).toBe(4);
  });

  it("counts 3 on the edge and 2 in the corner", () => {
    expect(libertyCount(Board.from(5, [{ x: 0, y: 2, c: "b" }]), 0, 2)).toBe(3);
    expect(libertyCount(Board.from(5, [{ x: 0, y: 0, c: "b" }]), 0, 0)).toBe(2);
  });

  it("shares liberties across a connected group", () => {
    const b = Board.from(5, [{ x: 2, y: 2, c: "b" }, { x: 2, y: 3, c: "b" }]);
    const g = group(b, 2, 2);
    expect(g.stones.length).toBe(2);
    expect(g.liberties.length).toBe(6);
  });

  it("subtracts enemy contact", () => {
    const b = Board.from(5, [{ x: 2, y: 2, c: "b" }, { x: 2, y: 1, c: "w" }]);
    expect(libertyCount(b, 2, 2)).toBe(3);
  });

  it("returns empty info for an empty point", () => {
    expect(group(new Board(5), 1, 1)).toEqual({ stones: [], liberties: [] });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/liberties.test.ts`
Expected: FAIL — cannot find module `./liberties`.

- [ ] **Step 3: Write minimal implementation**

```ts
import { Board, Point, Color } from "./board";

export interface GroupInfo { stones: Point[]; liberties: Point[]; }

export function group(board: Board, x: number, y: number): GroupInfo {
  const color = board.get(x, y);
  if (!color) return { stones: [], liberties: [] };

  const seen = new Set<string>();
  const libSeen = new Set<string>();
  const stones: Point[] = [];
  const liberties: Point[] = [];
  const stack: Point[] = [{ x, y }];
  seen.add(`${x},${y}`);

  while (stack.length) {
    const p = stack.pop() as Point;
    stones.push(p);
    for (const n of board.neighbors(p.x, p.y)) {
      const key = `${n.x},${n.y}`;
      const c = board.get(n.x, n.y);
      if (c === null) {
        if (!libSeen.has(key)) { libSeen.add(key); liberties.push(n); }
      } else if (c === (color as Color) && !seen.has(key)) {
        seen.add(key);
        stack.push(n);
      }
    }
  }
  return { stones, liberties };
}

export function libertyCount(board: Board, x: number, y: number): number {
  return group(board, x, y).liberties.length;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/liberties.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/engine/liberties.ts src/engine/liberties.test.ts
git commit -m "feat(engine): liberties flood-fill"
```

---

### Task 4: Rules (play, capture, suicide)

**Files:**
- Create: `src/engine/rules.ts`
- Test: `src/engine/rules.test.ts`

**Interfaces:**
- Consumes: `Board`, `Color`, `Point` from `./board`; `group` from `./liberties`.
- Produces:
  - `function opposite(c: Color): Color`
  - `interface PlayResult { ok: boolean; board: Board; captured: Point[]; reason?: string; }`
  - `function play(board: Board, x: number, y: number, color: Color): PlayResult` — returns a **new** board on success (input unmutated); resolves opponent captures; rejects `occupied`, `out-of-bounds`, and `suicide` (a move with no liberties that captures nothing).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { Board } from "./board";
import { play, opposite } from "./rules";

describe("rules.play", () => {
  it("opposite flips colour", () => {
    expect(opposite("b")).toBe("w");
    expect(opposite("w")).toBe("b");
  });

  it("captures a stone with one liberty and does not mutate the input", () => {
    // white at 2,2 in atari; black plays its last liberty 2,3
    const b = Board.from(5, [
      { x: 2, y: 2, c: "w" }, { x: 1, y: 2, c: "b" },
      { x: 3, y: 2, c: "b" }, { x: 2, y: 1, c: "b" },
    ]);
    const r = play(b, 2, 3, "b");
    expect(r.ok).toBe(true);
    expect(r.captured).toEqual([{ x: 2, y: 2 }]);
    expect(r.board.get(2, 2)).toBeNull();
    expect(b.get(2, 2)).toBe("w"); // original untouched
  });

  it("captures a two-stone group at once", () => {
    const b = Board.from(5, [
      { x: 2, y: 2, c: "w" }, { x: 2, y: 3, c: "w" },
      { x: 1, y: 2, c: "b" }, { x: 3, y: 2, c: "b" }, { x: 2, y: 1, c: "b" },
      { x: 1, y: 3, c: "b" }, { x: 3, y: 3, c: "b" },
    ]);
    const r = play(b, 2, 4, "b");
    expect(r.ok).toBe(true);
    expect(r.captured).toHaveLength(2);
  });

  it("rejects occupied points", () => {
    const b = Board.from(5, [{ x: 1, y: 1, c: "b" }]);
    expect(play(b, 1, 1, "w").ok).toBe(false);
  });

  it("rejects suicide that captures nothing", () => {
    // black surrounds 0,0; white plays into 0,0 with no capture
    const b = Board.from(5, [{ x: 1, y: 0, c: "b" }, { x: 0, y: 1, c: "b" }]);
    const r = play(b, 0, 0, "w");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("suicide");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/rules.test.ts`
Expected: FAIL — cannot find module `./rules`.

- [ ] **Step 3: Write minimal implementation**

```ts
import { Board, Color, Point } from "./board";
import { group } from "./liberties";

export function opposite(c: Color): Color { return c === "b" ? "w" : "b"; }

export interface PlayResult {
  ok: boolean;
  board: Board;
  captured: Point[];
  reason?: string;
}

export function play(board: Board, x: number, y: number, color: Color): PlayResult {
  if (!board.inBounds(x, y)) return { ok: false, board, captured: [], reason: "out-of-bounds" };
  if (board.get(x, y) !== null) return { ok: false, board, captured: [], reason: "occupied" };

  const next = board.clone();
  next.set(x, y, color);
  const opp = opposite(color);
  const captured: Point[] = [];

  for (const n of next.neighbors(x, y)) {
    if (next.get(n.x, n.y) === opp) {
      const g = group(next, n.x, n.y);
      if (g.liberties.length === 0) {
        for (const s of g.stones) next.set(s.x, s.y, null);
        captured.push(...g.stones);
      }
    }
  }

  if (captured.length === 0 && group(next, x, y).liberties.length === 0) {
    return { ok: false, board, captured: [], reason: "suicide" };
  }
  return { ok: true, board: next, captured };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/rules.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/engine/rules.ts src/engine/rules.test.ts
git commit -m "feat(engine): play with capture and suicide rules"
```

---

### Task 5: Seeded RNG

**Files:**
- Create: `src/engine/rng.ts`
- Test: `src/engine/rng.test.ts`

**Interfaces:**
- Produces:
  - `type Rng = () => number` (float in [0,1))
  - `function makeRng(seed: number): Rng` (mulberry32 — deterministic)
  - `function randint(rng: Rng, lo: number, hi: number): number` (inclusive)
  - `function pick<T>(rng: Rng, arr: T[]): T`
  - `function shuffle<T>(rng: Rng, arr: T[]): T[]` (returns a new array)

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { makeRng, randint, pick, shuffle } from "./rng";

describe("rng", () => {
  it("is deterministic for a given seed", () => {
    const a = makeRng(42), b = makeRng(42);
    const seqA = [a(), a(), a()];
    const seqB = [b(), b(), b()];
    expect(seqA).toEqual(seqB);
  });

  it("different seeds differ", () => {
    expect(makeRng(1)()).not.toBe(makeRng(2)());
  });

  it("randint stays in inclusive range", () => {
    const r = makeRng(7);
    for (let i = 0; i < 200; i++) {
      const v = randint(r, 3, 6);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(6);
    }
  });

  it("shuffle keeps all elements and is deterministic", () => {
    const s = shuffle(makeRng(9), [1, 2, 3, 4, 5]);
    expect([...s].sort()).toEqual([1, 2, 3, 4, 5]);
    expect(shuffle(makeRng(9), [1, 2, 3, 4, 5])).toEqual(s);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/rng.test.ts`
Expected: FAIL — cannot find module `./rng`.

- [ ] **Step 3: Write minimal implementation**

```ts
export type Rng = () => number;

export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randint(rng: Rng, lo: number, hi: number): number {
  return lo + Math.floor(rng() * (hi - lo + 1));
}

export function pick<T>(rng: Rng, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)] as T;
}

export function shuffle<T>(rng: Rng, arr: T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/rng.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/engine/rng.ts src/engine/rng.test.ts
git commit -m "feat(engine): seeded rng utilities"
```

---

### Task 6: Validator

**Files:**
- Create: `src/generator/validate.ts`
- Test: `src/generator/validate.test.ts`

**Interfaces:**
- Consumes: `Board`, `Point`, `Color` from `../engine/board`; `play`, `PlayResult` from `../engine/rules`.
- Produces:
  - `type Policy = "unique" | "any-valid"`
  - `type GoalFn = (before: Board, move: Point, color: Color, res: PlayResult) => boolean`
  - `function goalMoves(board: Board, color: Color, goal: GoalFn): Point[]` — every legal move whose result satisfies `goal`.
  - `function validateM(board: Board, color: Color, goal: GoalFn, policy: Policy): { valid: boolean; solution: Point[] }` — `unique`: valid iff exactly one goal move; `any-valid`: valid iff ≥1, solution = all of them.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { Board } from "../engine/board";
import { PlayResult } from "../engine/rules";
import { goalMoves, validateM, GoalFn } from "./validate";

const captures: GoalFn = (_b, _m, _c, res: PlayResult) => res.captured.length >= 1;

describe("validateM", () => {
  it("finds the single capturing move (unique)", () => {
    const b = Board.from(5, [
      { x: 2, y: 2, c: "w" }, { x: 1, y: 2, c: "b" },
      { x: 3, y: 2, c: "b" }, { x: 2, y: 1, c: "b" },
    ]);
    const moves = goalMoves(b, "b", captures);
    expect(moves).toEqual([{ x: 2, y: 3 }]);
    expect(validateM(b, "b", captures, "unique")).toEqual({
      valid: true, solution: [{ x: 2, y: 3 }],
    });
  });

  it("rejects a position where two moves capture (not unique)", () => {
    // two separate white stones each in atari -> two capturing moves
    const b = Board.from(5, [
      { x: 1, y: 1, c: "w" }, { x: 0, y: 1, c: "b" }, { x: 1, y: 0, c: "b" }, { x: 2, y: 1, c: "b" },
      { x: 3, y: 3, c: "w" }, { x: 2, y: 3, c: "b" }, { x: 3, y: 2, c: "b" }, { x: 4, y: 3, c: "b" },
    ]);
    // 1,1 last liberty (1,2); 3,3 last liberty (3,4)
    expect(validateM(b, "b", captures, "unique").valid).toBe(false);
  });

  it("any-valid returns the full solution set", () => {
    const b = Board.from(5, [
      { x: 1, y: 1, c: "w" }, { x: 0, y: 1, c: "b" }, { x: 1, y: 0, c: "b" }, { x: 2, y: 1, c: "b" },
      { x: 3, y: 3, c: "w" }, { x: 2, y: 3, c: "b" }, { x: 3, y: 2, c: "b" }, { x: 4, y: 3, c: "b" },
    ]);
    const r = validateM(b, "b", captures, "any-valid");
    expect(r.valid).toBe(true);
    expect(r.solution).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/generator/validate.test.ts`
Expected: FAIL — cannot find module `./validate`.

- [ ] **Step 3: Write minimal implementation**

```ts
import { Board, Point, Color } from "../engine/board";
import { play, PlayResult } from "../engine/rules";

export type Policy = "unique" | "any-valid";
export type GoalFn = (before: Board, move: Point, color: Color, res: PlayResult) => boolean;

export function goalMoves(board: Board, color: Color, goal: GoalFn): Point[] {
  const out: Point[] = [];
  for (let y = 0; y < board.size; y++)
    for (let x = 0; x < board.size; x++) {
      if (board.get(x, y) !== null) continue;
      const res = play(board, x, y, color);
      if (res.ok && goal(board, { x, y }, color, res)) out.push({ x, y });
    }
  return out;
}

export function validateM(
  board: Board, color: Color, goal: GoalFn, policy: Policy,
): { valid: boolean; solution: Point[] } {
  const moves = goalMoves(board, color, goal);
  if (moves.length === 0) return { valid: false, solution: [] };
  if (policy === "unique") return { valid: moves.length === 1, solution: moves };
  return { valid: true, solution: moves };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/generator/validate.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/generator/validate.ts src/generator/validate.test.ts
git commit -m "feat(generator): move validator with uniqueness policy"
```

---

### Task 7: Puzzle types & bank writer

**Files:**
- Create: `src/generator/types.ts`, `src/generator/bank.ts`
- Test: `src/generator/bank.test.ts`

**Interfaces:**
- Consumes: `Stone`, `Point`, `Color` from `../engine/board`.
- Produces (in `types.ts`):
  - `type Mode = "M" | "Q-count" | "Q-choice" | "Q-binary"`
  - `interface Mark { x: number; y: number; kind: "mark" | "target" | "atari" }`
  - `interface Puzzle { id: string; topic: number; rung: number; mode: Mode; size: number; stones: Stone[]; toPlay: Color; prompt: string; solution: SolutionSpec; captured?: Point[]; ataris?: Point[]; marks?: Mark[]; }`
  - `type SolutionSpec = { kind: "move"; points: Point[] } | { kind: "value"; value: number } | { kind: "choice"; id: string }`
  - `interface Bank { seed: number; stage: string; puzzles: Puzzle[]; }`
- Produces (in `bank.ts`):
  - `function assembleBank(seed: number, groups: Puzzle[][]): Bank` (flattens, assigns stable `id`s `t{topic}-r{rung}-{n}`)
  - `function writeBank(bank: Bank, path: string): void` (pretty JSON, trailing newline)

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { assembleBank } from "./bank";
import { Puzzle } from "./types";

const mk = (topic: number, rung: number): Puzzle => ({
  id: "tmp", topic, rung, mode: "M", size: 5,
  stones: [{ x: 2, y: 2, c: "w" }], toPlay: "b", prompt: "x",
  solution: { kind: "move", points: [{ x: 2, y: 3 }] },
});

describe("assembleBank", () => {
  it("flattens groups and assigns stable ids", () => {
    const bank = assembleBank(1, [[mk(1, 1), mk(1, 1)], [mk(2, 1)]]);
    expect(bank.seed).toBe(1);
    expect(bank.puzzles.map((p) => p.id)).toEqual(["t1-r1-0", "t1-r1-1", "t2-r1-0"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/generator/bank.test.ts`
Expected: FAIL — cannot find module `./bank`.

- [ ] **Step 3: Write `types.ts`**

```ts
import { Stone, Point, Color } from "../engine/board";

export type Mode = "M" | "Q-count" | "Q-choice" | "Q-binary";

export interface Mark { x: number; y: number; kind: "mark" | "target" | "atari"; }

export type SolutionSpec =
  | { kind: "move"; points: Point[] }
  | { kind: "value"; value: number }
  | { kind: "choice"; id: string };

export interface Puzzle {
  id: string;
  topic: number;
  rung: number;
  mode: Mode;
  size: number;
  stones: Stone[];
  toPlay: Color;
  prompt: string;
  solution: SolutionSpec;
  captured?: Point[];
  ataris?: Point[];
  marks?: Mark[];
}

export interface Bank { seed: number; stage: string; puzzles: Puzzle[]; }
```

- [ ] **Step 4: Write `bank.ts`**

```ts
import { writeFileSync } from "node:fs";
import { Bank, Puzzle } from "./types";

export function assembleBank(seed: number, groups: Puzzle[][]): Bank {
  const puzzles: Puzzle[] = [];
  for (const group of groups) {
    const counters = new Map<string, number>();
    for (const p of group) {
      const key = `t${p.topic}-r${p.rung}`;
      const n = counters.get(key) ?? 0;
      counters.set(key, n + 1);
      puzzles.push({ ...p, id: `${key}-${n}` });
    }
  }
  return { seed, stage: "A", puzzles };
}

export function writeBank(bank: Bank, path: string): void {
  writeFileSync(path, JSON.stringify(bank, null, 2) + "\n");
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/generator/bank.test.ts`
Expected: PASS (1 test).

- [ ] **Step 6: Commit**

```bash
git add src/generator/types.ts src/generator/bank.ts src/generator/bank.test.ts
git commit -m "feat(generator): puzzle types and bank writer"
```

---

### Task 8: Topic 2 & 3 generator (atari / capture)

**Files:**
- Create: `src/generator/topics/atari.ts`
- Test: `src/generator/topics/atari.test.ts`

**Interfaces:**
- Consumes: `Board`, `Stone`, `Point` from `../../engine/board`; `play` from `../../engine/rules`; `group` from `../../engine/liberties`; `validateM`, `GoalFn` from `../validate`; `Rng`, `makeRng`, `randint`, `shuffle` from `../../engine/rng`; `Puzzle` from `../types`.
- Produces:
  - `function generateCapture(rng: Rng, opts: { topic: number; rung: number; minCaptured: number; size: number; count: number }): Puzzle[]` — builds positions with exactly one enemy group (size ≥ `minCaptured`) in atari; validates `unique` capture; emits records with `captured` filled from the winning play.

**Approach note:** construction is "surround-then-verify". Place a black group of the target size, surround all but one of its liberties with white, set `toPlay: "w"` — no; keep the learner as black. Instead place a **white** group of the target size, fill all but one liberty with black, then validate that black has exactly one capturing move. Reject (regenerate) if the shape self-connects the surrounding stones into their own atari or yields >1 capture.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { Board } from "../../engine/board";
import { play } from "../../engine/rules";
import { makeRng } from "../../engine/rng";
import { generateCapture } from "./atari";

describe("generateCapture", () => {
  it("produces N single-solution capture puzzles (topic 2)", () => {
    const puzzles = generateCapture(makeRng(1), { topic: 2, rung: 1, minCaptured: 1, size: 5, count: 10 });
    expect(puzzles).toHaveLength(10);
    for (const p of puzzles) {
      expect(p.topic).toBe(2);
      expect(p.mode).toBe("M");
      expect(p.solution.kind).toBe("move");
      if (p.solution.kind === "move") {
        // exactly one solution, and playing it really captures
        expect(p.solution.points).toHaveLength(1);
        const b = Board.from(p.size, p.stones);
        const pt = p.solution.points[0]!;
        const r = play(b, pt.x, pt.y, "b");
        expect(r.ok).toBe(true);
        expect(r.captured.length).toBeGreaterThanOrEqual(1);
        expect(p.captured).toEqual(r.captured);
      }
    }
  });

  it("captures ≥2 stones for topic 3", () => {
    const puzzles = generateCapture(makeRng(2), { topic: 3, rung: 1, minCaptured: 2, size: 5, count: 5 });
    for (const p of puzzles) {
      expect(p.captured!.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("is deterministic for a fixed seed", () => {
    const a = generateCapture(makeRng(3), { topic: 2, rung: 1, minCaptured: 1, size: 5, count: 5 });
    const b = generateCapture(makeRng(3), { topic: 2, rung: 1, minCaptured: 1, size: 5, count: 5 });
    expect(a).toEqual(b);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/generator/topics/atari.test.ts`
Expected: FAIL — cannot find module `./atari`.

- [ ] **Step 3: Write minimal implementation**

```ts
import { Board, Stone, Point } from "../../engine/board";
import { play } from "../../engine/rules";
import { group } from "../../engine/liberties";
import { validateM, GoalFn } from "../validate";
import { Rng, randint, shuffle } from "../../engine/rng";
import { Puzzle } from "../types";

const capturesAtLeast = (k: number): GoalFn => (_b, _m, _c, res) => res.captured.length >= k;

// Grow a connected white blob of `n` stones starting near the centre.
function growBlob(rng: Rng, size: number, n: number): Point[] | null {
  const start = { x: randint(rng, 1, size - 2), y: randint(rng, 1, size - 2) };
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

export function generateCapture(
  rng: Rng,
  opts: { topic: number; rung: number; minCaptured: number; size: number; count: number },
): Puzzle[] {
  const { topic, rung, minCaptured, size, count } = opts;
  const out: Puzzle[] = [];
  let guard = 0;

  while (out.length < count && guard++ < count * 500) {
    const n = minCaptured === 1 ? 1 : randint(rng, minCaptured, minCaptured + 1);
    const blob = growBlob(rng, size, n);
    if (!blob) continue;

    const board = new Board(size);
    for (const s of blob) board.set(s.x, s.y, "w");

    // outside liberties of the blob
    const libs: Point[] = group(board, blob[0]!.x, blob[0]!.y).liberties;
    if (libs.length < 2) continue; // need one to leave open

    const shuffled = shuffle(rng, libs);
    const leaveOpen = shuffled[0] as Point;
    const fill = shuffled.slice(1);
    for (const p of fill) board.set(p.x, p.y, "b");

    // black surrounding stones must not themselves be pre-captured / in atari-that-breaks-uniqueness
    const v = validateM(board, "b", capturesAtLeast(minCaptured), "unique");
    if (!v.valid) continue;

    const sol = v.solution[0] as Point;
    const res = play(board, sol.x, sol.y, "b");
    if (!res.ok || res.captured.length < minCaptured) continue;

    out.push({
      id: "tmp", topic, rung, mode: "M", size,
      stones: board.stones(), toPlay: "b",
      prompt: minCaptured >= 2 ? "Black to play — capture the group." : "Black to play — capture the stone.",
      solution: { kind: "move", points: [sol] },
      captured: res.captured,
    });
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/generator/topics/atari.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/generator/topics/atari.ts src/generator/topics/atari.test.ts
git commit -m "feat(generator): capture/atari generator (topics 2-3)"
```

---

### Task 9: Topic 1 generator (liberties — Q)

**Files:**
- Create: `src/generator/topics/liberties.ts`
- Test: `src/generator/topics/liberties.test.ts`

**Interfaces:**
- Consumes: `Board`, `Point` from `../../engine/board`; `libertyCount`, `group` from `../../engine/liberties`; `Rng`, `randint`, `pick`, `shuffle` from `../../engine/rng`; `Puzzle` from `../types`.
- Produces:
  - `function generateLiberties(rng: Rng, opts: { rung: number; size: number; count: number }): Puzzle[]` — `mode: "Q-count"`, one marked stone, `solution: { kind: "value", value: <libertyCount> }`, `marks: [{...,kind:"mark"}]`. Places the marked stone with rung-dependent edge/enemy context; the answer is the true liberty count (1–4).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { Board } from "../../engine/board";
import { libertyCount } from "../../engine/liberties";
import { makeRng } from "../../engine/rng";
import { generateLiberties } from "./liberties";

describe("generateLiberties", () => {
  it("produces Q-count puzzles whose answer equals the real liberty count", () => {
    const puzzles = generateLiberties(makeRng(1), { rung: 1, size: 5, count: 12 });
    expect(puzzles).toHaveLength(12);
    for (const p of puzzles) {
      expect(p.mode).toBe("Q-count");
      expect(p.marks).toHaveLength(1);
      const mark = p.marks![0]!;
      const b = Board.from(p.size, p.stones);
      expect(p.solution).toEqual({ kind: "value", value: libertyCount(b, mark.x, mark.y) });
    }
  });

  it("is deterministic", () => {
    const a = generateLiberties(makeRng(5), { rung: 1, size: 5, count: 6 });
    const b = generateLiberties(makeRng(5), { rung: 1, size: 5, count: 6 });
    expect(a).toEqual(b);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/generator/topics/liberties.test.ts`
Expected: FAIL — cannot find module `./liberties`.

- [ ] **Step 3: Write minimal implementation**

```ts
import { Board, Point } from "../../engine/board";
import { libertyCount } from "../../engine/liberties";
import { Rng, randint, pick, shuffle } from "../../engine/rng";
import { Puzzle } from "../types";

export function generateLiberties(
  rng: Rng,
  opts: { rung: number; size: number; count: number },
): Puzzle[] {
  const { rung, size, count } = opts;
  const out: Puzzle[] = [];
  let guard = 0;

  while (out.length < count && guard++ < count * 500) {
    const board = new Board(size);
    // rung 1: centre; rung >=2: allow edge/corner placement
    const edgey = rung >= 2;
    const lo = edgey ? 0 : 1, hi = edgey ? size - 1 : size - 2;
    const mark: Point = { x: randint(rng, lo, hi), y: randint(rng, lo, hi) };
    board.set(mark.x, mark.y, "b");

    // rung >=3: add up to two enemy contacts to vary the count
    if (rung >= 3) {
      const contacts = shuffle(rng, board.neighbors(mark.x, mark.y));
      const k = randint(rng, 1, Math.min(2, contacts.length));
      for (let i = 0; i < k; i++) board.set(contacts[i]!.x, contacts[i]!.y, "w");
    }

    const value = libertyCount(board, mark.x, mark.y);
    if (value < 1 || value > 4) continue;

    out.push({
      id: "tmp", topic: 1, rung, mode: "Q-count", size,
      stones: board.stones(), toPlay: "b",
      prompt: "How many liberties does the marked stone have?",
      solution: { kind: "value", value },
      marks: [{ x: mark.x, y: mark.y, kind: "mark" }],
    });
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/generator/topics/liberties.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/generator/topics/liberties.ts src/generator/topics/liberties.test.ts
git commit -m "feat(generator): liberties Q generator (topic 1)"
```

---

### Task 10: CLI — assemble & write the bank

**Files:**
- Create: `src/generator/cli.ts`
- Create (generated, committed): `src/bank/bank.json`
- Test: `src/generator/cli.test.ts`

**Interfaces:**
- Consumes: `makeRng` from `../engine/rng`; `generateLiberties` from `./topics/liberties`; `generateCapture` from `./topics/atari`; `assembleBank`, `writeBank` from `./bank`; `Puzzle` from `./types`.
- Produces:
  - `function buildBank(seed: number): Bank` — generates topics 1–3 (rungs 1–2 each, 20 per rung per the global constraint) and assembles.
  - CLI side effect: writes `src/bank/bank.json` with `SEED = 20260706`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { buildBank } from "./cli";

describe("buildBank", () => {
  it("covers topics 1-3 with 20 puzzles per rung and unique ids", () => {
    const bank = buildBank(20260706);
    const byRung = new Map<string, number>();
    for (const p of bank.puzzles) {
      const k = `t${p.topic}-r${p.rung}`;
      byRung.set(k, (byRung.get(k) ?? 0) + 1);
    }
    // topics 1,2,3 each have rungs 1 and 2
    for (const t of [1, 2, 3])
      for (const r of [1, 2])
        expect(byRung.get(`t${t}-r${r}`)).toBe(20);

    const ids = bank.puzzles.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length); // all unique
  });

  it("is deterministic", () => {
    expect(buildBank(20260706)).toEqual(buildBank(20260706));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/generator/cli.test.ts`
Expected: FAIL — cannot find module `./cli`.

- [ ] **Step 3: Write minimal implementation**

```ts
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { makeRng } from "../engine/rng";
import { generateLiberties } from "./topics/liberties";
import { generateCapture } from "./topics/atari";
import { assembleBank, writeBank } from "./bank";
import { Bank, Puzzle } from "./types";

const PER_RUNG = 20;
const SEED = 20260706;

export function buildBank(seed: number): Bank {
  const rng = makeRng(seed);
  const groups: Puzzle[][] = [];

  // Topic 1 — liberties (Q): rung 1 centre, rung 2 edge/corner
  for (const rung of [1, 2])
    groups.push(generateLiberties(rng, { rung, size: 5, count: PER_RUNG }));

  // Topic 2 — atari & capture (M): single stone
  for (const rung of [1, 2])
    groups.push(generateCapture(rng, { topic: 2, rung, minCaptured: 1, size: 5, count: PER_RUNG }));

  // Topic 3 — capturing multiple (M): ≥2 stones
  for (const rung of [1, 2])
    groups.push(generateCapture(rng, { topic: 3, rung, minCaptured: 2, size: 5, count: PER_RUNG }));

  return assembleBank(seed, groups);
}

function main(): void {
  const here = dirname(fileURLToPath(import.meta.url));
  const outPath = join(here, "..", "bank", "bank.json");
  const bank = buildBank(SEED);
  writeBank(bank, outPath);
  console.log(`Wrote ${bank.puzzles.length} puzzles to ${outPath}`);
}

// run only when invoked directly (not when imported by tests)
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/generator/cli.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Generate and commit the bank**

Run: `mkdir -p src/bank && npm run generate`
Expected: `Wrote 120 puzzles to .../src/bank/bank.json`

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 7: Commit the pipeline and the generated bank**

```bash
git add src/generator/cli.ts src/generator/cli.test.ts src/bank/bank.json
git commit -m "feat(generator): CLI assembles committed bank (topics 1-3)"
```

---

## Self-Review

**Spec coverage (this plan's slice):**
- Rules core (flood-fill/liberties, capture, legality/suicide) → Tasks 2–4. ✅
- Seeded/deterministic generation → Task 5, asserted in Tasks 8–10. ✅
- Generate-then-validate + uniqueness policy → Task 6; used in Task 8. ✅
- Committed `bank.json`, not build output → Task 10 (generated then `git add`ed). ✅
- Local frames 5–7 → all generators take `size: 5`. ✅
- 20 puzzles/rung → enforced/asserted in Task 10. ✅
- Topics 1–3 (liberties Q, atari M, capture-multiple M) → Tasks 9, 8. ✅
- **Deferred to later plans (out of scope here, by design):** topics 4–6 generators (escape any-valid, self-atari, double atari), and the entire React PWA app.

**Placeholder scan:** no TBD/TODO; every code step shows complete code. The `id: "tmp"` values are intentional and overwritten by `assembleBank` (Task 7) — asserted unique in Task 10.

**Type consistency:** `GoalFn`, `Policy`, `validateM`, `Puzzle`, `SolutionSpec`, `generateCapture`, `generateLiberties`, `assembleBank`, `writeBank`, `buildBank` are used with identical signatures across the tasks that define and consume them.
