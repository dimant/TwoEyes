# Phase 5a — Move-sequence primitive + animated payoff Design Spec

**Date:** 2026-07-07
**Status:** design complete; ready for implementation planning.
**Part of:** Stage B.2 (sequence engine + ladders). Phase 5 is split into two slices built in order:
- **5a (this spec)** — a pre-computed, engine-verified *move-sequence primitive* and the **non-interactive animated payoff** it powers (net/snapback puzzle reveals + their lessons play the capture out move-by-move).
- **5b (later spec)** — the **interactive** sequence player + **Ladder (8)** / **Ladder-breaker (9)** generators, built on 5a's proven primitive.

---

## 1. Overview

Today a solved/revealed puzzle snaps to a static answer (a ghost stone on the solving point). For **nets** and **snapbacks** that hides the whole point of the tactic — *why* can't the stone escape, and *how* does the recapture work. 5a makes the payoff visible: on reveal, the board **plays the capture line out move-by-move**, then offers a **Replay**.

The key architectural move: all three Phase-5 payoff features reduce to **one shared primitive** — an ordered list of pre-computed, engine-verified board moves (each carrying the stones it removes). 5a builds that primitive and its non-interactive player; 5b reuses the same data shape for interactive ladder play. Because the line is fully computed and verified at build time, the **rules engine never ships to the client** — the animator only places and removes exactly what the data says.

**Scope boundaries (YAGNI):**
- **No interactivity.** The learner does not play the line; it auto-plays. Interactive "you play → engine responds" is 5b.
- **No ladders**, no new topics, no generator for topics 8/9. 5b.
- **No generalization** to every topic's reveal. Only net (10) and snapback (11) get a payoff line in 5a. The broader "animate the capture on any reveal" is Phase 6.
- **No `PlayerViewModel` change.** The payoff is static data on the puzzle; animation is a pure view concern.

---

## 2. The move-sequence primitive (data model)

A payoff is an ordered list of moves. Each move carries the stones it removes, so the client needs no rules logic to replay it:

```ts
type Color = "b" | "w";
interface Pt { x: number; y: number; }

interface DemoMove {
  x: number; y: number;   // where the stone is placed
  c: Color;               // who plays it
  captures?: Pt[];        // stones removed by this move (for fade-out); omit if none
}

// New optional field on Puzzle (generator + app/model, both hand-mirrored copies)
// and on LessonDiagram:
payoff?: DemoMove[];
```

- The line **starts from the puzzle's initial `stones`**. Applying `payoff` in order — place `(x,y,c)`, then remove `captures` — reconstructs the final position.
- **Move 0 is the solving move** (Black), then moves alternate Black/White as the tactic plays out.
- `payoff` is optional and absent everywhere it isn't authored/generated; puzzles without it keep today's static reveal unchanged.
- Added to **both** hand-maintained `types.ts` copies (`src/generator/types.ts`, `src/app/model/types.ts`) so they don't silently diverge, matching the existing mirror convention.

---

## 3. Generator / reader changes (build-time only)

Every payoff line is produced by replaying moves through the real engine (`play()`), so each stored `captures` list is engine-truth by construction — nothing is hand-counted.

### 3.1 Snapback
`snapbackWorks` already computes the three plies (throw-in → White fills the last liberty, capturing the throw-in → Black recaptures the now-short White group). Extend it (or add a sibling) to also return those **3 `DemoMove`s** with their captures, so the generator can attach the line. The verified recapture count is unchanged.

### 3.2 Net (geta)
Add an extractor beside `capturedUnderBestPlay` (same file, build-time only) that returns the **"White resists longest, still captured"** line:
- **Attacker (Black) minimizes**, **defender (White) maximizes resistance.** Because `capturedUnderBestPlay` already proves *every* White reply is caught, we pick, at each White turn, the reply that survives the **most** plies — the most stubborn escape attempt — and the Black reply that captures it. This shows White trying hardest and dying anyway, which is exactly the pedagogy of a net.
- The line is replayed through `play()` and ends when the White target is removed (the final Black move's `captures` includes the target group).
- **Line length is bounded** by the reader's search depth (rung 1 depth 4, rung 2 depth 8) on small 7×7 frames, so payoffs are short (a handful of plies).
- **Move 0** is the netting move already stored in the puzzle's `solution.points`. When a net has multiple valid net points (any-valid), the payoff is generated from the **canonical/first** solution point; the demo shows one concrete correct line.

### 3.3 Bank
`bank.json` regenerates deterministically with `payoff` on all net + snapback puzzles. JSON growth is negligible (~80 puzzles × a few short moves each).

---

## 4. Animation player + Board

### 4.1 `useSequencePlayer` hook (app layer, no engine import)
A small hook drives the timeline:

```ts
useSequencePlayer(initialStones: Stone[], payoff: DemoMove[]):
  { stones: Stone[]; playing: boolean; done: boolean; replay: () => void }
```

- Holds the **current stone set**, starting at `initialStones`. Steps every ~450ms: apply move `i` (add the placed stone, drop its `captures`), advance `i`, stop after the last move.
- **`prefers-reduced-motion`** → jump straight to the final position (no stepping), matching the reveal-UX decision.
- **`replay()`** resets to step 0 and plays again.
- Auto-plays **once** on mount. Pure timeline logic over the data — no go rules, no engine import (keeps the model/app layers engine-free as today).

### 4.2 `Board`
`Board` grows an **optional `stones` override** (plus fade CSS on stone enter/exit). When the override is set, the board renders that evolving set and suppresses the static reveal decorations (ghost solution stone, dashed capture rings); when unset, `Board` behaves **exactly as today**. Capture fade-out reuses the existing `opacity` treatment already in the component.

---

## 5. UI wiring

### 5.1 PlayerScreen
- When the puzzle is **resolved** (`correct` or `revealed`) **and** has a `payoff`, render the **animated board** (fed by `useSequencePlayer`) with a **Replay** button, instead of the static ghost reveal.
- Puzzles **without** a `payoff` (every other topic) keep today's static reveal — no behavior change.
- `PlayerViewModel` is untouched; the screen reads `puzzle.payoff` and owns the animation locally.

### 5.2 LessonScreen
- The **Net** and **Snapback** lessons get a `payoff` on their `LessonDiagram` (hand-authored, engine-verified). The diagram's existing `keyMove` stays the at-rest highlight (initial position, as today); `LessonScreen` adds a play/Replay control that runs the `payoff` with the same auto-play-once treatment. When the payoff is playing, the animated stone set is shown in place of the static diagram.
- Other lessons are unchanged.

---

## 6. Testing

Everything verified — no line ships on trust (project principle).

- **Solvability suite (`src/bank/bank.test.ts`):** for every net and snapback puzzle, replay `payoff` from the initial `stones` through `play()` and assert (a) each stored `captures` equals what `play()` removes, and (b) the final position matches the tactic — the net target group is gone; the snapback recapture removed ≥ the required count. Move 0 must equal a `solution.points` entry.
- **Lessons (`src/app/content/lessons.verify.test.ts`):** verify the two new lesson payoff lines the same way (replay through the engine, assert the capture).
- **Reader/extractor unit tests:** hand-built net fixtures — the extracted line is legal, monotonically progresses, and ends in the target's capture; a shorter-resistance and a longer-resistance White branch both terminate captured.
- **`useSequencePlayer` unit tests (fake timers):** stepping advances one move per tick and applies captures; reduced-motion jumps to the final position; `replay()` restarts from step 0; auto-plays once.
- **Board render test:** with a `stones` override it renders that set and omits the static reveal decorations; without it, unchanged.
- **PlayerScreen / LessonScreen integration:** the reveal path renders the animated board + Replay for a net/snapback puzzle/lesson, and the static reveal for a non-payoff puzzle.

---

## 7. Deferred to 5b / Phase 6 (out of scope here)

- **Interactive sequence player** — "you play the attacker's move → the engine plays the forced reply → repeat, with refutation on wrong moves." Reuses this spec's `DemoMove` shape as its move representation. (5b)
- **Ladder (8)** and **Ladder-breaker (9)** generators, reusing the capture-reader. Bank → ~480. (5b)
- **Generalizing** the animated reveal to every topic's capture (currently only net/snapback). (Phase 6)
