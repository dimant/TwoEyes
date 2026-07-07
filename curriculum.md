# Go for Complete Beginners — Puzzle Curriculum

A topic-by-topic curriculum for a public-domain, beginner-focused go puzzle app.
Working draft — we are iterating on this.

## Legend

**Source tags**
- 🔧 — generated (Tier 0): produced by a problem generator, public-domain by construction, solution guaranteed correct.
- 📖 — from Smith 1908 (Tier 1): parsed from *The Game of Go: The National Game of Japan* (Arthur Smith, 1908, public domain).
- 📖\* — Smith tag **unverified**: his appendix is small and difficulty-graded, not topic-tagged, so coverage may be thin or zero. Treat 🔧 as primary for all starred topics until the Smith audit says otherwise.

**Interaction-mode tags** (a UI requirement — decide before building the puzzle player)
- **M** — *Make a move*: tap-to-play, single correct move. Ships on the one-mover engine alone.
- **S** — *Sequence*: engine responds and you continue, with refutation handling. First needed at topic 8.
- **Q** — *Verdict / counting / multiple-choice*: status judgement or a count, not tap-to-play. Requires a second interaction mode.

---

## Stage A — Capturing basics
*Goal: understand liberties and how stones are taken. All one-movers or questions.*

1. **Liberties** — count liberties of a stone/group; which group has fewer. Include edge and corner cases explicitly ("stones on the side have fewer liberties" is the aha that sets up ladders and first-line kills later). 🔧 — Q
2. **Atari & capture** — play the move that captures a stone in atari. 🔧 — M
3. **Capturing multiple stones** — capture a group in atari (2–3 stones). 🔧 — M
4. **Escaping atari** — extend to add liberties and run. 🔧 — M
5. **Don't self-atari** — recognize/avoid filling your own last liberty. Teach suicide as illegal, but keep the rules text soft ("in the rules we use…") since it's ruleset-dependent. 🔧 — M/Q
6. **Double atari** — one move, two ataris; opponent can only save one. The workhorse beginner tactic. 🔧 — M

## Stage B — Capturing techniques
*Goal: the standard tactical shapes for catching stones. This is where sequence puzzles (S) first appear — the engine-response infrastructure gates this stage.*

7. **Connect & cut** — connect your stones / cut the opponent / capture the cutting stone. Placed first because cutting stones are what the rest of Stage B chases. 🔧📖 (16 problems) — M
8. **The ladder (shichō)** — capture by driving to the edge; read whether it works. Must be playable to the end against a responding engine. 🔧 — S
9. **Ladder breakers** — recognize when a ladder fails; punish a broken ladder. 🔧 (Smith: 0) — S/Q
10. **The net (geta)** — capture a stone that can't be laddered. 🔧 (Smith: 0) — M (verify by playout: S)
11. **Snapback** — sacrifice one to capture back. Introduce shortage of liberties (*damezumari*) here as the named underlying idea; it recurs in 12 and 18. 🔧📖 (related: Oi Otoshi ×12) — M/S

## Stage C — Life and death fundamentals
*Goal: the central idea of the whole game — living groups.*

12. **Eyes** — real eye vs. false eye (false eyes fail via *damezumari* — callback to 11). 🔧 — Q/M
13. **Two eyes = life** — play the move that makes the second eye. 🔧📖 — M
14. **Killing: prevent two eyes** — play the vital point. 🔧📖 — M
15. **Eye-space & the vital point** — reduce a big eye space to one eye; find the killing point. 📖🔧 — M/S
16. **Standard dead/alive shapes** — three-in-a-row, square-four, "L", bulky five, rabbity six: status + vital point. Scope: unconditional shapes only. Bent-four-in-the-corner is deferred to topic 21 (ko), since its status is a rules/ko question, not a shape question. 📖🔧 — Q/M

## Stage D — Fights and edge cases

17. **Capturing races (semeai)** — count liberties, win the race; simple approach moves. *Damezumari* callback. 📖🔧 — M/S/Q
18. **One eye vs. no eye (me ari me nashi)** — the eye wins the race. 🔧📖 (embedded in Semeai) — M/Q
19. **Seki** — mutual life; recognize it, and identify which move would be a mistake. Framed as status / "which move loses" rather than "play a move," since the correct play is often tenuki. 🔧 (Smith: 0 problems) — Q
20. **Edge/corner throw-in & placement** — first-line techniques to kill or live. 📖🔧 — M/S
21. **Ko basics** — what a ko is, the retake rule, simple ko for life/death. Includes bent-four-in-the-corner as a capstone example. 🔧📖 — S/Q

---

## Smith 1908 audit (results)

Smith's appendix has **~99 problems** (not ~22 — the earlier estimate saw only the first theme), each a position given as stone coordinates with a coordinate solution sequence. They are grouped into 7 named themes:

| Smith theme | Count |
|---|---|
| I. Saving Threatened Groups | 24 |
| II. Killing Groups | 19 |
| III. Playing for "Ko" | 16 |
| IV. Reciprocal Attacks ("Semeai") | 12 |
| V. Connecting Groups | 12 |
| VI. "Oi Otoshi" (connect-and-die / *damezumari*) | 12 |
| VII. Cutting | 4 |

**Coverage mapped onto our topics (stars resolved):**

| Topic | Smith source | Verdict |
|---|---|---|
| 7 Connect & cut | Connecting (12) + Cutting (4) = **16** | ✅ **star removed** — strong |
| 8 Ladder | — | 🔧 only (never was starred) |
| 9 Ladder breakers | **0** | 🔧 only — **star → zero** |
| 10 Net (geta) | **0** | 🔧 only — **star → zero** |
| 11 Snapback | Oi Otoshi (12), *related* damezumari, not identical | 🔧 primary + 📖 related |
| 12 Eyes (real/false) | 0 | 🔧 only |
| 13 Two eyes = life | subset of Saving (24) | 📖 supports |
| 14 Killing | Killing Groups (**19**) | ✅ strong |
| 15 Eye-space & vital point | subset of Killing / Saving | 📖 supports |
| 16 Standard shapes | embedded, not tagged | 🔧 primary |
| 17 Semeai | Reciprocal Attacks (**12**) | ✅ strong |
| 18 One eye vs no eye | embedded in Semeai, not separate | 🔧 primary — **star → embedded** |
| 19 Seki | **0** problems (text discussion only) | 🔧 only — **star → zero** |
| 20 Throw-in / placement | embedded in Killing / Oi Otoshi | 📖 supports |
| 21 Ko | Playing for Ko (**16**) | ✅ strong (but hard — see caveat) |

**Two load-bearing caveats:**

1. **Difficulty skews intermediate.** Smith's problems are corner/side life-and-death at roughly intermediate-amateur level — most are *not* beginner one-movers (solution sequences frequently run 5–15+ moves). Even where a topic is well-covered, those problems belong at the **hard end / upper tier** of that topic. **Every topic's introductory rungs must be 🔧-generated.** Smith is enrichment and a difficulty ceiling, never the on-ramp.
2. **The zero rows are real.** Ladder breakers (9), nets (10), eyes (12), and seki (19) have **no dedicated Smith problems**. 🔧 carries these outright. Snapback (11) and me-ari-me-nashi (18) are only *adjacent* in Smith (oi-otoshi; embedded semeai), so treat 🔧 as primary there too.

## Notation notes

- **Stars resolved** by the Smith audit (see the audit section above). Outcome: connect-cut is well-covered (16); ladder-breakers, nets, and seki have **zero** Smith problems; snapback and me-ari-me-nashi are only adjacent. 🔧 carries all of Stage B's on-ramp regardless, and Smith's problems sit at the hard end of each topic they touch.
- **Q (or partly-Q) topics (1, 5, 12, 16, 17, 19)** require the second interaction mode — status verdict / counting / multiple choice — not just tap-to-play. That's a UI requirement, worth knowing before you build the puzzle player. Note topic 1 (count liberties) is Q, so even a Stage-A-only MVP touches the Q mode unless topic 1 is held back.
- **S topics** require the engine-responds-and-you-continue puzzle format with refutation handling. First needed at topic 8, so Stage A can ship on the one-mover engine alone — a natural MVP cut line.

## Next steps (in order)

1. ~~**Smith audit** — classify his problems by topic, get real counts, resolve the stars.~~ ✅ **Done** — see the audit section above (99 problems, 7 themes).
2. ~~**MVP cut decision**~~ ✅ **Decided: "Stage A + minimal Q-mode."** All 6 Stage A topics, 🔧-generated, supporting tap-to-play (M) plus a simple counting/verdict UI (Q). No sequence (S) engine, no Smith parsing in the MVP — both deferred to later phases.

## MVP scope (decided)

**Stage A, all 6 topics, 🔧-generated, two interaction modes:**
- **M (tap-to-play):** topics 2, 3, 4, 6 — and the play-a-move half of 5.
- **Q (verdict/counting):** topic 1 (count liberties / which group has fewer) and the recognition half of 5 (is this self-atari?).
- **Out of scope for MVP:** sequence (S) engine with refutation handling (Stage B+), and all Smith 1908 parsing (enrichment, later phase).
