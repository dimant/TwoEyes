# Phase 5b.1 — Ladder (8) via animated payoff Design Spec

**Date:** 2026-07-07
**Status:** design complete (revised after prototyping — see §9); ready for implementation planning.
**Part of:** Stage B.2 (sequence engine + ladders). Phase 5b is split into two slices:
- **5b.1 (this spec)** — the **Ladder (topic 8)** generator, presented as a **pick-the-start-then-watch-it-resolve** puzzle that reuses 5a's animated payoff.
- **5b.2 (later spec)** — the **Ladder-breaker (topic 9)** generator (recognise when a ladder *fails*), building on this slice's ladder generator.

Builds directly on **5a**, which shipped the move-sequence primitive (`DemoMove`, `annotate`), the capture-line extractors (`captureLine`, `snapbackLine`), the pure fold (`positionAt`), the animation hook (`useSequencePlayer`) and `PayoffBoard`, and the payoff-reveal path in `PlayerScreen`.

---

## 1. Overview

A ladder (*shicho*) is the first tactic that requires reading a *sequence*: Black repeatedly ataris a stone that can't escape, chasing it diagonally to the edge where it dies. Topic 8 teaches it as:

> **Black to play — start the ladder to catch the stone.** The learner taps the one **opening atari** that begins a working ladder; on a correct tap the **whole ladder plays out move-by-move** (Black chases, White runs, … capture) via 5a's animation.

This is the **pick-the-start-then-watch-it-resolve** model. It is deliberately *not* a hand-play-every-move interaction: a ladder on an open board works whichever direction you chase it (Black builds the containing wall as it goes; a ladder only fails against a *breaker* — topic 9). So "keep it in atari" has two legitimately-correct answers at most steps, and grading every move would either reject correct moves or require a precomputed branching tree. The decision skill a beginner actually needs — *recognise a ladder and start it the right way* — lives in the **opening move**, and it is also exactly the skill topic 9 (breaker recognition) will need. (Prototyping that drove this decision: §9.)

The engine still **never ships to the client**: the full ladder line is extracted and verified at build time (reusing 5a's `captureLine`) and stored as the puzzle's `payoff`. The runtime is unchanged — it replays dumb, pre-verified data.

**Scope boundaries (YAGNI):**
- **No new interaction mode, no new view-model, no solution tree.** Topic 8 is an ordinary `mode: "M"` tap puzzle with a `payoff`, reusing 5a's reveal-animation path in `PlayerScreen` **unchanged**. `PlayerViewModel`, `checkAnswer`, the map, progression, and 5a's puzzles are all untouched.
- **Unique opening atari.** The generator keeps only ladders where **exactly one** opening atari captures (prototyping confirms this is common). So the solution is a single point, grading is unambiguous, and the animated payoff matches the learner's tap.
- **No ladder-breaker (topic 9).** That is slice 5b.2.

---

## 2. Data model

**No changes to the type system.** Topic 8 reuses the existing `Puzzle` shape and 5a's optional `payoff?: DemoMove[]`:
- `mode: "M"`, `toPlay: "b"`.
- `solution: { kind: "move", points: [openingAtari] }` — a single point (the unique opening atari).
- `payoff: DemoMove[]` — the full verified ladder line `[b_atari, w_run, b_atari, w_run, …, b_capture]`, move 0 being the opening atari (so move 0 equals the solution point, matching 5a's invariant).
- `marks: [{ x, y, kind: "mark" }]` — a ring on the White target being hunted.

The existing `PlayerScreen` payoff path renders it: correct tap → the payoff auto-plays once (Replay button); 2 misses → the payoff is revealed the same way (no mastery). Reduced-motion snaps to the final position. All of this is 5a behaviour, reused as-is.

---

## 3. Ladder generator (topic 8, build-time only)

Reuses 5a's `capturedUnderBestPlay` / `captureLine` / `annotate`. Construct-and-verify per the established pattern:

1. Place a White target with **2 liberties** (place the stone, fill two of its neighbours with Black, optionally add one Black "wall" stone diagonally) in a random position/orientation. Reject if any Black helper is itself in atari (clean shape).
2. **Unique opening atari:** among the target's two liberties, exactly one Black atari must lead to capture under best play — `capturedUnderBestPlay(afterAtari, target, "w", 8) === true` for one liberty and the target actually left in atari (1 liberty) by that move. Reject if zero or both work. This single winning atari is the solution point.
3. `captureLine(board, target, "b", 8)` extracts the full forced line **starting from Black to move** (so move 0 is the opening atari itself — no manual prepend needed). Require ≥ 2 Black moves (a real multi-step ladder, not a one-move capture).
4. `annotate(size, stones, line)` replays the line through `play()`, so every `captures` is engine-truth; the result is the `payoff`. Assert it replays to the target's removal.

**Rung ramp** (prototyping confirms both fill 20 comfortably — §9):
- **Rung 1 — 7×7, short:** the plain mechanic; a short ladder (typically 2–4 Black moves) with one winning opening direction.
- **Rung 2 — 9×9, tempting wrong turn:** additionally require the target's **other** atari to be a *legal atari that escapes* (`capturedUnderBestPlay` is `false` for it) — a tempting move that fails, so the learner must choose the right direction on a bigger board. `9×9` is a new board size; `Board` already renders any size (CELL-based `viewBox`).

Deterministic under the committed seed; fail-loud if a rung can't fill 20 distinct puzzles.

---

## 4. Grading

Unchanged — `checkAnswer` already handles `mode: "M"` with a single-point `move` solution. A tap equal to the opening atari is correct; anything else is a miss (2 misses → reveal). No new grading code.

---

## 5. UI

**No `PlayerScreen` changes for the mechanic.** Topic 8 is a payoff-bearing `"M"` puzzle, so it already flows through the 5a reveal-animation path (correct/revealed + `payoff` → `PayoffBoard`). The prompt reads *"Black to play — start the ladder to catch the stone."*

**Concept lesson:** topic 8 gets its own **animated** concept lesson (reusing 5a's lesson-payoff path) — a short ladder played out move-by-move, hand-authored and engine-verified in `lessons.verify.test.ts`. Auto-opens on first entry; reopenable via **Learn**. The lesson list grows to 10 topics (…7, **8**, 10, 11).

---

## 6. Progression + bank + map

- Reuses mastery = 4 clears a rung, linear-with-preview unlock, and triple-tap skip-ahead unchanged. Topic 8 appears on the map between 7 and 10, filling a curriculum gap.
- `buildBank` (`cli.ts`) wires topic 8 (2 rungs × 20) with the existing difficulty-interleave curation; a topic title is added. Bank grows **360 → 400**. `npm run generate` stays deterministic.

---

## 7. Testing

Everything verified — no ladder ships on trust.

- **Generator invariants (topic 8):** every ladder has exactly one winning opening atari (the solution); its `payoff` replays through `play()` from the initial position to the target's capture with each stored `captures` matching the engine; move 0 equals the solution point; ≥ 2 Black moves; rung 2's *other* atari is a legal atari that escapes (real choice); 20 distinct per rung; deterministic.
- **Bank solvability suite (`src/bank/bank.test.ts`):** a topic-8 block replays each committed ladder's payoff end-to-end to the capture, re-checks the unique-winning-opening invariant against the engine, and (rung 2) the failing alternate.
- **Lessons (`lessons.verify.test.ts`):** the topic-8 lesson ladder line replays to a capture.
- **UI integration:** already covered by 5a's payoff path; add one check that a topic-8 puzzle (single-point solution + payoff) shows the animated ladder on a correct tap.

---

## 8. Deferred to 5b.2 / later (out of scope here)

- **Ladder-breaker (topic 9)** generator — the same ladder shapes but with a White stone planted in the ladder's path so the chase *fails*; the puzzle asks the learner to recognise it (e.g. Q-binary "does this ladder work?" or "find the atari that actually works"). Reuses this slice's ladder generator and the capture-reader. Bank → ~420. (5b.2)
- **Hand-play-every-move** interaction with a full solution tree (accept either direction, follow the chosen branch). Deferred unless a later phase wants the deeper interactive engine. (later)

---

## 9. Prototyping notes (why this design)

Before writing the plan, the ladder generator was prototyped against the real engine:
- **Full move-by-move grading is infeasible for clean ladders.** Across 600 generated ladders, ~none had a unique correct move at *every* step — a step commonly has two valid atari directions, because an open-board ladder works whichever way it's chased. Hand-playing every move would therefore either reject genuinely-correct moves or require a precomputed branching tree.
- **The opening move, by contrast, is cleanly unique.** Requiring exactly one winning opening atari yields ladders readily: ~44% of candidate shapes on 7×7 and ~36% on 9×9 (with the failing-alternate constraint) qualified, and every extracted `payoff` replayed to the target's capture. This is the basis for the pick-the-start-then-watch model.
