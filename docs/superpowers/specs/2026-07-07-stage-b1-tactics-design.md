# Stage B.1 — Capturing Techniques (one-movers) Design Spec

**Date:** 2026-07-07
**Status:** design complete; ready for implementation planning.
**Part of:** Stage B (capturing techniques). B.1 = the tactics that reuse the current app; **B.2** (sequence engine + ladders) is a separate later spec.

---

## 1. Overview

Add three Stage-B topics to the Two Eyes bank, all as **single-move (M) puzzles** that reuse the existing app unchanged:

| Topic | Skill | Move to play |
|---|---|---|
| 7 · Connect & cut | keep your groups joined / punish the cutting stone | the connecting point, or capture the cutter |
| 10 · Net (geta) | trap a stone that can't be laddered | the loose-net point |
| 11 · Snapback | sacrifice one to capture back more | the throw-in point |

The new build-time capability is a **bounded capture-reader** that proves a tactic works (a net really traps; a snapback really recaptures). The reader is also the foundation B.2's ladders will reuse.

**Scope boundaries (YAGNI):**
- No app changes. These are `mode: "M"` puzzles; the app already handles tap-to-play. Correct move → "Correct!" + a one-line explanation. The visual "trap springs" payoff is deferred to B.2's sequence player (which renders move sequences anyway).
- No new interaction mode, no solution trees. Solutions stay `{kind:"move", points:[…]}`.

---

## 2. The tactical reader (build-time only)

A small minimax over the existing rules engine (`src/engine`), living in the generator layer. It answers one question:

> **`capturedUnderBestPlay(board, target, toMove, depth): boolean`** — with `toMove` to move, will the `target` (an enemy white group, identified by a point) be captured within `depth` plies under optimal play?

- **Attacker = Black** (wants the capture). Candidate moves: the target group's **liberties** (chase — reducing its breathing room). Black succeeds if *any* move leads to a captured result.
- **Defender = White** (the target, wants to escape). Candidate moves: the target group's **liberties** (extend/run), plus any move that **captures an adjacent attacker stone** (regain liberties). White escapes if *any* move avoids capture.
- **Escape threshold:** if, after the defender extends, the target reaches **≥ 3 liberties**, it has run free → not captured (nets/ladders keep a caught group at ≤ 2). Tunable in implementation.
- **Depth bound:** guarantees termination on our small frames; nets resolve in a few plies. Exact depth chosen per topic in the plan.

This is a well-understood go tactical-reading routine; the plan pins the exact move-sets, threshold, and depth. It is **pure and unit-testable** on hand-built ladder/net fixtures (a working net → true; a net with a breaker/escape → false).

---

## 3. The three topics

All generated with the established **construct-and-verify** approach (build a canonical shape in varied positions/orientations → verify the mechanic with the engine/reader → dedupe → curate), 20 distinct puzzles per rung, fail-loud if a rung can't fill.

### Topic 7 — Connect & cut (M, no reader needed)
- **Rung 1 — Connect:** two friendly black groups one move from joining; the solution is the point that **merges them into a single group**. Goal (single engine step): after Black plays P, the stones that were two distinct black groups are one group. No capture.
- **Rung 2 — Capture the cutting stone:** a white stone cutting two black groups is capturable in one move; solution captures it. **Reuses the existing capture goal** (`captured ≥ 1`, unique). Has a `captured` field (animates like topics 2/3).

### Topic 10 — Net / geta (M, reader-verified)
- The white target has 2 liberties; the black **net point** (a loose, knight's-move-style enclosure) is the solution. Verified: `play(P)` is legal and captures nothing immediately, and `capturedUnderBestPlay(afterP, target, White-to-move, depth)` is **true** (White can't escape any direction). Reject positions where a plain ladder or a direct atari would also work, so the taught technique is genuinely the net.
- Rungs: r1 lone stone in open space; r2 near an edge / against a would-be ladder-breaker.

### Topic 11 — Snapback (M, sequence-verified)
- Construct the canonical snapback shape (a black shape with a capturable cutting/eye point). The **throw-in point** is the solution. Verified by replaying the fixed 3-ply mechanic through the engine: Black P (throw-in) → White captures it → the capturing white group is now in atari → Black recaptures **≥ 2** white stones. Introduces *damezumari* (shortage of liberties) in the prompt copy.
- Rungs: r1 the textbook 3-stone snapback; r2 a slightly larger recapture / edge variant.

---

## 4. Puzzle representation & app

- `mode: "M"`, `solution: {kind:"move", points:[P]}`. Prompts explain the (delayed) payoff, e.g. *"Black to play — net the stone so it can't run,"* *"Black to play — set up a snapback."*
- Topic 7 rung 2 (capture) carries `captured`; nets and snapbacks and connects do **not** capture on the played move, so no `captured`/animation — just "Correct!" + prompt. This is the accepted B.1 tradeoff.
- **App: unchanged.** Board taps for M already work; `openRung`, mastery, pips, progression all apply. Topic titles/order extend the existing map (topics 7–11 appear after 1–6; still gated by linear unlock).
- Bank grows from 240 → **360** puzzles (3 topics × 2 rungs × 20 = 120 new; note topics 8/9 arrive with B.2, so Stage B isn't contiguous until then — the map shows what exists).

---

## 5. Testing

- **Reader unit tests:** hand-built fixtures — a working net returns true; the same net with an escape route / ladder-breaker returns false; a simple 1-liberty capture returns true; a safe group returns false. This is the highest-risk new logic.
- **Generator invariants (per topic):** every generated puzzle re-verified — connect merges groups; capture-cutter captures uniquely; net passes the reader; snapback's 3-ply sequence captures ≥ 2. Determinism + 20-distinct per rung.
- **Bank solvability suite:** extend `src/bank/bank.test.ts` with per-topic blocks for 7/10/11 that replay each committed puzzle through the engine/reader (the existing capture block stays scoped to topics 2–3).
- **Curation/CLI:** topics 7/10/11 wired into `buildBank` with the difficulty-interleave curation; bank regenerated deterministically and committed.

---

## 6. Deferred to B.2 (out of scope here)

The **sequence engine**: solution *trees*, the interactive "you play → engine responds → repeat (with refutation)" app mode, and the **Ladder (8)** + **Ladder-breaker (9)** generators (which will reuse this spec's capture-reader to verify a ladder works). The net/snapback *follow-up animation* also lands with that sequence player.
