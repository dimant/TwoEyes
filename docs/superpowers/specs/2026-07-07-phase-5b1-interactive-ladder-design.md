# Phase 5b.1 — Interactive sequence player + Ladder (8) Design Spec

**Date:** 2026-07-07
**Status:** design complete; ready for implementation planning.
**Part of:** Stage B.2 (sequence engine + ladders). Phase 5b is split into two slices:
- **5b.1 (this spec)** — the **interactive sequence player** (co-play a precomputed line: tap the move → engine auto-replies → repeat) proven end-to-end with the **Ladder (8)** generator as its first content.
- **5b.2 (later spec)** — the **Ladder-breaker (9)** generator on the proven player.

Builds directly on **5a**, which shipped the move-sequence primitive (`DemoMove`, `annotate`), the capture-line extractors (`captureLine`, `snapbackLine`), the pure fold (`positionAt`), and the animation hook (`useSequencePlayer`) + `PayoffBoard`.

---

## 1. Overview

5a made the app *show* a capture line. 5b.1 makes the learner *play* one. For a ladder (topic 8), the learner taps each atari in turn; the engine auto-plays White's forced run between them; the sequence ends when the last move captures. This turns the app from "solve one move" into "read a sequence" — the spine of the roadmap.

The engine still **never ships to the client**: the whole forced line is extracted and verified at build time (reusing 5a's `captureLine`) and stored on the puzzle as an interactive sequence. At runtime the client walks the precomputed steps — checking the learner's tap, auto-playing the stored reply — with no go rules in the bundle.

**Scope boundaries (YAGNI):**
- **No refutation data.** A wrong move → "try again"; after 2 misses the correct ladder is revealed (animated, no mastery). We do *not* precompute or show White escaping on wrong moves.
- **No ladder-breaker (topic 9).** That is slice 5b.2.
- **One correct move per learner step.** The generator guarantees each step has a *unique* capturing move (see §3), so grading is a simple equality check and the single-move model holds.
- **`PlayerViewModel`, the map, progression plumbing, and 5a's puzzles are untouched.** Topic 8 slots into the existing curriculum gap (…7, **8**, 10, 11).

---

## 2. Data model

A new interactive **mode** and **solution kind**, added to both hand-mirrored `types.ts` (`src/generator/types.ts` and `src/app/model/types.ts`), reusing 5a's `DemoMove`:

```ts
type Mode = "M" | "Q-count" | "Q-binary" | "Q-choice" | "S";   // S = interactive sequence

interface SeqStep {
  play: DemoMove;    // the single correct learner (Black) move at this step, with its captures
  reply?: DemoMove;  // the engine's (White) forced reply, auto-played after a correct move;
                     // absent on the final step (the learner's move captures and ends the line)
}

type Solution =
  | { kind: "move"; points: Pt[] }
  | { kind: "value"; value: number }
  | { kind: "choice"; id: string }
  | { kind: "sequence"; steps: SeqStep[] };   // NEW
```

- The **full line** is the ordered steps. Flattening `steps → [play, reply, play, reply, …]` yields a `DemoMove[]` that feeds 5a's `useSequencePlayer` directly for the reveal/celebration animation — no separate `payoff` field needed for `"S"` puzzles.
- Each `SeqStep.play` is the **one** correct move at that turn (see §3 uniqueness guarantee), so the board advances deterministically and grading is `tap === steps[i].play`.
- The initial position is the puzzle's `stones`; applying step *i*'s `play` then `reply` (via 5a's `applyDemoMove`) reconstructs the position before step *i+1*.

---

## 3. Ladder generator (topic 8, build-time only)

Reuses 5a's `captureLine` / `capturedUnderBestPlay` and `annotate`.

Construct-and-verify, per the established pattern:
1. Place a White target with 2 liberties in a position where a Black atari starts a **working ladder** (the target is driven diagonally toward an edge/corner and captured). Confirm with `capturedUnderBestPlay(afterAtari, target, "w", depth) === true`.
2. `captureLine(afterAtari, target, "w", depth)` returns the forced alternating line (White resists longest, still caught). Prepend the opening Black atari; the result is `[b, w, b, w, …, b]` ending in the target's removal.
3. Convert to `SeqStep[]`: pair each Black move with the following White move as its `reply`; the final Black move (the capture) has no `reply`. Every move is replayed through `play()` via `annotate`, so all `captures` are engine-truth.
4. **Uniqueness guarantee (fair grading):** at each Black step, verify the stored `play` is the *only* Black move that keeps the target captured under best play (all other Black moves at that position let White escape). Reject puzzles where any step has more than one capturing move. This makes the single-correct-move model fair.

**Rung ramp:**
- **Rung 1 — 7×7, short (2–3 ply):** target near an edge so the ladder resolves quickly, with one obvious direction. Learn the mechanic.
- **Rung 2 — 9×9, longer (3–5 ply):** target deeper in the board, and a **tempting alternate opening atari must exist** — the target offers ataris in ≥2 directions, of which the uniqueness check (step 4) guarantees exactly one ladders and the other lets White escape. So the learner must *choose the right direction*, not merely execute the only option.

Cap ladder length to a small bound (a handful of taps); fail-loud if a rung can't fill 20 distinct puzzles; deterministic under the committed seed. `9×9` is a new board size; the `Board` component already renders any size (CELL-based `viewBox`).

---

## 4. Interactive view-model (`SequencePlayerViewModel`)

A new small state machine in `src/app/vm/`, **engine-free and React-free** (like `PlayerViewModel`), walking the precomputed steps via 5a's `positionAt`/`applyDemoMove`:

- **State:** `stepIndex`, `misses`, current `stones` (folded position), `phase`, `mastery`, `done`.
- **Phases:**
  - `awaiting` — learner to tap the move for step `stepIndex`.
  - correct tap (`tap === steps[i].play`) → `replying`: apply `play`, then after a brief beat apply `reply`, advance `stepIndex`. Back to `awaiting` at `i+1`, or `solved` if that was the last step.
  - wrong tap → `wrong` ("Not that one — White slips out. Try again"), `misses++`, stay at `i`.
  - **2 misses → `revealed`:** auto-play the full ladder (flattened steps) via the animation path; no mastery earned.
- **Grading** is the VM's own equality check — `checkAnswer` (single-submit, for M/Q) is untouched. On `solved`, record mastery via the existing `ProgressStore` (4 clears a rung), exactly like `PlayerViewModel`.
- The `replying` beat (show Black's move, ~400ms pause, show White's reply) is driven by a timer; the VM exposes the current `stones` so the view renders the transition (a light fade via the existing stone CSS is enough).

This VM is a sibling to `PlayerViewModel`, not an extension — its state machine is genuinely different (multi-step, engine-reply beat), and a focused file is easier to test and reason about.

---

## 5. UI

- **`PlayerScreen`** branches on `puzzle.mode === "S"` to render the interactive sequence board instead of the single-move board:
  - The current folded position with tap targets enabled; a correct tap plays Black's move, then White's reply appears after a ~400ms beat; a small persistent hint ("keep it in atari").
  - **Reveal** (2 misses) and **solved** reuse 5a's `PayoffBoard` / `useSequencePlayer` to animate the full ladder line (with Replay).
- The `board-hold`/prompt/pips/Learn chrome, exit, and `Feedback` are reused. Non-`"S"` puzzles are entirely unaffected.
- **Concept lesson:** topic 8 gets its own **animated** lesson (reusing 5a's lesson payoff path) — a short ladder played out move-by-move, engine-verified in `lessons.verify.test.ts`. Auto-opens on first entry; reopenable via **Learn**.

---

## 6. Progression + bank

- Reuses mastery = 4 clears a rung, linear-with-preview unlock, and triple-tap skip-ahead unchanged. Topic 8 appears on the map between 7 and 10.
- Bank grows **360 → 400** (topic 8 × 2 rungs × 20 = 40 new). `npm run generate` stays deterministic.

---

## 7. Testing

Everything verified — no sequence ships on trust.

- **Generator invariants (topic 8):** every generated ladder's `steps` replay through `play()` from the initial position to the target's capture; each Black step's stored move is the *unique* capturing move at that position; rung 2's wrong-direction opening atari verified to **not** capture (real choice); each `reply` is White's forced move; 20 distinct per rung; deterministic.
- **Bank solvability suite (`src/bank/bank.test.ts`):** a topic-8 block replays each committed sequence end-to-end and re-checks the per-step uniqueness invariant against the engine.
- **`SequencePlayerViewModel` unit tests:** the full state machine — correct path to `solved`; wrong tap → `wrong` → retry; 2 misses → `revealed`; mastery recorded only on `solved`; `stones` folds correctly at each step.
- **Lessons:** `lessons.verify.test.ts` verifies the topic-8 lesson ladder line (replay → capture).
- **UI integration:** tapping the correct sequence solves and advances; a wrong tap shows retry; the reveal path animates the full ladder; a non-`"S"` puzzle still renders the single-move board.

---

## 8. Deferred to 5b.2 / later (out of scope here)

- **Ladder-breaker (topic 9)** generator — a stone planted in the ladder's path so the ladder *fails*; reuses this slice's interactive player and the capture-reader. Bank → ~420. (5b.2)
- **Showing White escape** on a wrong move (refutation lines). (later, if wanted)
