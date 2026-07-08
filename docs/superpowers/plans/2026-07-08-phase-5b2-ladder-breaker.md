# Phase 5b.2 — Ladder-breaker (topic 9) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add topic 9 (ladder-breaker) as a Q-binary "is the ladder caught?" recognition puzzle — caught cases animate the capture (reuse 5b.1's payoff), escapes cases ring the single breaker stone on reveal.

**Architecture:** A build-time generator reuses `capturedUnderBestPlay` (the caught/escapes ground truth) and `captureLine` (the caught payoff). Escapes puzzles store the one White `breaker` stone whose removal flips the verdict. Runtime reuses the existing Q-binary app: the caught animation is the existing 5a payoff-reveal branch (no change); the escapes reveal adds a reveal-gated breaker ring on `Board`. `YesNo` is generalized to topic-keyed labels so topic 5 stays untouched.

**Tech Stack:** TypeScript (ESM), React 18 MVVM, Vitest + jsdom, seeded generator CLI (`tsx`).

## Global Constraints

- **Engine never ships to the client.** Generator/reader are build-time only; the app replays pre-verified data.
- **No new mode / view-model / tree.** Topic 9 reuses `mode: "Q-binary"`. `PlayerViewModel` and `checkAnswer` are untouched.
- **Caught vs escapes ground truth is `capturedUnderBestPlay(board, target, "b", 12)`** — caught = true, escapes = false. Search depth `12` used for generation AND bank re-verification.
- **Topic-9 puzzle shape:** `mode:"Q-binary"`, `toPlay:"b"`, `solution:{kind:"choice", id:"caught"|"escapes"}`, `marks:[{x,y,kind:"mark"}]` on the White target, prompt exactly `"If Black ladders the marked stone, is it caught?"`. Caught puzzles carry `payoff` (capture line, move 0 = Black's opening atari); escapes puzzles carry `breaker: Pt`. Exactly one of the two per puzzle.
- **Escapes breaker must be identifiable:** the stored `breaker` is a White stone whose removal makes `capturedUnderBestPlay` return true. Reject escapes shapes with no single culprit.
- **Balanced 10 caught / 10 escapes per rung.** Both rungs 9×9.
- **Determinism / bank integrity:** topic-9 generation is **appended last** in `buildBank` (after topic 8) so the existing 400 puzzles stay byte-identical. Bank → **440**. `npm run generate` deterministic.
- **Topic 5's committed bank is NOT changed** — Q-binary choice labels live in the UI (`Q_CHOICES`), not the data.
- **The two `types.ts` stay mirrored:** `breaker?: Point` in `src/generator/types.ts`, `breaker?: Pt` in `src/app/model/types.ts`.
- **Everything verified** in a permanent test; nothing ships on trust.
- Run tests `npm test`; typecheck `npm run typecheck`; build `npm run build`; regenerate `npm run generate`.

---

## File Structure

**Create:**
- `src/generator/topics/ladderbreaker.ts` — `generateLadderBreaker` + `findBreaker`. Build-time.
- `src/generator/topics/ladderbreaker.test.ts` — generator invariants.

**Modify:**
- `src/generator/types.ts` / `src/app/model/types.ts` — add `breaker?` to `Puzzle`.
- `src/generator/cli.ts` — append topic 9 last.
- `src/bank/bank.json` — regenerated → 440.
- `src/bank/bank.test.ts` — topic-9 block; 400→440 count + topic list.
- `src/app/model/bank.test.ts` — topic list + `rungRefs` count.
- `src/generator/cli.test.ts` — 400→440 count + topic list.
- `src/app/ui/inputs.tsx` — generalize `YesNo`.
- `src/app/ui/inputs.test.tsx` — updated `YesNo` test.
- `src/app/ui/PlayerScreen.tsx` — `Q_CHOICES`; pass options to `YesNo`; pass `breaker` to the reveal `Board`; escapes caption.
- `src/app/ui/PlayerScreen.test.tsx` — topic-9 reveal tests.
- `src/app/ui/Board.tsx` — reveal-gated `breaker?` prop.
- `src/app/ui/Board.test.tsx` — breaker-ring render test.
- `src/app/content/lessons.ts` — `LessonDiagram.breaker?`; topic-9 lesson (verified fixture).
- `src/app/content/lessons.verify.test.ts` — T9 verify; topic-list/count.
- `src/app/ui/LessonScreen.tsx` — ring the breaker for lessons with `diagram.breaker`.
- `src/app/ui/MapScreen.tsx` — `9: "Ladder-breaker"`.
- `PLAN.md` — tracker, curriculum, stats; drop the stale interactive-player row.

---

## Task 1: Types + ladder-breaker generator

**Files:**
- Modify: `src/generator/types.ts`, `src/app/model/types.ts`
- Create: `src/generator/topics/ladderbreaker.ts`
- Test: `src/generator/topics/ladderbreaker.test.ts`

**Interfaces:**
- Consumes: `capturedUnderBestPlay`, `captureLine` from `../reader`; `annotate` from `../payoff`; `Board`, `Point` from `../../engine/board`; `play`, `group`, `Rng`/`randint`/`shuffle`, `Puzzle`.
- Produces: `generateLadderBreaker(rng: Rng, opts: { rung: number; size: number; count: number }): Puzzle[]`; `findBreaker(board: Board, target: Point): Point | null`. `Puzzle.breaker?: Point`/`Pt`.

- [ ] **Step 1: Add `breaker?` to both `types.ts`**

In `src/generator/types.ts`, add to the `Puzzle` interface (after `payoff?`):
```ts
  breaker?: Point;
```
In `src/app/model/types.ts`, add to the `Puzzle` interface (after `payoff?`):
```ts
  breaker?: Pt;
```

- [ ] **Step 2: Write the failing test**

Create `src/generator/topics/ladderbreaker.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { generateLadderBreaker, findBreaker } from "./ladderbreaker";
import { makeRng } from "../../engine/rng";
import { Board } from "../../engine/board";
import { play } from "../../engine/rules";
import { capturedUnderBestPlay } from "../reader";

describe("generateLadderBreaker", () => {
  it("produces a balanced set of engine-correct caught/escapes verdicts (9x9)", () => {
    const puzzles = generateLadderBreaker(makeRng(1), { rung: 1, size: 9, count: 10 });
    expect(puzzles).toHaveLength(10);
    const caught = puzzles.filter((p) => p.solution.kind === "choice" && p.solution.id === "caught");
    const escapes = puzzles.filter((p) => p.solution.kind === "choice" && p.solution.id === "escapes");
    expect(caught).toHaveLength(5);
    expect(escapes).toHaveLength(5);
    for (const p of puzzles) {
      expect(p.topic).toBe(9);
      expect(p.mode).toBe("Q-binary");
      const t = p.marks![0]!;
      const board = Board.from(p.size, p.stones);
      const verdict = capturedUnderBestPlay(board, t, "b", 12);
      if (p.solution.kind !== "choice") throw new Error("expected choice");
      if (p.solution.id === "caught") {
        expect(verdict).toBe(true);
        expect(p.breaker).toBeUndefined();
        // payoff replays to the target's capture
        expect(p.payoff!.filter((m) => m.c === "b").length).toBeGreaterThanOrEqual(2);
        let b2 = Board.from(p.size, p.stones);
        for (const m of p.payoff!) { const r = play(b2, m.x, m.y, m.c); expect(r.ok).toBe(true); b2 = r.board; }
        expect(b2.get(t.x, t.y)).toBeNull();
      } else {
        expect(verdict).toBe(false);
        expect(p.payoff).toBeUndefined();
        // the stored breaker is real: removing it makes the ladder work
        expect(board.get(p.breaker!.x, p.breaker!.y)).toBe("w");
        const without = Board.from(p.size, p.stones.filter((s) => !(s.x === p.breaker!.x && s.y === p.breaker!.y)));
        expect(capturedUnderBestPlay(without, t, "b", 12)).toBe(true);
      }
    }
  });

  it("findBreaker returns the culprit stone, or null when none", () => {
    // A working ladder with no breaker -> null.
    const working = Board.from(9, [
      { x: 2, y: 1, c: "b" }, { x: 2, y: 2, c: "w" }, { x: 3, y: 2, c: "b" }, { x: 3, y: 3, c: "b" },
    ]);
    expect(findBreaker(working, { x: 2, y: 2 })).toBeNull();
  });

  it("is deterministic for a given seed", () => {
    const a = generateLadderBreaker(makeRng(9), { rung: 2, size: 9, count: 6 });
    const b = generateLadderBreaker(makeRng(9), { rung: 2, size: 9, count: 6 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run src/generator/topics/ladderbreaker.test.ts`
Expected: FAIL — `Failed to resolve import "./ladderbreaker"`.

- [ ] **Step 4: Implement `ladderbreaker.ts`**

Create `src/generator/topics/ladderbreaker.ts`:
```ts
import { Board, Point } from "../../engine/board";
import { group } from "../../engine/liberties";
import { capturedUnderBestPlay, captureLine } from "../reader";
import { annotate } from "../payoff";
import { Rng, randint, shuffle } from "../../engine/rng";
import { Puzzle } from "../types";

const DEPTH = 12;

// The single White stone whose removal makes the ladder work — the breaker to highlight.
// Returns null if no single stone is the culprit (the escape is not cleanly attributable).
export function findBreaker(board: Board, target: Point): Point | null {
  for (const s of board.stones()) {
    if (s.c !== "w" || (s.x === target.x && s.y === target.y)) continue;
    const without = Board.from(board.size, board.stones().filter((q) => !(q.x === s.x && q.y === s.y)));
    if (capturedUnderBestPlay(without, target, "b", DEPTH)) return { x: s.x, y: s.y };
  }
  return null;
}

// A clean base ladder shape: a 2-liberty White target confined by Black, with an optional diagonal
// wall stone. (Mirrors the shape construction in topics/ladder.ts; duplicated on purpose so the two
// generators stay independent and topic 8's committed bank is never perturbed by a shared refactor.)
function baseShape(rng: Rng, size: number): { board: Board; target: Point } | null {
  const board = new Board(size);
  const target: Point = { x: randint(rng, 1, size - 2), y: randint(rng, 1, size - 2) };
  board.set(target.x, target.y, "w");
  const nbrs = shuffle(rng, board.neighbors(target.x, target.y));
  for (let i = 0; i < 2; i++) board.set(nbrs[i]!.x, nbrs[i]!.y, "b");
  const diags = shuffle(rng, [
    { x: target.x + 1, y: target.y + 1 }, { x: target.x - 1, y: target.y + 1 },
    { x: target.x + 1, y: target.y - 1 }, { x: target.x - 1, y: target.y - 1 },
  ].filter((p) => p.x >= 0 && p.y >= 0 && p.x < size && p.y < size));
  if (diags.length && board.get(diags[0]!.x, diags[0]!.y) === null) board.set(diags[0]!.x, diags[0]!.y, "b");
  if (group(board, target.x, target.y).liberties.length !== 2) return null;
  if (board.stones().some((s) => s.c === "b" && group(board, s.x, s.y).liberties.length <= 1)) return null;
  return { board, target };
}

function allEmpty(board: Board): Point[] {
  const out: Point[] = [];
  for (let y = 0; y < board.size; y++) for (let x = 0; x < board.size; x++) if (board.get(x, y) === null) out.push({ x, y });
  return out;
}

export function generateLadderBreaker(rng: Rng, opts: { rung: number; size: number; count: number }): Puzzle[] {
  const { rung, size, count } = opts;
  const out: Puzzle[] = [];
  const seen = new Set<string>();
  const need = { caught: Math.ceil(count / 2), escapes: Math.floor(count / 2) };
  const have = { caught: 0, escapes: 0 };
  let guard = 0;

  while (out.length < count && guard++ < count * 6000) {
    const wantEscapes = have.escapes < need.escapes && (have.caught >= need.caught || guard % 2 === 0);
    const base = baseShape(rng, size);
    if (!base) continue;
    const { board, target } = base;
    if (!capturedUnderBestPlay(board, target, "b", DEPTH)) continue; // both classes start from a working ladder

    let puzzle: Puzzle | null = null;
    if (!wantEscapes) {
      if (have.caught >= need.caught) continue;
      const line = captureLine(board, target, "b", DEPTH);
      if (!line || line.filter((m) => m.c === "b").length < 2) continue;
      puzzle = {
        id: "tmp", topic: 9, rung, mode: "Q-binary", size, stones: board.stones(), toPlay: "b",
        prompt: "If Black ladders the marked stone, is it caught?",
        solution: { kind: "choice", id: "caught" },
        marks: [{ x: target.x, y: target.y, kind: "mark" }],
        payoff: annotate(size, board.stones(), line),
      };
    } else {
      if (have.escapes >= need.escapes) continue;
      let breaker: Point | null = null;
      for (const bp of shuffle(rng, allEmpty(board)).filter((p) => Math.abs(p.x - target.x) + Math.abs(p.y - target.y) >= 2)) {
        board.set(bp.x, bp.y, "w");
        const clean = group(board, bp.x, bp.y).liberties.length >= 2 &&
          !board.stones().some((s) => s.c === "b" && group(board, s.x, s.y).liberties.length <= 1);
        if (clean && !capturedUnderBestPlay(board, target, "b", DEPTH)) {
          const found = findBreaker(board, target);
          if (found) { breaker = found; break; }
        }
        board.set(bp.x, bp.y, null);
      }
      if (!breaker) continue;
      puzzle = {
        id: "tmp", topic: 9, rung, mode: "Q-binary", size, stones: board.stones(), toPlay: "b",
        prompt: "If Black ladders the marked stone, is it caught?",
        solution: { kind: "choice", id: "escapes" },
        marks: [{ x: target.x, y: target.y, kind: "mark" }],
        breaker,
      };
    }

    const sig = JSON.stringify({ s: puzzle.stones });
    if (seen.has(sig)) continue;
    seen.add(sig);
    if (puzzle.solution.kind === "choice") have[puzzle.solution.id as "caught" | "escapes"]++;
    out.push(puzzle);
  }
  if (out.length < count) {
    throw new Error(`generateLadderBreaker: produced ${out.length}/${count} (rung ${rung}, size ${size})`);
  }
  return out;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/generator/topics/ladderbreaker.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**
```bash
git add src/generator/types.ts src/app/model/types.ts src/generator/topics/ladderbreaker.ts src/generator/topics/ladderbreaker.test.ts
git commit -m "feat(generator): ladder-breaker (topic 9) generator + breaker field"
```

---

## Task 2: Wire topic 9 into the bank + regenerate + verify

**Files:**
- Modify: `src/generator/cli.ts`, `src/bank/bank.json`, `src/bank/bank.test.ts`, `src/app/model/bank.test.ts`, `src/generator/cli.test.ts`

**Interfaces:**
- Consumes: `generateLadderBreaker` from `./topics/ladderbreaker`.

- [ ] **Step 1: Add the failing bank block + updated counts**

In `src/bank/bank.test.ts`:

(a) Update the shape test to 440 and the topic list:
```ts
  it("has 440 puzzles, 20 per topic-rung, unique ids", () => {
    expect(bank.puzzles).toHaveLength(440);
    expect(new Set(bank.puzzles.map((p) => p.id)).size).toBe(440);
    const by = new Map<string, number>();
    for (const p of bank.puzzles) {
      const k = `t${p.topic}-r${p.rung}`;
      by.set(k, (by.get(k) ?? 0) + 1);
    }
    for (const t of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]) for (const r of [1, 2]) expect(by.get(`t${t}-r${r}`)).toBe(20);
  });
```

(b) Append the topic-9 block (file already imports `Board`, `play`, `capturedUnderBestPlay`, `norm`):
```ts
const lbPuzzles: [string, Puzzle][] = bank.puzzles.filter((p) => p.topic === 9).map((p) => [p.id, p]);

describe("bank.json — ladder-breaker verdicts are correct (topic 9)", () => {
  it.each(lbPuzzles)("%s: verdict matches the engine; caught payoff captures, escapes breaker is real", (_id, p) => {
    expect(p.mode).toBe("Q-binary");
    if (p.solution.kind !== "choice") return;
    expect(p.marks).toHaveLength(1);
    const t = p.marks![0]!;
    const board = Board.from(p.size, p.stones);
    const caught = capturedUnderBestPlay(board, t, "b", 12);
    if (p.solution.id === "caught") {
      expect(caught).toBe(true);
      expect(p.breaker).toBeUndefined();
      expect(p.payoff && p.payoff.length).toBeGreaterThan(0);
      let b2 = Board.from(p.size, p.stones);
      for (const m of p.payoff!) {
        const r = play(b2, m.x, m.y, m.c);
        expect(r.ok).toBe(true);
        expect(norm(r.captured)).toBe(norm(m.captures ?? []));
        b2 = r.board;
      }
      expect(b2.get(t.x, t.y)).toBeNull();
    } else {
      expect(p.solution.id).toBe("escapes");
      expect(caught).toBe(false);
      expect(p.payoff).toBeUndefined();
      expect(p.breaker).toBeDefined();
      expect(board.get(p.breaker!.x, p.breaker!.y)).toBe("w");
      const without = Board.from(p.size, p.stones.filter((s) => !(s.x === p.breaker!.x && s.y === p.breaker!.y)));
      expect(capturedUnderBestPlay(without, t, "b", 12)).toBe(true);
    }
  });
});

describe("bank.json — ladder-breaker rungs are balanced (topic 9)", () => {
  for (const rung of [1, 2]) {
    it(`t9-r${rung}: 10 caught + 10 escapes`, () => {
      const g = bank.puzzles.filter((p) => p.topic === 9 && p.rung === rung);
      const id = (p: Puzzle) => (p.solution.kind === "choice" ? p.solution.id : "");
      expect(g.filter((p) => id(p) === "caught")).toHaveLength(10);
      expect(g.filter((p) => id(p) === "escapes")).toHaveLength(10);
    });
  }
});
```

- [ ] **Step 2: Run it to verify it fails against the current bank**

Run: `npx vitest run src/bank/bank.test.ts`
Expected: FAIL — bank has 400 puzzles / no topic 9.

- [ ] **Step 3: Wire topic 9 into `buildBank` (appended LAST)**

In `src/generator/cli.ts`, add the import:
```ts
import { generateLadderBreaker } from "./topics/ladderbreaker";
```
Then, immediately **after** the two topic-8 `generateLadder` `groups.push(...)` lines and **before** `return assembleBank(seed, groups)`, add:
```ts
  // Topic 9 — ladder-breaker: appended LAST so every existing topic's RNG draws (and committed
  // puzzles) are unchanged; only 40 new puzzles are added.
  groups.push(curateRung(generateLadderBreaker(rng, { rung: 1, size: 9, count: PER_RUNG })));
  groups.push(curateRung(generateLadderBreaker(rng, { rung: 2, size: 9, count: PER_RUNG })));
```

- [ ] **Step 4: Regenerate the bank**

Run: `npm run generate`
Expected: `Wrote 440 puzzles to .../src/bank/bank.json`.

- [ ] **Step 5: Confirm the diff is append-only**

Run: `git diff src/bank/bank.json | grep -c '^-'`
Expected: a very small number (only the old array-terminating line flips to add a comma).
Run: `git diff src/bank/bank.json | grep -c '"topic": 9'`
Expected: `40`.
If any existing (topic 1–8/10/11) puzzle changed, STOP and report BLOCKED — the ladder-breaker calls were not appended last.

- [ ] **Step 6: Update the app-model + cli topic lists**

In `src/app/model/bank.test.ts`, update:
```ts
    expect(pb.topics()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
```
and update the `rungRefs()` assertions: the count is now `11 topics × 2 = 22`, and the last ref is `t11-r2`. Change the asserted length to `22` and any indexed access from the old last index to `21` (i.e. `refs[21]` is `{ topic: 11, rung: 2 }`).

In `src/generator/cli.test.ts`, update the hardcoded bank size and topic-list assertions from 400 / 10 topics to **440 / 11 topics** (`[1,2,3,4,5,6,7,8,9,10,11]`) — mirror whatever assertions already exist there for the previous counts.

- [ ] **Step 7: Run the bank + model + cli suites**

Run: `npx vitest run src/bank/bank.test.ts src/app/model/bank.test.ts src/generator/cli.test.ts`
Expected: PASS — 440 puzzles, topic-9 blocks green, lists include 9.

- [ ] **Step 8: Commit**
```bash
git add src/generator/cli.ts src/bank/bank.json src/bank/bank.test.ts src/app/model/bank.test.ts src/generator/cli.test.ts
git commit -m "feat(bank): add topic 9 (ladder-breaker), regenerate to 440, verify verdicts"
```

---

## Task 3: Generalize the YesNo input + topic-keyed choices

**Files:**
- Modify: `src/app/ui/inputs.tsx`, `src/app/ui/inputs.test.tsx`, `src/app/ui/PlayerScreen.tsx`

**Interfaces:**
- Produces: `ChoiceOption` (`{ id: string; label: string }`); `YesNo({ options: [ChoiceOption, ChoiceOption], onPick: (id: string) => void })`; `Q_CHOICES` map in `PlayerScreen`.

- [ ] **Step 1: Write the failing test**

Replace the `YesNo` test in `src/app/ui/inputs.test.tsx` (update the import to include the type if needed — `import { NumberPad, YesNo } from "./inputs";`):
```ts
  it("YesNo renders the supplied options and reports the tapped id", () => {
    const onPick = vi.fn();
    render(<YesNo options={[{ id: "caught", label: "Caught" }, { id: "escapes", label: "Escapes" }]} onPick={onPick} />);
    fireEvent.click(screen.getByRole("button", { name: /caught/i }));
    expect(onPick).toHaveBeenCalledWith("caught");
    fireEvent.click(screen.getByRole("button", { name: /escapes/i }));
    expect(onPick).toHaveBeenCalledWith("escapes");
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/app/ui/inputs.test.tsx`
Expected: FAIL — `YesNo` doesn't accept `options` (type error / renders old labels).

- [ ] **Step 3: Generalize `YesNo`**

In `src/app/ui/inputs.tsx`, replace the `YesNo` export:
```tsx
export interface ChoiceOption { id: string; label: string; }

export function YesNo({ options, onPick }: { options: [ChoiceOption, ChoiceOption]; onPick: (id: string) => void }) {
  return (
    <div className="yesno">
      {options.map((o) => (
        <button key={o.id} className="num" onClick={() => onPick(o.id)}>{o.label}</button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Update `PlayerScreen` to supply options**

In `src/app/ui/PlayerScreen.tsx`, add the import for the type and a choice map near the top (after imports):
```tsx
import { NumberPad, YesNo, type ChoiceOption } from "./inputs";

const Q_CHOICES: Record<number, [ChoiceOption, ChoiceOption]> = {
  5: [{ id: "self-atari", label: "Self-atari" }, { id: "safe", label: "Safe" }],
  9: [{ id: "caught", label: "Caught" }, { id: "escapes", label: "Escapes" }],
};
```
(Adjust the existing `import { NumberPad, YesNo } from "./inputs";` line to the form above.) Then replace the Q-binary input line:
```tsx
      {!resolved && p.mode === "Q-binary" && (
        <YesNo options={Q_CHOICES[p.topic]!} onPick={(id) => submit({ kind: "choice", id })} />
      )}
```

- [ ] **Step 5: Run the input + screen tests**

Run: `npx vitest run src/app/ui/inputs.test.tsx src/app/ui/PlayerScreen.test.tsx`
Expected: PASS. (Existing PlayerScreen tests use topic 2, unaffected. If any test rendered a Q-binary puzzle through PlayerScreen with a topic not in `Q_CHOICES`, it would throw — none currently do; topic 5/9 are covered.)

- [ ] **Step 6: Commit**
```bash
git add src/app/ui/inputs.tsx src/app/ui/inputs.test.tsx src/app/ui/PlayerScreen.tsx
git commit -m "refactor(app): generalize YesNo to topic-keyed choice labels"
```

---

## Task 4: Board breaker ring + PlayerScreen escapes reveal

**Files:**
- Modify: `src/app/ui/Board.tsx`, `src/app/ui/Board.test.tsx`, `src/app/ui/PlayerScreen.tsx`, `src/app/ui/PlayerScreen.test.tsx`

**Interfaces:**
- Produces: `Board` accepts optional `breaker?: Pt`, drawing a reveal-gated warn ring.
- Consumes (caught case): the existing 5a payoff-reveal branch already renders `PayoffBoard` for a resolved puzzle with a `payoff` — no change needed for caught.

- [ ] **Step 1: Write the failing Board test**

Append to `src/app/ui/Board.test.tsx`:
```ts
  it("rings the breaker point only when revealed", () => {
    const esc: Puzzle = {
      id: "t9", topic: 9, rung: 1, mode: "Q-binary", size: 9, toPlay: "b", prompt: "",
      stones: [{ x: 5, y: 5, c: "w" }, { x: 3, y: 7, c: "w" }],
      solution: { kind: "choice", id: "escapes" }, breaker: { x: 3, y: 7 },
    };
    const { container: hidden } = render(<Board puzzle={esc} breaker={undefined} />);
    expect(hidden.querySelectorAll("circle.breaker").length).toBe(0);
    const { container: shown } = render(<Board puzzle={esc} reveal breaker={esc.breaker} />);
    expect(shown.querySelectorAll("circle.breaker").length).toBe(1);
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/app/ui/Board.test.tsx`
Expected: FAIL — no `circle.breaker` / `breaker` prop unknown.

- [ ] **Step 3: Add the `breaker` prop to `Board`**

In `src/app/ui/Board.tsx`, add `breaker` to `BoardProps` and destructure it:
```ts
export interface BoardProps {
  puzzle: Puzzle;
  reveal?: boolean;
  onTapPoint?: (p: Pt) => void;
  stones?: Stone[];
  breaker?: Pt;
}
```
```ts
export function Board({ puzzle, reveal, onTapPoint, stones: override, breaker }: BoardProps) {
```
Then, in the returned SVG, add a reveal-gated ring right after the existing `reveal && (puzzle.captured ?? [])...` block:
```tsx
      {reveal && breaker && (
        <circle className="breaker" cx={px(breaker.x)} cy={px(breaker.y)} r={r + 5} fill="none" stroke="var(--warn)" strokeWidth={3} />
      )}
```

- [ ] **Step 4: Run the Board test**

Run: `npx vitest run src/app/ui/Board.test.tsx`
Expected: PASS.

- [ ] **Step 5: Write the failing PlayerScreen reveal tests**

Append to `src/app/ui/PlayerScreen.test.tsx` (imports for `PuzzleBank`, `ProgressStore`, `PlayerViewModel`, `Bank`, `mem` already present):
```ts
  it("topic 9 caught: answering shows the animated capture (payoff)", () => {
    vi.useFakeTimers();
    try {
      const bank: Bank = { seed: 0, stage: "B", puzzles: [{
        id: "c", topic: 9, rung: 1, mode: "Q-binary", size: 5, toPlay: "b",
        prompt: "If Black ladders the marked stone, is it caught?",
        stones: [{ x: 2, y: 2, c: "w" }, { x: 1, y: 2, c: "b" }, { x: 3, y: 2, c: "b" }, { x: 2, y: 1, c: "b" }],
        solution: { kind: "choice", id: "caught" },
        marks: [{ x: 2, y: 2, kind: "mark" }],
        payoff: [{ x: 2, y: 3, c: "b", captures: [{ x: 2, y: 2 }] }],
      }]};
      const pb = new PuzzleBank(bank);
      const vm = new PlayerViewModel(pb, new ProgressStore(mem(), pb.rungRefs()), 9, 1);
      render(<PlayerScreen player={vm} onExit={vi.fn()} />);
      fireEvent.click(screen.getByRole("button", { name: /Caught/ }));
      expect(screen.getByRole("button", { name: /Replay/ })).toBeDefined();
    } finally { vi.useRealTimers(); }
  });

  it("topic 9 escapes: answering rings the breaker with a caption", () => {
    const bank: Bank = { seed: 0, stage: "B", puzzles: [{
      id: "e", topic: 9, rung: 1, mode: "Q-binary", size: 9, toPlay: "b",
      prompt: "If Black ladders the marked stone, is it caught?",
      stones: [{ x: 4, y: 5, c: "b" }, { x: 5, y: 5, c: "w" }, { x: 6, y: 5, c: "b" }, { x: 6, y: 6, c: "b" }, { x: 3, y: 7, c: "w" }],
      solution: { kind: "choice", id: "escapes" },
      marks: [{ x: 5, y: 5, kind: "mark" }],
      breaker: { x: 3, y: 7 },
    }]};
    const pb = new PuzzleBank(bank);
    const vm = new PlayerViewModel(pb, new ProgressStore(mem(), pb.rungRefs()), 9, 1);
    const { container } = render(<PlayerScreen player={vm} onExit={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Escapes/ }));
    expect(container.querySelectorAll("circle.breaker").length).toBe(1);
    expect(screen.getByText(/breaks the ladder/i)).toBeDefined();
  });
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npx vitest run src/app/ui/PlayerScreen.test.tsx`
Expected: FAIL — the escapes puzzle doesn't ring the breaker / no caption. (The caught test may already pass via the existing payoff branch.)

- [ ] **Step 7: Wire the escapes reveal in `PlayerScreen`**

In `src/app/ui/PlayerScreen.tsx`, update the fallback `Board` in the `board-hold` to pass the breaker on reveal:
```tsx
          <Board
            puzzle={p}
            reveal={resolved}
            breaker={resolved ? p.breaker : undefined}
            onTapPoint={p.mode === "M" && !resolved ? (pt) => submit({ kind: "move", point: pt }) : undefined}
          />
```
And add the escapes caption immediately after the `board-hold` div (before the input lines):
```tsx
      {resolved && p.breaker && <p className="hint">This white stone breaks the ladder — it can't be caught.</p>}
```

- [ ] **Step 8: Run the screen tests**

Run: `npx vitest run src/app/ui/PlayerScreen.test.tsx`
Expected: PASS (existing + both topic-9 tests).

- [ ] **Step 9: Commit**
```bash
git add src/app/ui/Board.tsx src/app/ui/Board.test.tsx src/app/ui/PlayerScreen.tsx src/app/ui/PlayerScreen.test.tsx
git commit -m "feat(app): topic 9 reveal — animate the capture, ring the breaker"
```

---

## Task 5: Topic 9 concept lesson + map title

**Files:**
- Modify: `src/app/content/lessons.ts`, `src/app/content/lessons.verify.test.ts`, `src/app/ui/LessonScreen.tsx`, `src/app/ui/MapScreen.tsx`

**Interfaces:**
- Consumes: `Board`'s new `breaker?` prop; `LessonDiagram.breaker?`.

- [ ] **Step 1: Write the failing lesson-verify test + topic-list update**

In `src/app/content/lessons.verify.test.ts`:

(a) Update coverage assertion:
```ts
  it("covers exactly the 11 current topics, each with title and body", () => {
    expect(LESSONS.map((l) => l.topic)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    for (const l of LESSONS) {
      expect(l.title.length).toBeGreaterThan(0);
      expect(l.body.length).toBeGreaterThanOrEqual(2);
      expect(l.diagram.caption.length).toBeGreaterThan(0);
    }
  });
```

(b) Append a T9 verify (file already imports `Board`, `boardOf`, `lessonFor`, `marked`, `capturedUnderBestPlay`):
```ts
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/app/content/lessons.verify.test.ts`
Expected: FAIL — `lessonFor(9)` undefined; topic list lacks 9.

- [ ] **Step 3: Add `breaker?` to `LessonDiagram` and the topic-9 lesson**

In `src/app/content/lessons.ts`, add to the `LessonDiagram` interface (after `payoff?`):
```ts
  /** A ladder-breaker stone to ring on reveal (topic 9). */
  breaker?: Pt;
```
Then insert this object into `LESSONS` **between the topic-8 and topic-10 entries** (the fixture is engine-verified: the marked target is not caught, and removing the ringed breaker makes it caught):
```ts
  {
    topic: 9,
    title: "The ladder-breaker",
    body: [
      "A ladder only works if nothing is waiting in its path.",
      "A friendly stone of the hunted colour, sitting further along the zig-zag, is a ladder-breaker: the running stone reaches it, connects, and gets free.",
      "So before you start a ladder, look ahead. The marked white stone here can't be caught — the ringed white stone breaks the ladder.",
    ],
    diagram: {
      size: 9,
      stones: [b(4, 5), w(5, 5), b(6, 5), b(6, 6), w(3, 7)],
      marks: [{ x: 5, y: 5, kind: "mark" }],
      breaker: { x: 3, y: 7 },
      caption: "The ringed stone breaks the ladder — the marked stone escapes.",
    },
  },
```

- [ ] **Step 4: Run the verify test to confirm the fixture is engine-true**

Run: `npx vitest run src/app/content/lessons.verify.test.ts`
Expected: PASS.

- [ ] **Step 5: Ring the breaker in `LessonScreen`**

In `src/app/ui/LessonScreen.tsx`, the `lesson-board` currently renders `PayoffBoard` when `diagram.payoff` else a static `Board`. Update the static `Board` to pass the breaker and reveal it:
```tsx
          {lesson.diagram.payoff ? (
            <PayoffBoard puzzle={diagramPuzzle(lesson)} payoff={lesson.diagram.payoff} />
          ) : (
            <Board
              puzzle={diagramPuzzle(lesson)}
              reveal={showMove || Boolean(lesson.diagram.breaker)}
              breaker={lesson.diagram.breaker}
            />
          )}
```

- [ ] **Step 6: Add the map title**

In `src/app/ui/MapScreen.tsx`, add topic 9 to `TOPIC_TITLES` (between 8 and 10):
```ts
  7: "Connect & cut", 8: "Ladder", 9: "Ladder-breaker", 10: "Net", 11: "Snapback",
```

- [ ] **Step 7: Run the lesson + map tests**

Run: `npx vitest run src/app/content/lessons.verify.test.ts src/app/ui/LessonScreen.test.tsx src/app/ui/MapScreen.test.tsx`
Expected: PASS. (If `MapScreen.test.tsx` asserts an exact title set, extend it to include Ladder-breaker.)

- [ ] **Step 8: Commit**
```bash
git add src/app/content/lessons.ts src/app/content/lessons.verify.test.ts src/app/ui/LessonScreen.tsx src/app/ui/MapScreen.tsx
git commit -m "feat(app): topic 9 (ladder-breaker) concept lesson + map title"
```

---

## Task 6: Full verification + tracker update

**Files:**
- Modify: `PLAN.md`

- [ ] **Step 1: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 2: Full test suite**

Run: `npm test`
Expected: all green; bank suite reports 440. Record the exact total test count.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: succeeds (tsc + vite + PWA precache of the 440-puzzle bank).

- [ ] **Step 4: Update `PLAN.md`**

Make these edits:
1. **Tracker:** replace the `| 5b.2 | Ladder-breaker (9) generator | 🔜 | … |` row with:
```markdown
| 5b.2 | Ladder-breaker (9) — recognise a failing ladder | ✅ | Q-binary; ring the breaker; bank → 440 |
```
2. **Drop the stale row** `| 5b | Interactive sequence player (you play → engine replies) | 🔜 | reuses the 5a DemoMove primitive |` entirely — that ambition was consciously dropped in the 5b.1 pivot.
3. **Curriculum table:** add a row `| 9 | Ladder-breaker | Q-binary |` between the topic-8 and topic-10 rows, and delete the `*(Topic 9 — ladder-breaker — is intentionally gapped…)*` note (no gap remains).
4. **Header stats:** update `- **Tests:** …` to the total from Step 2, and `**400 puzzles**: 10 topics × 2 rungs × 20.` to `**440 puzzles**: 11 topics × 2 rungs × 20.`
5. Add a one-line note that **Stage B is complete** (topics 1–11 all ship).

- [ ] **Step 5: Commit**
```bash
git add PLAN.md
git commit -m "docs: mark Phase 5b.2 (ladder-breaker) shipped; Stage B complete"
```

---

## Self-Review

**Spec coverage:**
- §2 data (`breaker?`, Q-binary shape, caught→payoff / escapes→breaker, balance, 9×9) → Task 1. ✅
- §3 generator (caught via captureLine; escapes via plant-breaker + `findBreaker`; identifiable single breaker; balanced; deterministic; depth 12) → Task 1. ✅
- §3 append-last determinism / bank 400→440 → Task 2. ✅
- §4 reveal (caught animates via existing payoff branch; escapes rings breaker + caption) → Task 4. ✅
- §5 `YesNo` generalization + `Q_CHOICES` (topic 5 bank untouched) → Task 3. ✅
- §6 lesson (verified fixture, `LessonDiagram.breaker`, LessonScreen ring) + map title → Task 5. ✅
- §7 testing (generator invariants, bank block incl. breaker-removal check + balance, lesson verify, UI) → Tasks 1, 2, 4, 5. ✅

**Placeholder scan:** none — all steps carry concrete code/commands; the lesson fixture is the engine-verified literal.

**Type consistency:** `breaker?: Point`/`Pt` mirrored (Task 1) and consumed in Task 2 (bank test), Task 4 (`Board` prop, `PlayerScreen`), Task 5 (`LessonDiagram`); `generateLadderBreaker`/`findBreaker` signatures defined in Task 1 and used in Task 2; `ChoiceOption`/`YesNo`/`Q_CHOICES` defined in Task 3 and unchanged after; bank count 440 consistent across Tasks 2 and 6. Consistent.
