# Phase 6 — Animate Capture on Reveal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make capture topics (2, 3, and the capturing puzzles of 7) reveal the capture via the existing stepped `PayoffBoard` instead of snapping, by deriving a 1-move payoff at the view.

**Architecture:** Add a pure `captureRevealPayoff(puzzle)` helper in the model layer that turns a capturing move (`solution` + `captured`) into a single `DemoMove[]`. `PlayerScreen` computes `p.payoff ?? captureRevealPayoff(p)` and renders `PayoffBoard` when that is defined. No generator/bank change; ladder/net/snapback reveals keep their stored payoff; non-capturing reveals stay on the static `Board`.

**Tech Stack:** TypeScript (ESM), React 18 function components, Vitest + @testing-library/react + jsdom. Model layer is headless (no React/engine imports).

## Global Constraints

- **No generator or bank change** — the payoff is derived at the view from already-verified fields.
- **No new animation mechanism** — reuse the existing stepped `PayoffBoard` (Next move ▸ / Replay). Do not add timed/auto-play animation.
- **Model stays headless** — `src/app/model/sequence.ts` imports only types (no React, no engine).
- **`captureRevealPayoff` guards:** returns a payoff only when `mode === "M"`, `solution.kind === "move"` with ≥1 point, and `captured` is non-empty; otherwise `undefined`.
- **The derived payoff is exactly** `[{ x, y, c: puzzle.toPlay, captures: puzzle.captured }]` where `{x,y} = solution.points[0]`.
- Test commands: single file `npx vitest run <path>`; full suite `npm test`; types `npm run typecheck`.
- Two button labels coexist on a capture reveal: Feedback renders **"Next →"** and PayoffBoard renders **"Next move ▸"**. Tests targeting the queue-advance button must use `/Next →/`; tests targeting the payoff-step button must use `/Next move/i`.

---

### Task 1: `captureRevealPayoff` model helper

A pure function that derives the single-move reveal payoff for a capturing move. Lives beside `applyDemoMove`/`positionAt`, which already know how to fold a `DemoMove` (drop captures, place the stone).

**Files:**
- Modify: `src/app/model/sequence.ts`
- Test: `src/app/model/sequence.test.ts`

**Interfaces:**
- Produces: `captureRevealPayoff(puzzle: Puzzle): DemoMove[] | undefined`

- [ ] **Step 1: Write the failing tests**

Append to `src/app/model/sequence.test.ts`. Also extend the top import to include `captureRevealPayoff` and the `Puzzle` type:

Change line 2–3 from:
```ts
import { applyDemoMove, positionAt } from "./sequence";
import type { Stone, DemoMove } from "./types";
```
to:
```ts
import { applyDemoMove, positionAt, captureRevealPayoff } from "./sequence";
import type { Stone, DemoMove, Puzzle } from "./types";
```

Then append this describe block at the end of the file:
```ts
describe("captureRevealPayoff", () => {
  const capture: Puzzle = {
    id: "c", topic: 2, rung: 1, mode: "M", size: 5, toPlay: "b", prompt: "",
    stones: [{ x: 2, y: 2, c: "w" }, { x: 1, y: 2, c: "b" }, { x: 3, y: 2, c: "b" }, { x: 2, y: 1, c: "b" }],
    solution: { kind: "move", points: [{ x: 2, y: 3 }] },
    captured: [{ x: 2, y: 2 }],
  };

  it("returns a single-move payoff (move + captures) for a capturing move", () => {
    expect(captureRevealPayoff(capture)).toEqual([
      { x: 2, y: 3, c: "b", captures: [{ x: 2, y: 2 }] },
    ]);
  });

  it("returns undefined when nothing is captured", () => {
    expect(captureRevealPayoff({ ...capture, captured: undefined })).toBeUndefined();
    expect(captureRevealPayoff({ ...capture, captured: [] })).toBeUndefined();
  });

  it("returns undefined for a non-move (choice) solution", () => {
    expect(captureRevealPayoff({
      ...capture, mode: "Q-binary", solution: { kind: "choice", id: "caught" },
    })).toBeUndefined();
  });

  it("returns undefined for a non-M mode", () => {
    expect(captureRevealPayoff({ ...capture, mode: "Q-count" })).toBeUndefined();
  });

  it("stepping the payoff drops the captured stone and places the played stone", () => {
    const payoff = captureRevealPayoff(capture)!;
    expect(positionAt(capture.stones, payoff, 1)).toEqual([
      { x: 1, y: 2, c: "b" }, { x: 3, y: 2, c: "b" }, { x: 2, y: 1, c: "b" }, { x: 2, y: 3, c: "b" },
    ]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/app/model/sequence.test.ts`
Expected: FAIL — `captureRevealPayoff` is not exported yet (`captureRevealPayoff is not a function` / import error).

- [ ] **Step 3: Implement `captureRevealPayoff`**

In `src/app/model/sequence.ts`, extend the type import and add the function. Change line 1 from:
```ts
import type { Stone, DemoMove } from "./types";
```
to:
```ts
import type { Stone, DemoMove, Puzzle } from "./types";
```

Append at the end of the file:
```ts
// Derives the reveal animation for a capturing move: a single DemoMove that, when
// folded by positionAt, drops the captured stones and places the played stone. Returns
// undefined when the move doesn't capture (nothing to animate) — the caller then falls
// back to the static reveal. Unlike ladder/net payoffs, this is trivially derivable from
// already-verified fields, so it is computed at the view rather than stored in the bank.
export function captureRevealPayoff(puzzle: Puzzle): DemoMove[] | undefined {
  if (puzzle.mode !== "M") return undefined;
  if (puzzle.solution.kind !== "move") return undefined;
  const p = puzzle.solution.points[0];
  if (!p) return undefined;
  if (!puzzle.captured?.length) return undefined;
  return [{ x: p.x, y: p.y, c: puzzle.toPlay, captures: puzzle.captured }];
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/app/model/sequence.test.ts`
Expected: PASS — all `applyDemoMove`, `positionAt`, and `captureRevealPayoff` tests green.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/model/sequence.ts src/app/model/sequence.test.ts
git commit -m "$(cat <<'EOF'
feat(app): captureRevealPayoff — derive a 1-move payoff for captures

A pure helper turns a capturing move (solution + captured) into a single
DemoMove so a capture can be revealed through the existing stepped
PayoffBoard. Returns undefined when the move captures nothing.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013CsZD5HwrD78GC6o8uPZ5F
EOF
)"
```

---

### Task 2: Render capture reveals through `PayoffBoard`

Wire the helper into `PlayerScreen` so capture puzzles reveal via `PayoffBoard`, and update the tests (including one existing test whose selector becomes ambiguous once the capture reveal gains a "Next move ▸" button).

**Files:**
- Modify: `src/app/ui/PlayerScreen.tsx`
- Test: `src/app/ui/PlayerScreen.test.tsx`

**Interfaces:**
- Consumes: `captureRevealPayoff(puzzle: Puzzle): DemoMove[] | undefined` (Task 1).

- [ ] **Step 1: Fix the existing test whose selector becomes ambiguous, and add the new reveal tests**

In `src/app/ui/PlayerScreen.test.tsx`:

**(a)** The existing test "tapping the solution point shows Correct and advances on Next" uses a topic-2 capture puzzle (it has `captured`). Once the reveal renders `PayoffBoard`, both Feedback's "Next →" and PayoffBoard's "Next move ▸" match `/Next/`. Change the queue-advance click to the unambiguous Feedback label. Replace this line:
```ts
    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
```
with:
```ts
    fireEvent.click(screen.getByRole("button", { name: /Next →/ }));
```

**(b)** Append two new tests inside the `describe("PlayerScreen", …)` block:
```ts
  it("a solved capture puzzle reveals the stepped capture (Next move ▸) and stepping removes the captured stone", () => {
    // the module-level `bank` is a topic-2 capture puzzle (captured: [{x:2,y:2}])
    const pb = new PuzzleBank(bank);
    const vm = new PlayerViewModel(pb, new ProgressStore(mem(), pb.rungRefs()), 2, 1);
    const { container } = render(<PlayerScreen player={vm} onExit={vi.fn()} />);
    const tap = Array.from(container.querySelectorAll("[data-tap]")).find(
      (t) => t.getAttribute("cx") === "104" && t.getAttribute("cy") === "144",
    );
    fireEvent.click(tap!); // solve (2,3)
    expect(screen.getByText(/Correct/)).toBeDefined();
    // reveal is the stepped payoff, not the static board
    const stepBtn = screen.getByRole("button", { name: /Next move/i });
    // captured white stone (2,2) is present at step 0, gone after stepping
    const whites = () => Array.from(container.querySelectorAll("circle.stone"))
      .filter((c) => c.getAttribute("fill") === "var(--white)");
    expect(whites()).toHaveLength(1);
    fireEvent.click(stepBtn);
    expect(whites()).toHaveLength(0);
  });

  it("a solved non-capturing move reveals statically (no Next move ▸)", () => {
    const plainBank: Bank = { seed: 0, stage: "A", puzzles: [{
      id: "nc", topic: 4, rung: 1, mode: "M", size: 5, toPlay: "b", prompt: "Escape.",
      stones: [{ x: 1, y: 1, c: "b" }, { x: 0, y: 1, c: "w" }, { x: 1, y: 0, c: "w" }],
      solution: { kind: "move", points: [{ x: 1, y: 2 }] }, // no `captured`
    }]};
    const pb = new PuzzleBank(plainBank);
    const vm = new PlayerViewModel(pb, new ProgressStore(mem(), pb.rungRefs()), 4, 1);
    const { container } = render(<PlayerScreen player={vm} onExit={vi.fn()} />);
    const tap = Array.from(container.querySelectorAll("[data-tap]")).find(
      (t) => t.getAttribute("cx") === "64" && t.getAttribute("cy") === "104", // (1,2)
    );
    fireEvent.click(tap!); // solve (1,2)
    expect(screen.getByText(/Correct/)).toBeDefined();
    expect(screen.queryByRole("button", { name: /Next move/i })).toBeNull();
  });
```

- [ ] **Step 2: Run the tests to verify the new ones fail**

Run: `npx vitest run src/app/ui/PlayerScreen.test.tsx`
Expected: FAIL — the "stepped capture" test fails because the capture puzzle still reveals via the static `Board` (no "Next move ▸" button; `getByRole` throws "Unable to find role button with name /Next move/i"). The "non-capturing" test and the edited existing test should pass. (If the edited existing test were left as `/Next/`, it would now fail with a multiple-elements error — the edit in Step 1a prevents that.)

- [ ] **Step 3: Wire `captureRevealPayoff` into `PlayerScreen`**

In `src/app/ui/PlayerScreen.tsx`:

**(a)** Add the import near the other model imports (after the `MASTERY` import line):
```ts
import { captureRevealPayoff } from "../model/sequence";
```

**(b)** Compute the reveal payoff. After this line:
```ts
  const playPoint = (point: Pt) => { setPick(point); submit({ kind: "move", point }); };
```
add:
```ts
  // Ladders/nets/snapbacks carry a stored payoff; capture topics derive a 1-move payoff
  // so their reveal steps the capture instead of snapping. Non-capturing moves get
  // undefined here and fall back to the static reveal below.
  const revealPayoff = p.payoff ?? captureRevealPayoff(p);
```

**(c)** In the `board-hold` block, change the branch condition and the payoff prop. Replace:
```tsx
        {resolved && p.payoff ? (
          <PayoffBoard key={p.id} puzzle={p} payoff={p.payoff} pick={pick ?? undefined} />
        ) : (
```
with:
```tsx
        {resolved && revealPayoff ? (
          <PayoffBoard key={p.id} puzzle={p} payoff={revealPayoff} pick={pick ?? undefined} />
        ) : (
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/app/ui/PlayerScreen.test.tsx`
Expected: PASS — all PlayerScreen tests green, including the edited existing test and the two new reveal tests.

- [ ] **Step 5: Run the full suite, typecheck, and build**

Run: `npm test`
Expected: PASS — full suite green.

Run: `npm run typecheck`
Expected: no errors.

Run: `npm run build`
Expected: `tsc --noEmit` clean, Vite build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/app/ui/PlayerScreen.tsx src/app/ui/PlayerScreen.test.tsx
git commit -m "$(cat <<'EOF'
feat(app): animate the capture on reveal for capture topics

PlayerScreen computes p.payoff ?? captureRevealPayoff(p), so capture
topics (2, 3, capturing 7) reveal through the stepped PayoffBoard
(Next move ▸ / Replay) instead of snapping. Ladder/net/snapback reveals
and non-capturing reveals are unchanged.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013CsZD5HwrD78GC6o8uPZ5F
EOF
)"
```

---

## Manual verification (after both tasks)

Run `npm run dev` and, in the browser:
1. Enter topic 2 (Capture a stone). Solve a puzzle. The reveal shows **Next move ▸** (not a static board); tapping it places your stone and the captured stone lifts off; **Replay** repeats.
2. Enter topic 10 (Net) — its multi-move payoff reveal is unchanged.
3. Enter topic 1 (Liberties) or a non-capturing topic-7 puzzle — reveal is static (no Next move ▸), as before.

## Self-review notes (author)

- **Spec coverage:** helper + guards (Task 1); PlayerScreen one-line branch swap (Task 2 Step 3); stepped/consistent UX and reduced-motion-for-free (inherited from reusing PayoffBoard); capture-reveal and non-capture-reveal tests (Task 2 Step 1b); helper unit tests incl. undefined cases and the positionAt fold (Task 1 Step 1). All covered.
- **Type consistency:** `captureRevealPayoff(puzzle: Puzzle): DemoMove[] | undefined` is defined in Task 1 and consumed identically in Task 2; `revealPayoff` is `DemoMove[] | undefined`, matching `PayoffBoard`'s `payoff: DemoMove[]` only in the truthy branch.
- **Regression guard:** the existing capture-puzzle test's `/Next/` selector is disambiguated to `/Next →/` (Task 2 Step 1a) because the reveal now also renders "Next move ▸".
- **No bank/generator/model-headless violations.**
