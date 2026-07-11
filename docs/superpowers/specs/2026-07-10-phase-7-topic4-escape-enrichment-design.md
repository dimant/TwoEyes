# Phase 7 — Topic 4 (Escape atari) enrichment — Design

## Problem

The Topic 4 generator (`src/generator/topics/escape.ts`) is structurally
monotonous. Every puzzle is a **single** black stone in atari, and the answer is
always "play the one empty adjacent point." A learner solves it without reading —
the escape move is the lone visible gap. It is the weakest generator in the bank.

A subtlety constrains what "enrichment" can add: once a group is *already in
atari* (exactly 1 liberty), the extend move is **forced** — there is only one
liberty to play at. So the classic "which way do I run?" reading cannot appear by
extending within a single-move puzzle; that skill lives in the Ladder topic (8).
Enrichment therefore comes from (a) varied group shapes and (b) a genuinely
different escape *method*.

## Goal

Turn Topic 4's two rungs into two **distinct** sub-skills, keeping the envelope
unchanged: 2 rungs × 20 = **40 puzzles**, mode `M`, size 7, bank stays at **440**.

## Design

### Rung 1 — Run to safety (extend), richer shapes

- Target is a black **group of 1–3 stones** in atari (today: always exactly 1).
  Escape = play the single liberty; the resulting group must have ≥2 liberties.
- Keep the existing guard that **every white attacker is settled** (≥2 liberties),
  so rung 1 stays *pure extension* — no capture-to-escape leaks in (that is
  rung 2's job).
- Mix interior + edge shapes within the rung. Curate by group size (existing
  `curateRung` buckets by stone count for M puzzles) so the learner meets a lone
  stone first, then 2- and 3-stone groups.

### Rung 2 — Capture the attacker to escape (new method)

The endangered black group is in atari at liberty **L**. An adjacent white group
is *itself* in atari at a **different** point **C**.

- **Solution = play C** → captures the white group → the freed spaces give the
  black group ≥2 liberties.
- **Discriminator (the lesson):** playing **L** (plain extension) must **not**
  rescue Black — afterward Black is still in atari, or the move is illegal
  (self-atari/suicide). Because running fails, capturing the attacker is the only
  idea that works. This is the skill: *don't just run — capture the attacker.*
- The capturing point **C must differ from L**, otherwise "extend" and "capture"
  collapse into the same forced move and no new skill is taught.
- Prompt stays generic ("Black to play — save your group") so the method is not
  given away; recognising "I must capture" is the puzzle.

### Marks

Mark **all stones of the target group** (today marks only the single target
stone), so the learner sees the whole endangered group.

### RNG isolation (reproducibility)

The bank is generated from a single shared RNG stream threaded topic-by-topic in
`buildBank` (`src/generator/cli.ts`). Topic 4 sits mid-stream, so changing its
generator would shift the RNG for every topic generated after it (5, 6, 7, 10,
11), churning their committed puzzles even though we did not touch them.

To avoid that: the enriched escape generator draws from its **own derived seed**
(independent RNG) and is invoked at the **end** of `buildBank`, exactly as topics
8 and 9 were appended. The shared stream that topics 5/6/7/10/11 consume is left
untouched.

- Acceptance: after regeneration, every topic's puzzles in `bank.json` **except
  Topic 4** are byte-for-byte identical to the previous bank. Only Topic 4's 40
  puzzles change.

## Testing

All content is engine-verified, per project principle.

- **Rung 1** (`escape.test.ts`): target starts in atari (1 liberty); every listed
  solution move rescues the target to ≥2 liberties; no white attacker is in atari
  (attackers settled); target group size within 1–3; deterministic (same seed →
  same output).
- **Rung 2**: target starts in atari; the solution move captures a white group
  (opponent stones removed); **extend-at-own-liberty (L) does not rescue** the
  target; every solution rescues to ≥2 liberties; deterministic.
- **Bank solvability suite** (`bank.test.ts`): extend to assert the new Topic 4
  invariants across the committed bank.
- **Fail-loud**: each rung throws if it cannot fill 20 puzzles (existing guard
  pattern). Rung 2 is the harder construction — if 20 cannot be found on 7×7, the
  guard surfaces it loudly rather than shipping a short rung.
- **Reproducibility check**: a test (or a documented manual diff step) confirming
  non-Topic-4 puzzles are unchanged after regeneration.

## No UI changes

Puzzles remain single-move `M`. Capture-to-escape reveals already animate through
the Phase 6 `PayoffBoard` capture stepping; no player/board changes are needed.

## Out of scope

- Smith 1908 problem tier (separate Phase 7 item; its own spec/plan/build cycle).
- Any change to other topics' generators or the bank envelope (still 440).
- Keyboard board input (dropped from Phase 6).

## Risks

- **Rung 2 construction yield.** Boards where capture escapes *and* extension
  fails are rarer than plain-extend boards. Mitigation: brute-force verify
  candidates with the engine; widen search (guard multiplier) before shipping;
  if 7×7 is too tight, the fail-loud guard forces a revisit rather than a silent
  short rung.
