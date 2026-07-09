# Phase 6 — Animate the capture on reveal (design)

**Status:** approved, ready for planning
**Date:** 2026-07-08
**Phase:** 6 (Interaction & UX polish), item 1 of 3

## Goal

The capture topics reveal the answer **statically** — the board snaps to show the
played stone (ghost + accent ring) and the captured stones dimmed with a dashed ring.
This item makes the capture *play out* instead: the reveal steps the capturing move so
the learner sees the stone go down and the captured stones lift off the board.

Topics 8/9/10/11 already animate their reveal via a stored `payoff` rendered by
`PayoffBoard` (a user-stepped **Next move ▸** / **Replay** control). This item brings the
capture topics onto that same path with **no new content and no new animation
mechanism** — a capturing move is a single `DemoMove`, derived at the view from data the
bank already carries and verifies.

## Audit (what actually snaps)

Per-topic `captured[]` / `payoff` presence in the committed bank:

| Topic | Mode | Captures on the move? | Reveal today |
|------:|------|-----------------------|--------------|
| 1 Liberties | Q-count | no | static (no move) |
| 2 Capture a stone | M | **yes — 40/40 `captured`** | **static (snaps)** |
| 3 Capture a group | M | **yes — 40/40 `captured`** | **static (snaps)** |
| 4 Escape atari | M | no | static |
| 5 Don't self-atari | Q-binary | no | static |
| 6 Double atari | M | no (sets up, no immediate capture) | static |
| 7 Connect & cut | M | **20/40 `captured`** | **static (snaps) for the 20** |
| 8 Ladder | M | via `payoff` (40/40) | animated (stepped) |
| 9 Ladder-breaker | Q-binary | via `payoff` (20/40) | animated (stepped) |
| 10 Net | M | via `payoff` (40/40) | animated (stepped) |
| 11 Snapback | M | via `payoff` (40/40) | animated (stepped) |

**In scope:** topics 2, 3, and the 20 capturing puzzles of 7. Topics 1/4/5/6 and the 20
non-capturing puzzles of 7 have no single capturing move and stay static.

## Decisions (from brainstorming)

1. **Reveal UX:** reuse the existing stepped `PayoffBoard` (Next move ▸ / Replay) — fully
   consistent with topics 8/10/11. Not a new timed/auto-play animation (the project has
   deliberately avoided auto-advance; `useSequencePlayer` notes this).
2. **Payoff source:** derive the 1-move payoff **at the view** from `solution` +
   `captured`. No generator/bank change. Unlike ladder/net payoffs (genuine multi-move
   sequences that must be stored), a capture is trivially derivable from already-verified
   fields, so storing it would duplicate derivable data and churn ~100 puzzles.

## Design

### 1. Derivation helper — `src/app/model/sequence.ts`

A pure, engine-free function beside `applyDemoMove` / `positionAt`:

```ts
export function captureRevealPayoff(puzzle: Puzzle): DemoMove[] | undefined
```

Returns a **single-move payoff** when the solving move captures, else `undefined`:

- Guard: `puzzle.mode === "M"`, `puzzle.solution.kind === "move"`,
  `puzzle.solution.points.length >= 1`, and `puzzle.captured?.length` is truthy.
- On match: `[{ x: p.x, y: p.y, c: puzzle.toPlay, captures: puzzle.captured }]` where
  `p = puzzle.solution.points[0]`.
- Otherwise: `undefined`.

Stepping this through the existing `positionAt(initial, payoff, step)` yields, at step 1,
`initial − captured + playedStone` — the correct post-capture position. `applyDemoMove`
already drops `captures` before placing the stone.

`Puzzle`, `DemoMove` types are already defined in `src/app/model/types.ts`; the helper
imports only types (stays headless, no React/engine dependency).

### 2. Wiring — `src/app/ui/PlayerScreen.tsx`

The resolved board branch today is:

```tsx
{resolved && p.payoff ? (
  <PayoffBoard key={p.id} puzzle={p} payoff={p.payoff} pick={pick ?? undefined} />
) : (
  <Board puzzle={p} reveal={resolved} breaker={resolved ? p.breaker : undefined}
    pick={pick ?? undefined} onTapPoint={p.mode === "M" && !resolved ? playPoint : undefined} />
)}
```

Compute the reveal payoff once and branch on it:

```tsx
const revealPayoff = p.payoff ?? captureRevealPayoff(p);
```

Then `resolved && revealPayoff ? <PayoffBoard … payoff={revealPayoff}/> : <Board …/>`.
Capture puzzles now render `PayoffBoard`; stored-payoff topics keep their payoff;
everything else stays on the static `Board`. This is the only UI change — a one-line
branch swap plus the computed value.

`captureRevealPayoff` returns `undefined` before the puzzle resolves and for
non-capturing puzzles, so the unresolved play board and all non-capture reveals are
unchanged.

### 3. Consistency notes

- Same UX as topics 8/10/11: reveal opens at the pre-move position with the learner's
  `pick` ring at their chosen point; **Next move ▸** plays the stone and fades the
  captured stones off the board; **Replay** repeats. (`PayoffBoard` already receives and
  renders `pick`.)
- Reduced-motion needs no new handling: stepping is a discrete user action and the
  per-stone CSS fade already respects `prefers-reduced-motion` (existing behavior).

## Testing

**`src/app/model/sequence.test.ts`**
- `captureRevealPayoff` returns `[{ move, c: toPlay, captures }]` for a capture puzzle
  (M mode, `captured` non-empty), using `solution.points[0]`.
- Returns `undefined` when `captured` is absent/empty.
- Returns `undefined` for a non-`move` solution (e.g. Q-binary `choice`).
- Returns `undefined` for a non-`M` mode.
- Stepping the returned payoff via `positionAt(stones, payoff, 1)` produces
  `stones − captured + playedStone` (drops the captured stone, adds the played one).

**`src/app/ui/PlayerScreen.test.tsx`**
- Solving a capture puzzle (M mode with `captured`) reveals `PayoffBoard`: a
  **Next move ▸** control appears, and stepping it removes the captured stone from the
  board.
- Solving a non-capturing M puzzle (no `captured`) still reveals the static `Board` —
  no Next-move control.

## Out of scope

- The light/dark toggle + keyboard-accessible board item (its own spec → plan → build).
- Double-atari (topic 6) follow-up captures — the solving move creates the double atari
  but captures nothing immediately, so there is no single capturing move to animate.
- Any generator or bank change.

## Files touched

- `src/app/model/sequence.ts` — add `captureRevealPayoff`.
- `src/app/model/sequence.test.ts` — helper tests.
- `src/app/ui/PlayerScreen.tsx` — compute `revealPayoff` and branch on it.
- `src/app/ui/PlayerScreen.test.tsx` — capture-reveal + non-capture-reveal tests.
