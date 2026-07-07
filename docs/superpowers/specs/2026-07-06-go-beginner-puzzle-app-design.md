# Go for Complete Beginners — Puzzle App Design Spec

**Date:** 2026-07-06
**Status:** design complete for MVP; ready for implementation planning.
**Working docs consolidated here:** `curriculum.md`, `generator-stage-a.md`, `app-design.md`.

---

## 1. Overview

A puzzle app that teaches the fundamentals of go (baduk/weiqi) to complete beginners, built entirely on **public-domain content**. Learners solve small, focused puzzles that build capturing and life-and-death skills, with immediate feedback.

**Guiding constraints**
- **Public-domain only.** No copyrighted problem sets (rules out goproblems.com scrapes, Cho Chikun, Lee Chang-ho, and the modern Korschelt translation).
- **Complete beginners.** Content starts at "just learned the rules" and climbs gently.
- **Works offline** (e.g. on a plane) — a hard requirement.
- **Validates solving attempts** — the learner plays/answers and the app checks correctness.

**Why generation, not a problem collection:** the intersection of *public-domain*, *beginner-graded*, and *has-solutions* is essentially empty among existing collections. The classical public-domain collections (Xuanxuan Qijing, Gokyo Shumyo, Igo Hatsuyoron) are expert-level; all beginner-graded material is modern and copyrighted. The fundamentals, however, are simple and universal — so we **generate** beginner puzzles (public-domain by construction, solutions guaranteed correct) and treat one genuinely public-domain book as later enrichment.

---

## 2. Data & licensing strategy

- **Tier 0 — generated (🔧):** the primary source. A generator produces beginner puzzles with verified solutions. Public-domain by construction.
- **Tier 1 — Smith 1908 (📖):** *The Game of Go: The National Game of Japan*, Arthur Smith, 1908 — solidly public domain. Audited: **~99 problems in 7 themes** (Saving 24, Killing 19, Ko 16, Semeai 12, Connecting 12, Oi-Otoshi 12, Cutting 4), each a coordinate position with a coordinate solution. **Deferred past the MVP** — Smith's problems skew intermediate (5–15+ move solutions) and suit a later "harder problems" tier, never the on-ramp. Several MVP-relevant topics (nets, ladder-breakers, eyes, seki) have **zero** Smith problems, so 🔧 owns them regardless.

---

## 3. Curriculum (21 topics)

Full skill progression. Tags: 🔧 generated · 📖 Smith · interaction mode **M** (tap-to-play move) / **S** (sequence, engine responds) / **Q** (verdict/counting/choice).

### Stage A — Capturing basics (MVP)
*Understand liberties and how stones are taken. All one-movers or questions.*
1. **Liberties** — count liberties; which group has fewer. Edge/corner cases explicit ("stones on the side have fewer liberties" — sets up ladders and first-line kills). 🔧 — Q
2. **Atari & capture** — play the capturing move. 🔧 — M
3. **Capturing multiple stones** — capture a 2–3 stone group in atari. 🔧 — M
4. **Escaping atari** — extend to add liberties and run. 🔧 — M
5. **Don't self-atari** — avoid filling your own last liberty; suicide illegal (soft, ruleset-dependent copy). 🔧 — M/Q
6. **Double atari** — one move, two ataris; opponent saves only one. 🔧 — M

### Stage B — Capturing techniques
*Standard tactical shapes. Sequence puzzles (S) first appear here — the engine-response infrastructure gates this stage.*
7. **Connect & cut** — connect / cut / capture the cutting stone. First because cutting stones are what the rest of Stage B chases. 🔧📖 (16) — M
8. **The ladder (shichō)** — drive to the edge; playable to the end vs a responding engine. 🔧 — S
9. **Ladder breakers** — recognise a failing ladder; punish a broken one. 🔧 (Smith 0) — S/Q
10. **The net (geta)** — capture a stone that can't be laddered. 🔧 (Smith 0) — M (verify by playout: S)
11. **Snapback** — sacrifice one to capture back. Introduces *damezumari* (shortage of liberties); recurs in 12 and 18. 🔧📖 (related: Oi-Otoshi ×12) — M/S

### Stage C — Life and death fundamentals
*The central idea — living groups.*
12. **Eyes** — real vs false eye (false eyes fail via *damezumari*). 🔧 — Q/M
13. **Two eyes = life** — make the second eye. 🔧📖 — M
14. **Killing: prevent two eyes** — play the vital point. 🔧📖 (19) — M
15. **Eye-space & the vital point** — reduce a big eye space to one eye. 📖🔧 — M/S
16. **Standard dead/alive shapes** — three-in-a-row, square-four, "L", bulky-five, rabbity-six: status + vital point. Unconditional shapes only; bent-four-in-the-corner deferred to 21 (ko). 📖🔧 — Q/M

### Stage D — Fights and edge cases
17. **Capturing races (semeai)** — count liberties, win the race; simple approach moves. 📖🔧 (12) — M/S/Q
18. **One eye vs no eye (me ari me nashi)** — the eye wins. 🔧📖 (embedded in Semeai) — M/Q
19. **Seki** — mutual life; recognise it / which move is a mistake (correct play is often tenuki). 🔧 (Smith 0) — Q
20. **Edge/corner throw-in & placement** — first-line techniques. 📖🔧 — M/S
21. **Ko basics** — the retake rule, simple ko for life/death; bent-four-in-the-corner as capstone. 🔧📖 (16) — S/Q

---

## 4. MVP scope

**Stage A, all 6 topics, 🔧-generated, two interaction modes.**
- **M (tap-to-play):** topics 2, 3, 4, 6, and the play-a-move half of 5.
- **Q (verdict/counting):** topic 1 (count liberties / which group fewer) and the recognition half of 5 (is this self-atari?).
- **Out of scope for MVP:** the sequence (S) engine with refutation handling (Stage B+), and all Smith 1908 parsing (later enrichment).

---

## 5. Generator (Stage A)

### 5.1 Shared infrastructure
- **Minimal rules core** (build-time only): group/liberty flood-fill; capture resolution; legality check (occupied / suicide, where suicide is a ruleset config flag). No ko, scoring, or whole-board logic.
- **Generate-then-validate:** the generator is a **standalone, on-demand, seeded CLI** (not part of the app build). It proposes a position + intended solution; the validator replays it through the rules core and confirms (1) the solution achieves the goal, (2) the topic's uniqueness policy holds, (3) the solution is legal. Failing proposals are discarded and regenerated. Output is a **committed `bank.json`**; the app bundles it unchanged.
- **Solution-uniqueness policy (per topic):** **Unique** (exactly one move works — cleanest feedback) or **Any-valid** (grade any goal-achieving move — needed where forcing uniqueness would distort the shape). Escape (topic 4) is Any-valid; all other M topics are Unique.
- **Board:** **local frames** (5×5–7×7 / corner-edge) rendered on a consistent small board; frames carry true edge/corner geometry where a topic needs it.
- **Difficulty rungs:** each topic is an ordered ladder of rungs; a learner climbs rungs within a topic. **20 validated puzzles baked per rung.**
- **Per-puzzle record:** `{ id, topic, rung, mode:"M"|"Q", frame:{w,h,edges}, stones:[...], toPlay, prompt, solution, capturedOnSolve?, distractors? }`.

### 5.2 Per-topic recipes
- **1 Liberties (Q):** *count* and *compare* variants; place a marked stone/group, optionally in enemy contact / at edge. Answer = flood-fill count. Rungs: center(4) → edge(3)/corner(2) → enemy-contact → 2–3 group → combined → compare. Compare forbids ties.
- **2 Atari & capture (M, Unique):** exactly one enemy group on 1 liberty; solution = that point. Rungs: lone center → edge/corner → 2–3 group → distractor stones not in atari → capture point among plausible non-captures.
- **3 Capture multiple (M, Unique):** topic-2 generator constrained to captured size ≥ 2. Rungs: 2 → 3 → edge/corner → 4–5 stones.
- **4 Escaping atari (M, Any-valid):** your group on 1 liberty; ≥1 extension reaches ≥2 liberties and isn't self-atari; validator records the full valid set. **Judged one move deep only** ("are you out of atari now?") — reading a chase is topic 8. Rungs: open center → along edge → trap-direction → extend-vs-capture.
- **5 Don't self-atari (M/Q):** Q recognition ("safe or self-atari?"; "which move self-ataris?") + M avoidance ("connect to stay safe", distractor self-ataris). Rungs: recognise self-atari → true suicide (soft rules copy) → connect-to-save → fill-own-eye foreshadow. Suicide handling via config flag; MVP avoids the multi-stone-suicide edge case.
- **6 Double atari (M, Unique):** one point drops two distinct enemy groups to 1 liberty each. Validator: ≥2 groups newly in atari, legal, no other point does it. Rungs: canonical two lone stones → edge/corner → one target is a 2-stone group → distractors that atari only one.

---

## 6. App / puzzle-player

### 6.1 Architecture — thin static client, MVVM
```
on demand, offline (generator CLI)        committed          app build        runtime
  rules engine + validation  ──emits──▶   bank.json  ──bundles──▶  static site ──▶ puzzle player
     (run only when asked)               (in the repo)          (no regen)      (render + check)
```
The bank is **committed data, not build output** — generated once, reviewed, checked in; every build bundles it unchanged. Regeneration is a deliberate, seeded, reproducible act. The app ships **no go rules engine** — it renders a stored position and compares input to the stored answer.

**MVVM layering — no external state library (React built-ins only):**
- **Model** (pure TS, framework-free, unit-testable): `PuzzleBank` (load/query), `AnswerChecker` (`(puzzle,input)→correct?` against stored `solution`), `ProgressStore` (completed rungs/topics, position, per-rung counts; `localStorage` behind a port).
- **ViewModel** (plain classes extending a ~15-line `Observable`; hold view state + commands; never import React): `PuzzlePlayerViewModel` (current puzzle, input/selection, feedback `idle|correct|wrong|revealed`, miss + mastery counters; `submitMove`, `submitVerdict`, `retry`, `reveal`, `next`), `TopicMapViewModel` (topics + unlock/progress; `openTopic`).
- **View** (dumb React function components): render a VM snapshot, call VM commands. `BoardView` = pure SVG from `{frame, stones, marks}`.
- **Binding:** `useViewModel(vm) = useSyncExternalStore(vm.subscribe, () => vm.snapshot)`. This is the entire glue — no Redux/Zustand/MobX.

### 6.2 Interaction modes
- **M — tap-to-play:** tap empty intersection → place → check vs `solution` (Unique: the point; Any-valid: in the set). On a capturing solve, animate removal of the stored `capturedOnSolve` stones (the payoff). Any-valid (escape) reveals the other valid escapes afterward.
- **Q — verdict/counting:** widget by sub-form — number picker (count), two buttons (safe/self-atari), or tap-a-marked-group / tap-a-marked-move (choice). Check value/id vs `solution`.

### 6.3 Progression & UX
- **Structure:** Stage A → 6 topics → ordered rungs → 20 puzzles/rung.
- **Unlock:** linear-with-preview (finish a topic to open the next; upcoming visible but locked).
- **Mastery:** 4 correct clears a rung; a wrong answer re-serves (no reset).
- **Wrong answer:** retry, reveal after 2 misses.
- **Teaching text:** one-screen concept intro per topic — **puzzles-first**, minimal stubbed copy now, full text later. Written fresh in plain language (Smith Ch IV as reference, not copied).

### 6.4 Screens (whole MVP surface)
1. Home/map — Stage A, 6 topics, progress; tap to enter.
2. Concept intro — one screen per topic.
3. Puzzle player — board + prompt + mode input + feedback + next/retry.
4. Topic complete — small reward, unlock next.
No settings, accounts, or profiles.

### 6.5 Visual direction (approved)
Sketched and approved as an interactive mockup (`ui-mockup.html`; artifact `89bda53f-2b94-4d1c-91f4-d41e8abe5c5c`).
- **Grounding:** the goban — warm **board tan** `#E9D4A6`, **slate/shell** stones, warm-paper / deep-ink grounds. Deliberately *not* the cream-serif-terracotta default.
- **Accent:** deep **teal** `#166B74` (light) / `#4FB6BE` (dark) — distinct from wood and from semantics.
- **Semantics kept separate from accent:** correct = **green** `#2E9B6B`, retry = **amber** `#D46A3D` (never harsh red).
- **Type:** warm system **serif** (Iowan/Palatino stack) for screen titles + status words; **system-ui** sans for controls/body; tabular-nums for counts.
- **Layout:** phone-first; **Solve** = prompt → board → input → feedback-slides-up. Map = vertical path of the 6 topics with done/current/locked states. Theme-aware (light+dark).
- **Interaction confirmed:** tap-to-play with capture animation; 2-miss reveal (glowing target ring); Q-mode number/verdict widgets swap in below the board.

### 6.6 Stack
- **Platform:** web app, **installable PWA**. Offline via a **service worker** precaching the app shell + `bank.json` → runs fully offline on laptop and phone. **Acceptance test: airplane mode, cold launch, complete a puzzle.**
- **Framework:** **React + Vite** + `vite-plugin-pwa`.
- **Rendering:** SVG. **Storage:** `localStorage`. **Generator CLI:** Node, shares the TS toolchain; not part of the app build.

---

## 7. Testing

- **Rules core:** unit tests for flood-fill/liberties, capture, legality/suicide (the highest-risk logic).
- **Generator/validator:** every baked puzzle passes validation by construction; add tests asserting per-topic invariants (uniqueness policy honored, solution legal, captured set correct) over the generated bank.
- **ViewModels:** unit-tested without React (plain classes) — answer-checking, feedback transitions, mastery/unlock logic.
- **Offline:** the airplane-mode acceptance test above.

---

## 8. Deferred (post-MVP)

- **Sequence (S) engine** with refutation handling → unlocks Stage B (ladders, nets by playout) onward.
- **Smith 1908 parser** → a "harder problems" enrichment tier layered onto topics 7, 11, 13–18, 21.
- Stages B–D content generation.
- Copy pass on all concept-intro text.

---

## 9. Resolved decisions (log)

| Decision | Choice |
|---|---|
| Content licensing | Public-domain only; generate Tier 0, defer Smith Tier 1 |
| App goal | Validate solving attempts |
| MVP scope | Stage A (6 topics), modes M + minimal Q |
| Board | Local 5×5–7×7 frames |
| Delivery | Pre-baked, **committed** `bank.json`; app never regenerates |
| Generator | Standalone, seeded, on-demand CLI; not in build |
| Puzzles/rung | 20 |
| Uniqueness | Unique per topic; Any-valid for escape (4) |
| Platform | Installable PWA, offline via service worker |
| Framework | React + Vite + vite-plugin-pwa |
| State | MVVM, plain-class VMs + `useSyncExternalStore`, no state library |
| Unlock | Linear-with-preview |
| Mastery | 4 correct/rung; wrong re-serves |
| Wrong answer | Retry, reveal after 2 misses |
| Concept text | Puzzles-first, stubbed copy |
