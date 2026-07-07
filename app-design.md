# App / Puzzle-Player — Design Spec

The client side of the MVP. It consumes the **pre-baked validated bank** (from `generator-stage-a.md`), serves puzzles, takes input in two interaction modes, and tracks progression. Because all validation happened at build time, the app ships **no go rules engine** — it renders a stored position and compares input to the stored answer. Working draft.

---

## 1. Architecture — thin static client, MVVM

```
on demand, offline (generator CLI)        committed          app build        runtime
  rules engine + validation  ──emits──▶   bank.json  ──bundles──▶  static site ──▶ puzzle player
     (run only when asked)               (in the repo)          (no regen)      (render + check)
```

**The bank is committed data, not build output.** `bank.json` is generated once by the CLI, reviewed, and checked into the repo. Every app build just bundles the committed file — **builds never regenerate puzzles**. Regeneration is an explicit, deliberate act (adding a topic/rung, tuning shapes, growing the bank), run via the CLI. The generator uses a **seeded RNG** so a rerun is reproducible and produces a reviewable diff rather than a churn of unrelated puzzles.

### 1.0 MVVM layering (no external state library)
Strict Model / ViewModel / View split. **No Redux/Zustand/MobX** — only React built-ins.

- **Model** (pure TS, framework-free, unit-testable on its own):
  - `PuzzleBank` — loads/holds `bank.json`, queries puzzles by topic/rung.
  - `AnswerChecker` — pure functions: `(puzzle, input) → correct?`. Compares input to the stored `solution` (Unique / Any-valid for M; count/binary/choice for Q). **No go engine** — validation was baked in.
  - `ProgressStore` — completed rungs/topics, current position, per-rung correct-count; persisted to `localStorage` behind a small port.
- **ViewModel** (plain classes extending a tiny `Observable`; hold view state + commands; depend on Model, never on React):
  - `PuzzlePlayerViewModel` — current puzzle, input/selection, feedback state (`idle|correct|wrong|revealed`), miss counter, mastery counter; commands `submitMove(pt)`, `submitVerdict(v)`, `retry()`, `reveal()`, `next()`.
  - `TopicMapViewModel` — topics with unlock/progress status; command `openTopic()`.
- **View** (React function components, dumb): render from a VM snapshot, call VM commands. `BoardView` is pure SVG from `{frame, stones, marks}`.

### 1.1 View ↔ ViewModel binding (the only "glue")
- `Observable` base (~15 lines): `subscribe(listener)`, `notify()`; VMs call `notify()` after each state change and expose an immutable `snapshot`.
- `useViewModel(vm)` hook = `useSyncExternalStore(vm.subscribe, () => vm.snapshot)` (React 18 built-in; correct, tear-free). This is the entire binding layer — no library.

### 1.2 Data
- **Bank format:** static JSON shipped with the app; no server. Puzzles grouped `stage → topic → rung`.
- **Per-puzzle record:**
  `{ id, topic, rung, mode: "M"|"Q", frame: {w,h,edges}, stones: [...], toPlay, prompt, solution, distractors? }`
  - `solution` for **M** = one point (Unique) or a set of points (Any-valid).
  - `solution` for **Q** = a value (count), a boolean (safe/self-atari), or a chosen mark id (which group / which move).
- **Offline-first:** loads once, runs offline, hostable as a static site.

---

## 2. Components

### 2.1 Board renderer
- **SVG** board of the puzzle's local frame (5×5–7×7 / corner-edge). SVG chosen for crisp scaling, easy highlights, and generous tap targets.
- Draws grid, **edge/corner as a real board boundary** (thick line) so edge geometry reads correctly, stones (circles), and **marks** (triangles/letters) for "which group / which move" prompts.
- Pure render from `{frame, stones, marks}` — no logic.

### 2.2 Puzzle player
Orchestrates one puzzle: show prompt → render board → capture input → check vs `solution` → feedback → retry/next. Mode-agnostic shell; the input widget swaps by `mode`.

### 2.3 Interaction modes
- **M — tap-to-play.** Tap an empty intersection → place the stone → check against `solution`.
  - **Unique:** correct only if the tapped point is *the* point.
  - **Any-valid:** correct if the point is in the set (topic 4, escape).
  - **On correct capture:** animate the captured stones being removed — the payoff moment (topics 2/3/6). The captured stones are stored in the record (from build-time validation), so no runtime capture logic is needed.
- **Q — verdict / counting.** Input widget by sub-form:
  - *count* → number picker (topic 1 liberties)
  - *binary* → two buttons (safe / self-atari — topic 5)
  - *choice* → tap a marked group or marked move (topic 1 compare, topic 5 recognition)
  - Check tapped value/id against `solution`.

### 2.4 Progression & session
- **Structure:** Stage A → 6 topics → ordered rungs → a bank of puzzles per rung.
- **Flow:** a topic is a short lesson — climb its rungs in order; within a rung, serve puzzles until a **mastery criterion** is met, then advance.
- **Unlock model:** linear-with-preview (finish a topic to open the next) — friendly for beginners. *(Open — §5.)*
- **Persistence:** progress in `localStorage` (completed topics/rungs, current position, per-rung stats). No accounts in the MVP.

### 2.5 Teaching text
- Each topic opens with a **one-screen concept intro** (what a liberty is, what atari means, …), kept minimal.
- Source: written fresh in plain beginner language; Smith Ch IV / standard fundamentals as reference, not copied verbatim.
- Optional lightweight per-puzzle **hint** (e.g. highlight the relevant group).

### 2.6 Feedback / pedagogy
- Immediate right/wrong.
- **Correct:** capture animation where relevant; advance.
- **Wrong (M):** gentle "try again" by default; reveal the answer after a couple of misses. *(Open — §5.)*
- **Any-valid (escape):** accept the tap; optionally reveal the *other* valid escapes as teaching.

---

## 3. Tech stack (decided)

- **Platform:** ✅ **Web app, installable PWA.** Static bundle + `bank.json`, no server calls. Max reach, no app-store friction, free to host.
- **Offline (hard requirement — "works on a plane"):** ✅ met by the PWA. A **service worker precaches the app shell + `bank.json`**, so once loaded/installed the app runs fully offline on laptop *and* phone (airplane mode). No native app needed for offline. **Acceptance test: enable airplane mode, cold-launch, complete a puzzle.**
- **Framework:** ✅ **React + Vite**, with `vite-plugin-pwa` for the service worker. (Board is simple SVG regardless; chosen for the smoothest, best-documented offline-PWA path.)
- **State/architecture:** ✅ **MVVM, no external state library** (§1.0/1.1). Plain-class ViewModels + a ~15-line `Observable` bound via React's built-in `useSyncExternalStore`. Keeps VMs framework-free and unit-testable; no Redux/Zustand/MobX.
- **Rendering:** SVG.
- **Storage:** `localStorage` (progress).
- **Generator tool:** a standalone **on-demand CLI** (Node — shares the JS/TS toolchain), run only when deliberately (re)generating content; emits the committed `bank.json`. Carries the rules engine + tests from `generator-stage-a.md` §1. **Not part of the app build.**

---

## 4. MVP screen inventory (minimal)

1. **Home / map** — Stage A with its 6 topics; progress indicators; tap a topic to enter.
2. **Concept intro** — one screen per topic.
3. **Puzzle player** — board + prompt + mode input + feedback; "next" / "retry".
4. **Topic complete** — small reward + unlock next.

That's the whole MVP surface. No settings, accounts, or profiles.

---

## 5. Open questions

1. ✅ **Platform & framework — decided** (§3): installable PWA (offline via service worker), React + Vite.
2. ✅ **Unlock model — linear-with-preview** (finish a topic to open the next; upcoming topics visible but locked).
3. ✅ **Mastery criterion — 4 correct to clear a rung**; a wrong answer re-serves (no progress reset).
4. ✅ **Wrong-answer behavior — retry, reveal after 2 misses.**
5. ✅ **Concept-intro — puzzles-first**, minimal stubbed intro text now, full copy later.
