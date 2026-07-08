# Phase 6 — Lessons browser on the map (design)

**Status:** approved, ready for planning
**Date:** 2026-07-08
**Phase:** 6 (Interaction & UX polish), item 2 of 3

## Goal

Let a learner revisit any concept lesson directly from the map, without entering a
topic to practice. Today the concept lessons are reachable only *inside* play mode:
they auto-open on first entry to a topic and are reopenable via the **Learn** button in
`PlayerScreen`. This makes revisiting a concept a multi-tap detour through practice.

This feature is **access only** — no new lesson content and no new lesson rendering. All
11 lessons already exist (`lessonFor(topic)` in `src/app/content/lessons.ts`) and
`LessonScreen` already renders them fully: diagram, animated `payoff` (auto-play +
Replay), caption, and body.

## Decisions (from brainstorming)

1. **Access model:** a per-topic **Learn** link on each existing map card. No separate
   Lessons screen, no top-bar entry.
2. **Locked topics:** the Learn link appears on **every** card, including locked ones. A
   beginner can preview any concept before unlocking it. Lessons teach ideas, not puzzle
   answers, so there are no spoilers; this complements the existing triple-tap
   skip-ahead.
3. **Mark as seen:** viewing a lesson from the map calls `markLessonSeen(topic)`. When
   the learner later first enters that topic to practice, the lesson does **not**
   auto-open (the Learn button inside `PlayerScreen` remains available). Avoids showing
   the same lesson twice.

## Design

### 1. Card restructure — `MapScreen.tsx` + `styles.css`

Today each `.tcard` is a single `<button>` carrying both the tap-to-open (unlocked) and
triple-tap-to-unlock (locked) behaviour. A nested Learn `<button>` inside it would be
invalid HTML (button-in-button) and an accessibility problem.

Split the card into a **container** holding two **sibling** controls:

- **Main control** — the existing button, logic unchanged: `handleTap` opens the topic
  when unlocked, counts taps and unlocks-then-opens when locked. Keeps its current look.
- **Learn control** — a new `<button class="learn">`, rendered on every card regardless
  of lock state. Calls a new `onLearn(topic)` prop. It must **not** trigger open/unlock:
  it is a separate control, not nested in the main button, so its click does not reach
  `handleTap`.

`.tcard`'s layout responsibilities move to the container element; the main button keeps
its existing visual styling. CSS changes are small and confined to `styles.css`.

### 2. Lesson takeover on the map — `App.tsx`

`App`'s nav today is `{ screen: "map" } | { screen: "play"; topic; rung }`.
`LessonScreen` is a **full-screen takeover**, not a floating overlay: `PlayerScreen`
renders it with `if (lesson && showLesson) return <LessonScreen/>`, replacing the whole
screen. The map lesson reuses that exact pattern — while a lesson is showing, it is
rendered **instead of** `MapScreen`; dismissing returns to the map.

- Add state `lessonTopic: number | null` (default `null`).
- `MapScreen` gains one prop: `onLearn: (topic: number) => void`, wired to
  `setLessonTopic(topic)`.
- While `nav.screen === "map"`: if `lessonTopic !== null`, render
  `<LessonScreen lesson={lesson} onDismiss={dismissLesson} />` in place of `MapScreen`;
  otherwise render `MapScreen`.
- `dismissLesson`: `store.progress.markLessonSeen(lessonTopic)` then
  `setLessonTopic(null)` (returns to the map).

`lessonFor` returns `Lesson | undefined`; all topics 1–11 have lessons, and the map only
renders cards for existing bank topics, so the topic is always resolvable. Guard by
rendering the takeover only when `lessonFor(lessonTopic)` is defined. The `MapViewModel`
persists across the takeover (it is memoized in `App`), so returning to the map is cheap
and state-preserving.

### 3. Data flow

```
MapScreen Learn tap
  -> onLearn(topic)
  -> App: setLessonTopic(topic)
  -> LessonScreen takeover (rendered in place of MapScreen)
  -> onDismiss
  -> App: markLessonSeen(topic); setLessonTopic(null)  (back to the map)
```

No view-model or model changes. `markLessonSeen` already exists on `ProgressStore` and is
the exact call `PlayerScreen` makes when its lesson is dismissed. No `map.refresh()` is
needed — map rows do not display lesson-seen state.

## Testing

Learn buttons carry `data-testid={`learn-${topic}`}` and the accessible name
`"Show the lesson"` (reusing `PlayerScreen`'s copy). The accessible name deliberately
omits the topic title so existing title-based queries
(`getByRole("button", { name: /Liberties/ })`) keep matching exactly one element — the
card's main control. Tests target Learn via `getByTestId`.

**`MapScreen.test.tsx`** (existing renders gain an `onLearn={vi.fn()}` prop)
- A Learn control renders on every card, including locked ones.
- Clicking Learn calls `onLearn` with that card's topic.
- Clicking Learn does **not** call `onOpen` and does **not** unlock the topic (regression
  guard: the Learn control is independent of `handleTap`).
- Triple-tapping a locked card still unlocks it and opens play (regression guard that the
  restructure preserves existing behaviour).

**`App.test.tsx`** (add `beforeEach(() => window.localStorage.clear())` for isolation —
`createStore` uses real `localStorage` and state otherwise bleeds across tests)
- Clicking Learn on a card shows the lesson (`role="dialog"`) in place of the map.
- Dismissing the lesson ("Start practicing") returns to the map.
- After viewing a topic's lesson from the map, first entry into that topic goes straight
  to practice (its lesson does not auto-open) — verifies the view marked it seen.

## Out of scope

The other two Phase 6 items — animate-capture-on-reveal and light/dark toggle +
keyboard-accessible board input — each get their own spec → plan → build cycle.

## Files touched

- `src/app/ui/MapScreen.tsx` — card restructure, `onLearn` prop, Learn control.
- `src/app/App.tsx` — `lessonTopic` state, `LessonScreen` overlay, wire `onLearn`.
- `src/app/styles.css` — `.tcard` container layout + `.learn` control styles.
- `src/app/ui/MapScreen.test.tsx`, `src/app/App.test.tsx` — tests above.
