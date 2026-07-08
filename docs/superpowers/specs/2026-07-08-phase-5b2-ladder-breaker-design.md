# Phase 5b.2 — Ladder-breaker (topic 9) Design Spec

**Date:** 2026-07-08
**Status:** design complete (prototyped — see §9); ready for implementation planning.
**Part of:** Stage B.2 (sequence engine + ladders). This is the second and final slice of Phase 5b; it closes the last curriculum gap (…8, **9**, 10, 11).

Builds on **5a** (move-sequence `payoff`, `PayoffBoard`, `useSequencePlayer`) and **5b.1** (topic 8 ladder, `captureLine`, the Q-binary/lesson patterns). The engine still never ships to the client.

---

## 1. Overview

A ladder-breaker is a stone sitting in a ladder's path that lets the hunted stone connect and escape. The skill topic 9 teaches is the one a beginner most needs: **read whether a ladder actually works before you play it.** The puzzle is a recognition judgment:

> **If Black ladders the marked stone, is it caught?** — the learner answers **Caught** or **Escapes**.

The ground truth is the engine's `capturedUnderBestPlay`: *caught* = it returns true (some ladder direction captures), *escapes* = it returns false (no ladder direction works — a breaker defeats them). This makes the yes/no answer unambiguous.

On reveal:
- **Caught** → the working ladder plays out to the capture, animated (reuse 5b.1's `captureLine` → `payoff`, 5a's `PayoffBoard`).
- **Escapes** → the single **breaker** stone is ringed, with a caption naming it. We do **not** animate the escape — prototyping proved a clean "connect to the breaker" escape animation is impractical to generate and a messy one would confuse (§9). Highlighting the breaker teaches the actual skill (spot it before you ladder).

**Scope boundaries (YAGNI):**
- **No escape animation.** Escapes reveal a ringed breaker + caption only.
- **No new mode / view-model / tree.** Reuses the existing `Q-binary` app; `PlayerViewModel` and `checkAnswer` are untouched.
- **No change to committed topics.** Topic 9 is appended last in the bank; the existing 400 puzzles stay byte-identical. The topic-5 Q-binary bank is untouched (the choice labels live in the UI, not the data).

---

## 2. Puzzle shape & data

Reuses the existing `Q-binary` puzzle shape plus one new optional field:

```ts
mode: "Q-binary"
toPlay: "b"
solution: { kind: "choice", id: "caught" | "escapes" }
marks: [{ x, y, kind: "mark" }]        // ring on the White target being judged
// caught puzzles also carry:
payoff?: DemoMove[]                     // the capture line (5a field, reused) — move 0 is Black's opening atari
// escapes puzzles also carry:
breaker?: Pt                            // NEW optional field (both mirrored types.ts) — the culprit White stone
```

- `breaker` is added to both `src/generator/types.ts` (`Point`) and `src/app/model/types.ts` (`Pt`), matching the mirror convention.
- Exactly one of `payoff` (caught) / `breaker` (escapes) is present per topic-9 puzzle.
- Prompt: *"If Black ladders the marked stone, is it caught?"*
- Balanced **10 caught / 10 escapes** per rung (mirrors topic 5's balance). Both rungs **9×9** (ladders + a breaker need room). **Rung 1** = breaker close to the target / short ladder (obvious). **Rung 2** = breaker further down the diagonal / longer read (subtle).

---

## 3. Generator (topic 9, build-time only)

New `src/generator/topics/ladderbreaker.ts`, reusing `capturedUnderBestPlay`, `captureLine`, `annotate`. A shared helper builds the clean base ladder shape (target with 2 liberties, ≤1 diagonal wall stone, no Black helper in atari) — the same construction 5b.1 uses.

- **Caught puzzle:** base shape with `capturedUnderBestPlay(board, target, "b", 12) === true`; `captureLine(board, target, "b", 12)` → `payoff` via `annotate` (require ≥ 2 Black moves so it's a real ladder). Verify the payoff replays to the target's capture. No unique-opening constraint — the payoff is a demonstration, not a graded move.
- **Escapes puzzle:** start from a base shape that *is* caught, then plant a White stone at a random empty point **≥ 2 (Manhattan) from the target** and re-test; keep planting/backtracking until `capturedUnderBestPlay` flips to **false** while the shape stays clean (breaker settled ≥ 2 liberties, no Black helper in atari). Then require an **identifiable single breaker**: a White stone whose removal flips `capturedUnderBestPlay` back to **true**. Store that stone as `breaker`. If no single stone is the culprit (the target merely runs to open space), **reject** the shape — this guarantees a clean "this stone breaks it" story and filters out messy escapes.
- Balanced half/half via need/have counters (topic-5 pattern); deterministic; fail-loud if a rung can't fill 20. Prototyping: both classes yield strongly (~hundreds found per ~2500 tries on 9×9).

The search depth `12` is used consistently for generation and the bank's re-verification.

---

## 4. Reveal UX

On resolve (`correct` or `revealed`), `PlayerScreen` branches on the puzzle:
- **`payoff` present (caught):** render `PayoffBoard` (animate the capture, Replay), with a caption *"Caught — the ladder works."*
- **`breaker` present (escapes):** render `Board` with the breaker ringed and a caption *"This white stone breaks the ladder — it can't be caught."*

`Board` gains an optional **`breaker?: Pt`** prop that draws a reveal-time warn ring (reusing the existing `--warn` styling); `PlayerScreen` passes it only when resolved. The caption is a small text element shown under the board on reveal for topic 9, chosen by which field the puzzle carries. Unresolved play is unchanged (the learner sees only the target `mark` and the Yes/No buttons).

---

## 5. YesNo input generalization

`src/app/ui/inputs.tsx`'s `YesNo` is currently hardcoded to `"self-atari" | "safe"`. Generalize it:

```ts
interface ChoiceOption { id: string; label: string; }
function YesNo({ options, onPick }: { options: [ChoiceOption, ChoiceOption]; onPick: (id: string) => void })
```

`PlayerScreen` supplies the options from a small **topic-keyed** map:
```ts
const Q_CHOICES: Record<number, [ChoiceOption, ChoiceOption]> = {
  5: [{ id: "self-atari", label: "Self-atari" }, { id: "safe", label: "Safe" }],
  9: [{ id: "caught", label: "Caught" }, { id: "escapes", label: "Escapes" }],
};
```
This keeps the labels in the UI (where they belong), needs **no data field** and **no regeneration of topic 5**, and localizes the only coupling to one map. `checkAnswer` still compares the emitted `id` to `solution.id`.

---

## 6. Lesson + bank + map

- **Concept lesson (topic 9):** a working-looking ladder that fails, hand-authored, with the **breaker ringed** and body text explaining "check the ladder's path for a breaker before you play." Engine-verified in `lessons.verify.test.ts`: the marked target is *not* caught (`capturedUnderBestPlay` false), and **removing the breaker makes it caught** (flips to true) — so the lesson's breaker is provably the culprit. The `LessonDiagram` gains an optional `breaker?: Pt` mirroring the puzzle field; `LessonScreen` rings it. Lesson list → 11 topics.
- **Bank:** `buildBank` appends topic 9 (2 rungs × 20) **last** (after topic 8), so the existing 400 puzzles stay byte-identical → **440**. Deterministic. Map title `9: "Ladder-breaker"`.

---

## 7. Testing

Everything verified — no verdict ships on trust.

- **Generator invariants (topic 9):** caught puzzles' `payoff` replays through `play()` to the target's capture (each stored `captures` engine-truth); escapes puzzles have `capturedUnderBestPlay(target,"b",12) === false` **and** removing the stored `breaker` flips it to `true`; exactly 10 caught + 10 escapes per rung; deterministic; 20 distinct.
- **Bank solvability suite (`src/bank/bank.test.ts`):** a topic-9 block re-derives each verdict from the engine, replays caught payoffs to capture, and re-checks each breaker (removal flips the verdict). 440-count + topic-list updates.
- **Lesson verify:** topic-9 lesson target uncaught; removing its breaker makes it caught.
- **UI:** `YesNo` renders supplied options and emits the right id (unit test with both option sets); a caught topic-9 puzzle animates on reveal; an escapes one rings the breaker + caption; existing topic-5 self-atari Q-binary still renders "Self-atari / Safe" and grades correctly.

---

## 8. Deferred / out of scope

- Escape animation (impractical, §9). If ever wanted, it needs a controlled staircase construction that plants the breaker on the read path — a separate, larger effort.
- Any change to the "hand-play every move" interactive engine (consciously dropped in 5b.1).

---

## 9. Prototyping notes (why this design)

Before writing the plan, the generator and an escape-line extractor were prototyped against the real engine:
- **A clean "watch White escape into the breaker" animation is impractical.** A controlled construction (plant the breaker on the working ladder's read path, require the escaped group to include the breaker) found **0 in 200k tries**; a loose construction found escapes at only ~0.7% and the demos were pedagogically muddy (White ran to open space or captured a chasing stone rather than connecting to the breaker). Hence: no escape animation.
- **Recognition + breaker-highlight is cheap and clean.** Deriving the verdict from `capturedUnderBestPlay` and, for escapes, requiring an *identifiable single breaker* (a White stone whose removal flips the verdict) yielded **caught ≈ 760 and escapes ≈ 400 in ~2500 tries** on 9×9, with clean single-breaker fixtures (e.g. target (3,6), breaker (3,8)). This is the basis for the design.
