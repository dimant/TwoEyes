# Stage A Generator — Design Spec

How the MVP produces its puzzles. Stage A is entirely 🔧-generated: capturing basics, 6 topics, two interaction modes (M = tap-to-play a move, Q = verdict/counting). Working draft.

---

## 1. Shared infrastructure

Everything in Stage A rests on three shared pieces. These are built once and reused by every topic.

### 1.1 Minimal rules core
A tiny go engine — the *only* logic the MVP truly needs:
- **Group / liberty flood-fill** — given a point, find its connected same-color group and count its liberties (empty orthogonal neighbours, board-edge-aware).
- **Capture resolution** — after a move, remove any enemy group with 0 liberties.
- **Legality check** — a move is illegal if the point is occupied, or if it's suicide (0 liberties after placement *and* it captures nothing). Suicide handling is a config flag (ruleset-dependent — see topic 5).

Board is a small grid (see §1.4). No ko, no scoring, no whole-board logic in the MVP.

### 1.2 Generate-then-validate
The generator is a **standalone on-demand CLI**, not part of the app build. It is run deliberately (new topic/rung, tuning, growing the bank), uses a **seeded RNG** for reproducibility, and writes a **committed `bank.json`** that the app later bundles unchanged. Builds never regenerate.

Every puzzle is **auto-validated before it enters the bank**. The generator proposes a position + intended solution; the validator replays it through the rules core and confirms:
1. The intended solution actually achieves the goal (captures / escapes / counts correctly).
2. The **solution-uniqueness policy** for that topic holds (see §1.3).
3. The intended solution move is legal.

A proposal that fails validation is discarded and regenerated. This guarantees no broken or ambiguous puzzle ever ships — the core reason generation beats scraping.

### 1.3 Solution-uniqueness policy (per topic)
For M (move) topics we must decide what counts as "correct." Two policies:
- **Unique** — exactly one move satisfies the goal; validator rejects positions where 2+ do. Cleanest feedback ("that's the move"). Used where geometry allows.
- **Any-valid** — several moves satisfy the goal; grade *any* of them right. Needed where forcing uniqueness would distort the shape (notably Escape, topic 4).

Each topic below declares its policy.

### 1.4 Board & difficulty model
- **Board size:** **decided — local frames.** Each puzzle is posed on a small **5×5–7×7 region / corner-edge frame** so the relevant shape fills the view, rendered on a consistent small board. (Frames still carry true edge/corner geometry where a topic needs it.)
- **Difficulty rungs:** each topic is an ordered ladder of "rungs" (sub-levels). A learner climbs rungs within a topic; rungs also feed the global progression. Rungs are defined per topic below.
- **Output shape (per puzzle):** `{ topic, rung, board, toPlay, mode, prompt, solution, distractors? }`. Rendering is the app's job (later spec).

---

## 2. Topic 1 — Liberties  (Q)

**Skill:** count liberties; see that edge/corner stones have fewer.
**Form:** Q. Two variants — *count* ("how many liberties does the marked group have?" → pick a number) and *compare* ("which marked group has fewer?" → tap a group).
**Uniqueness:** N/A (answer is computed).

**Generation:** place a marked stone or small connected group; optionally add enemy stones in contact and/or push it to an edge/corner to lower the count. Answer = flood-fill liberty count. Compare variant places two groups with **distinct** counts (reject ties).

**Rungs:**
1. Single stone, center (4 liberties) — the concept.
2. Single stone on the **edge** (3) / **corner** (2) — the aha.
3. Single stone with 1–2 enemy stones in contact (reduced count).
4. Connected group of 2–3 (shared liberties — must flood-fill, not just count neighbours).
5. Group near edge *and* in enemy contact — everything combined.
6. *Compare* variant across the above.

**Constraints:** marked group must be visually unambiguous; compare variant forbids ties.

---

## 3. Topic 2 — Atari & capture  (M)

**Skill:** play the move that captures a group currently in atari.
**Form:** M. **Uniqueness:** Unique (exactly one capturing move).

**Generation:** build a position with exactly one enemy group on 1 liberty; the solution is that liberty point. Validator confirms playing it removes the group and that no *other* legal move also captures.

**Rungs:**
1. Lone enemy stone in atari, center.
2. Lone enemy stone in atari on edge/corner.
3. Enemy group (2–3 stones) sharing one last liberty.
4. Board has extra enemy stones **not** in atari (distractors) — find the one capture.
5. The capturing point sits among plausible-looking non-capturing moves; only one actually takes.

**Constraints:** capture move must be legal; exactly one group in atari (guarantees uniqueness). The fill must not be self-atari that *fails* to capture.

---

## 4. Topic 3 — Capturing multiple stones  (M)

**Skill:** the payoff — one move takes a whole group.
**Form:** M. **Uniqueness:** Unique. *(Shares topic 2's generator, constrained to captured-group size ≥ 2.)*

**Rungs:**
1. 2-stone group in atari, center.
2. 3-stone group in atari.
3. On edge/corner.
4. Larger group (4–5 stones) — bigger, clearer reward.
5. Distractor: a 1-stone atari elsewhere is a *lesser* capture; only the multi-stone group is set to be the served puzzle. *(To preserve Unique policy, keep just one group in atari; the "take the bigger one" framing is a later enrichment, not MVP.)*

---

## 5. Topic 4 — Escaping atari  (M)

**Skill:** your group is in atari; extend to get out.
**Form:** M. **Uniqueness:** **Any-valid** — a move is correct if, after it, your group is no longer in atari (liberties ≥ 2) and it isn't self-atari. (Forcing a single escape would distort natural shapes.)

**Generation:** your marked group has exactly 1 liberty; at least one extension raises it to ≥ 2. Validator confirms ≥ 1 valid escape exists and records the full set of correct moves.

**Rungs:**
1. Open center — one clear direction to run (to 3 liberties).
2. Along an edge.
3. A trap direction: one extension stays in atari (wrong), another reaches ≥ 2 (right) — teaches choosing direction, still one move.
4. Extension vs capturing a contact stone to gain liberties — both may be valid (any-valid shines here).

**Boundary with ladders (topic 8):** Stage A escapes are judged **one move deep only** — "are you out of atari now?" We do *not* read whether the escape survives a chase; that's topic 8 (S-mode). Keep generated positions where a one-move escape is genuinely safe enough for a beginner (no immediate recapture that matters).

---

## 6. Topic 5 — Don't self-atari  (M / Q)

**Skill:** recognize/avoid filling your own last liberty; suicide is illegal (soft, ruleset-dependent text).
**Forms:**
- **Q (recognition):** mark a candidate move → "safe, or self-atari?" (binary); or "which of these moves self-ataris?" (tap the bad one).
- **M (avoidance):** "keep your group safe" — the right move connects/defends; a tempting distractor is self-atari.
**Uniqueness:** Q is computed; M uses Unique (one safe/defending move) where possible.

**Rungs:**
1. Q: filling a point that leaves your own stone on 1 liberty — recognize it.
2. Q: true **suicide** — playing into a fully surrounded point that captures nothing (illegal). Soft rules text here.
3. M: **connect** two stones to escape atari; the distractor self-ataris.
4. Q: filling your *own* eye/liberty — a light foreshadow of false eyes (topic 12).

**Ruleset note:** keep copy soft — *"in the rules we use, filling your own last liberty isn't allowed / loses the stones."* Single-stone suicide is illegal under all common rulesets; the config flag (§1.1) covers the multi-stone edge case, which the MVP otherwise avoids.

---

## 7. Topic 6 — Double atari  (M)

**Skill:** one move, two ataris — opponent saves only one.
**Form:** M. **Uniqueness:** Unique (one point creates the double).

**Generation:** find a point where placing your stone drops **two distinct** enemy groups each to exactly 1 liberty. Canonical seed: two enemy stones a knight's/diagonal apart sharing one attacking point. Validator: after the move, ≥ 2 distinct enemy groups are newly in atari, the move is legal, and no other point does this.

**Rungs:**
1. Canonical: two lone enemy stones set so one move ataris both.
2. On edge/corner.
3. One target is a 2-stone group.
4. Distractors: several moves atari *one* group; only one ataris both — find the double.

**Constraints:** exactly one double-atari point (uniqueness); the move itself must be legal and not self-atari.

---

## 8. Decisions & open questions

**Decided:**
1. ✅ **Board size — local frames** (5×5–7×7 / corner-edge), rendered on a consistent small board.
2. ✅ **Pre-baked validated bank, committed.** The generator is a **standalone on-demand CLI** (seeded, reproducible) that emits N validated puzzles per rung into a **committed `bank.json`**. The app build bundles it unchanged — **no regeneration per build**, no rules engine in the client. (The rules core of §1 lives in the CLI + tests, not the app.)

**Decided (defaults — veto to change):**
3. ✅ **Puzzles per rung — 20** validated puzzles baked per rung.
4. ✅ **Escape any-valid UX** — accept the tapped move, then reveal the *other* valid escapes as a teaching moment.
5. ✅ **Topic 5 split** — primarily Q (recognition) plus the single M "connect to save" form; both, kept light.
