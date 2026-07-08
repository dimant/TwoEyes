# Phase 6 — Lessons Browser Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a learner open any topic's concept lesson directly from the map via a per-card **Learn** button, without entering practice.

**Architecture:** Add a Learn control beside each map card that calls a new `onLearn(topic)` prop. `App` holds a `lessonTopic` state and, while on the map, renders the existing `LessonScreen` as a full-screen takeover in place of `MapScreen` (the same pattern `PlayerScreen` uses). Dismissing marks the lesson seen and returns to the map. No model or view-model changes — reuses `lessonFor`, `LessonScreen`, and `ProgressStore.markLessonSeen`.

**Tech Stack:** React 18 (function components, `useState`/`useMemo`), TypeScript (ESM), Vitest + @testing-library/react + jsdom. MVVM: `Observable` + `useSyncExternalStore` via `useViewModel`.

## Global Constraints

- **No new lesson content and no new lesson rendering** — reuse `lessonFor(topic)` and `LessonScreen` exactly as-is.
- **No model/view-model changes** — `MapViewModel`, `ProgressStore`, and `PuzzleBank` are untouched. `markLessonSeen` already exists and is the same call `PlayerScreen` makes.
- **Learn button accessible name is `"Show the lesson"`** (reuse `PlayerScreen`'s copy) and MUST NOT contain the topic title, so existing title-based queries like `getByRole("button", { name: /Liberties/ })` keep matching exactly one element (the card's main control). Tests target Learn via `data-testid={`learn-${topic}`}`.
- **Learn appears on every card, locked included.**
- **Reuse the existing `.learn` CSS class** (a pill button already defined at `styles.css:109`). Only a `.topic-row` flex wrapper is new CSS.
- Test commands: single file `npx vitest run <path>`; full suite `npm test`; types `npm run typecheck`.

---

### Task 1: Map card restructure + per-card Learn control

Splits each `.tcard` (currently a single `<button>`) into a `<li class="topic-row">` holding the existing main button plus a sibling Learn button. Adds the `onLearn` prop. The main button's tap/triple-tap logic is unchanged.

**Files:**
- Modify: `src/app/ui/MapScreen.tsx`
- Modify: `src/app/styles.css` (append `.topic-row` rules)
- Test: `src/app/ui/MapScreen.test.tsx`

**Interfaces:**
- Produces: `MapScreen` prop signature becomes
  `{ map: MapViewModel; onOpen: (topic: number, rung: number) => void; onLearn: (topic: number) => void }`.
  Each card renders a Learn `<button className="learn" data-testid={`learn-${topic}`} aria-label="Show the lesson">Learn</button>` that calls `onLearn(topic)`.

- [ ] **Step 1: Update existing MapScreen tests to pass the new `onLearn` prop**

In `src/app/ui/MapScreen.test.tsx`, add `onLearn` to every `render`/`rerender` of `MapScreen`. There are three call sites. In the rung-selection test add a spy and pass it:

```tsx
// describe("MapScreen rung selection") — inside the it():
const onOpen = vi.fn();
const onLearn = vi.fn();

const { rerender } = render(<MapScreen map={map} onOpen={onOpen} onLearn={onLearn} />);
fireEvent.click(screen.getByRole("button", { name: /Liberties/ }));
expect(onOpen).toHaveBeenLastCalledWith(1, 1);

for (let i = 0; i < MASTERY; i++) progress.record(1, 1, true);
map.refresh();
rerender(<MapScreen map={map} onOpen={onOpen} onLearn={onLearn} />);
fireEvent.click(screen.getByRole("button", { name: /Liberties/ }));
expect(onOpen).toHaveBeenLastCalledWith(1, 2);
```

In the `setup()` helper of `describe("MapScreen skip-ahead")`, add `onLearn` and return it:

```tsx
function setup() {
  const pb = new PuzzleBank(bank2);
  const map = new MapViewModel(pb, new ProgressStore(mem(), pb.rungRefs()));
  const onOpen = vi.fn();
  const onLearn = vi.fn();
  render(<MapScreen map={map} onOpen={onOpen} onLearn={onLearn} />);
  return { map, locked: screen.getByRole("button", { name: /Capture a stone/ }), onOpen, onLearn };
}
```

- [ ] **Step 2: Add the new Learn-control tests**

Append to `src/app/ui/MapScreen.test.tsx` (the `bank2` with topics 1–3, only topic 1 unlocked, is already defined in the skip-ahead describe — add this as a new `describe` that re-declares its own `bank2`/`setup` OR reuse by placing the tests inside the existing skip-ahead describe). Use a self-contained new describe:

```tsx
describe("MapScreen lessons browser", () => {
  const bank3: Bank = { seed: 0, stage: "A", puzzles: [
    mk(1, 1, "a"), mk(1, 2, "b"), mk(2, 1, "c"), mk(2, 2, "d"), mk(3, 1, "e"), mk(3, 2, "f"),
  ] };
  function setup() {
    const pb = new PuzzleBank(bank3);
    const map = new MapViewModel(pb, new ProgressStore(mem(), pb.rungRefs()));
    const onOpen = vi.fn();
    const onLearn = vi.fn();
    render(<MapScreen map={map} onOpen={onOpen} onLearn={onLearn} />);
    return { map, onOpen, onLearn };
  }
  const unlocked = (map: MapViewModel, topic: number) =>
    map.snapshot.rows.find((r) => r.topic === topic)?.unlocked ?? false;

  it("shows a Learn control on every card, including locked ones", () => {
    setup();
    expect(screen.getByTestId("learn-1")).toBeDefined(); // topic 1 unlocked
    expect(screen.getByTestId("learn-2")).toBeDefined(); // topic 2 locked
    expect(screen.getByTestId("learn-3")).toBeDefined(); // topic 3 locked
  });

  it("clicking Learn calls onLearn with the topic without opening or unlocking it", () => {
    const { map, onOpen, onLearn } = setup();
    fireEvent.click(screen.getByTestId("learn-2")); // locked topic
    expect(onLearn).toHaveBeenCalledWith(2);
    expect(onOpen).not.toHaveBeenCalled();
    expect(unlocked(map, 2)).toBe(false);
  });

  it("the Learn control does not match title-based button queries", () => {
    setup();
    // exactly one button matches the title — the card's main control, not Learn
    expect(screen.getAllByRole("button", { name: /Liberties/ })).toHaveLength(1);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/app/ui/MapScreen.test.tsx`
Expected: FAIL — the new tests fail because `data-testid="learn-*"` elements do not exist yet (`Unable to find an element by: [data-testid="learn-1"]`). Type errors on `onLearn` are also expected until Step 4.

- [ ] **Step 4: Implement the card restructure in `MapScreen.tsx`**

Add `onLearn` to the prop type and render the Learn button as a sibling inside a `topic-row` list item:

```tsx
export function MapScreen({ map, onOpen, onLearn }: { map: MapViewModel; onOpen: (topic: number, rung: number) => void; onLearn: (topic: number) => void }) {
  const s = useViewModel(map);
  const taps = useRef<{ topic: number; count: number; at: number }>({ topic: -1, count: 0, at: 0 });

  const handleTap = (topic: number, rung: number, unlocked: boolean): void => {
    if (unlocked) { onOpen(topic, rung); return; }
    const now = Date.now();
    const t = taps.current;
    if (t.topic === topic && now - t.at < TAP_WINDOW_MS) t.count += 1;
    else { t.topic = topic; t.count = 1; }
    t.at = now;
    if (t.count >= 3) {
      t.count = 0;
      map.unlockThrough(topic);
      onOpen(topic, rung);
    }
  };

  return (
    <div className="screen map">
      <div className="map-head">
        <div className="eyebrow">Stage A · Capturing basics</div>
        <h2>Your path</h2>
      </div>
      <ul className="topics">
        {s.rows.map((r) => (
          <li key={r.topic} className="topic-row">
            <button
              className={`tcard ${r.cleared ? "done" : r.unlocked ? "cur" : "lock"}`}
              onClick={() => handleTap(r.topic, r.openRung, r.unlocked)}
              title={r.unlocked ? undefined : "Locked — tap 3× to jump in"}
            >
              <span className="idx">{r.cleared ? "✓" : r.topic}</span>
              <span className="tmeta">
                <b>{TOPIC_TITLES[r.topic] ?? `Topic ${r.topic}`}</b>
                <span>{r.rungsCleared}/{r.rungsTotal} rungs</span>
              </span>
              <span className="tstate">{r.cleared ? "✓" : r.unlocked ? "Start" : "🔒"}</span>
            </button>
            <button
              className="learn"
              data-testid={`learn-${r.topic}`}
              aria-label="Show the lesson"
              onClick={() => onLearn(r.topic)}
            >
              Learn
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 5: Add the `.topic-row` layout CSS**

Append to `src/app/styles.css` (just after the `.tstate` rule at line 92 is a good home, next to the other `.topics` rules):

```css
.topic-row { display: flex; align-items: stretch; gap: 8px; }
.topic-row .tcard { flex: 1; width: auto; }
.topic-row .learn { flex: none; align-self: stretch; touch-action: manipulation; }
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/app/ui/MapScreen.test.tsx`
Expected: PASS — all rung-selection, skip-ahead, and new lessons-browser tests green.

- [ ] **Step 7: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/app/ui/MapScreen.tsx src/app/ui/MapScreen.test.tsx src/app/styles.css
git commit -m "$(cat <<'EOF'
feat(app): per-card Learn button on the map

Split each topic card into a topic-row with the existing main control
plus a sibling Learn button (data-testid learn-<topic>, name "Show the
lesson"), on every card including locked. Adds the onLearn prop; reuses
the existing .learn pill style.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013CsZD5HwrD78GC6o8uPZ5F
EOF
)"
```

---

### Task 2: Wire the lesson takeover into `App`

`App` gains a `lessonTopic` state. While on the map, if a lesson is selected it renders `LessonScreen` in place of `MapScreen`; dismissing marks the lesson seen and returns to the map.

**Files:**
- Modify: `src/app/App.tsx`
- Test: `src/app/App.test.tsx`

**Interfaces:**
- Consumes: `MapScreen`'s `onLearn: (topic: number) => void` prop (Task 1); `lessonFor(topic): Lesson | undefined` and `LessonScreen({ lesson, onDismiss })` (both existing); `store.progress.markLessonSeen(topic)` (existing).

- [ ] **Step 1: Add localStorage isolation + write the failing App tests**

`createStore()` uses real `window.localStorage` (via `safeStorage()`), and `test-setup.ts` only runs RTL `cleanup()` — so `lessonSeen` state bleeds across tests. Add a `beforeEach` clear and the new tests to `src/app/App.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { App } from "./App";

describe("App", () => {
  beforeEach(() => window.localStorage.clear());

  it("shows the topic map and opens a topic into the player", () => {
    render(<App />);
    expect(screen.getByText(/Capturing basics/i)).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: /Liberties/i }));
    fireEvent.click(screen.getByRole("button", { name: /Start practicing/ }));
    expect(screen.getByText("● Black to play")).toBeDefined();
  });

  it("opens a lesson from the map and returns to the map on dismiss", () => {
    render(<App />);
    fireEvent.click(screen.getByTestId("learn-1"));
    // lesson takes over: the dialog shows and the map is gone
    expect(screen.getByRole("dialog")).toBeDefined();
    expect(screen.queryByText(/Capturing basics/i)).toBeNull();
    // dismiss returns to the map
    fireEvent.click(screen.getByRole("button", { name: /Start practicing/ }));
    expect(screen.getByText(/Capturing basics/i)).toBeDefined();
  });

  it("viewing a lesson from the map marks it seen, so entering the topic skips the auto-lesson", () => {
    render(<App />);
    fireEvent.click(screen.getByTestId("learn-1"));           // view topic 1's lesson
    fireEvent.click(screen.getByRole("button", { name: /Start practicing/ })); // dismiss -> marks seen
    fireEvent.click(screen.getByRole("button", { name: /Liberties/i }));       // enter topic 1
    // lesson does NOT auto-open — we land straight in practice
    expect(screen.getByText("● Black to play")).toBeDefined();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/app/App.test.tsx`
Expected: FAIL — `learn-1` testid does not exist in `App` yet (`MapScreen` is rendered without `onLearn` and the lesson takeover is unwired), so `getByTestId("learn-1")` throws.

- [ ] **Step 3: Wire the takeover into `App.tsx`**

```tsx
import { useMemo, useState } from "react";
import { createStore } from "./store";
import { MapViewModel } from "./vm/map-vm";
import { PlayerViewModel } from "./vm/player-vm";
import { MapScreen } from "./ui/MapScreen";
import { PlayerScreen } from "./ui/PlayerScreen";
import { LessonScreen } from "./ui/LessonScreen";
import { lessonFor } from "./content/lessons";

type Nav = { screen: "map" } | { screen: "play"; topic: number; rung: number };

export function App() {
  const store = useMemo(() => createStore(), []);
  const map = useMemo(() => new MapViewModel(store.bank, store.progress), [store]);
  const [nav, setNav] = useState<Nav>({ screen: "map" });
  const [lessonTopic, setLessonTopic] = useState<number | null>(null);

  const player = useMemo(
    () => (nav.screen === "play" ? new PlayerViewModel(store.bank, store.progress, nav.topic, nav.rung) : null),
    [store, nav],
  );

  // On the map, a Learn tap opens the concept lesson as a full-screen takeover
  // (same pattern as PlayerScreen). Dismissing marks it seen and returns to the map.
  const mapLesson = lessonTopic != null ? lessonFor(lessonTopic) : undefined;
  const dismissMapLesson = () => {
    if (lessonTopic != null) store.progress.markLessonSeen(lessonTopic);
    setLessonTopic(null);
  };

  return (
    <div className="app">
      <header className="topbar"><span className="brand">Two Eyes</span></header>
      {nav.screen === "map" && (
        mapLesson ? (
          <LessonScreen lesson={mapLesson} onDismiss={dismissMapLesson} />
        ) : (
          <MapScreen
            map={map}
            onOpen={(topic, rung) => setNav({ screen: "play", topic, rung })}
            onLearn={setLessonTopic}
          />
        )
      )}
      {nav.screen === "play" && player && (
        <PlayerScreen
          key={`${nav.topic}-${nav.rung}`}
          player={player}
          onExit={() => { map.refresh(); setNav({ screen: "map" }); }}
          lesson={lessonFor(nav.topic)}
          lessonSeen={store.progress.lessonSeen(nav.topic)}
          onLessonSeen={() => store.progress.markLessonSeen(nav.topic)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/app/App.test.tsx`
Expected: PASS — all three App tests green.

- [ ] **Step 5: Run the full suite and typecheck**

Run: `npm test`
Expected: PASS — full suite green (previous count plus the new MapScreen/App tests).

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Build (confirms the production bundle still compiles)**

Run: `npm run build`
Expected: `tsc --noEmit` clean, Vite build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/app/App.tsx src/app/App.test.tsx
git commit -m "$(cat <<'EOF'
feat(app): open concept lessons from the map

App gains a lessonTopic state; a Learn tap on the map renders the
existing LessonScreen as a full-screen takeover in place of the map.
Dismissing marks the lesson seen (so first practice entry skips the
auto-lesson) and returns to the map. Tests clear localStorage between
cases since createStore uses real storage.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013CsZD5HwrD78GC6o8uPZ5F
EOF
)"
```

---

## Manual verification (after both tasks)

Run `npm run dev` and, in the browser:
1. On the map, every topic card — locked and unlocked — shows a **Learn** pill.
2. Tapping **Learn** on any card opens that concept lesson (diagram, animated payoff replays, caption, body) full-screen.
3. **Start practicing** returns to the map (does not drop into that topic's puzzles).
4. Tap **Learn** on a not-yet-entered topic, dismiss, then open that topic to practice — the lesson does **not** auto-open (it was marked seen); its in-player **Learn** button still reopens it.

## Self-review notes (author)

- **Spec coverage:** access model (Task 1 Learn control), all-topics-including-locked (Task 1 test), mark-as-seen (Task 2 `dismissMapLesson` + test 3), takeover pattern (Task 2 Step 3). All covered.
- **Type consistency:** `onLearn: (topic: number) => void` in Task 1 matches `onLearn={setLessonTopic}` where `setLessonTopic: (n: number | null) => void` accepts a `number` argument in Task 2. `mapLesson: Lesson | undefined` guards the takeover render.
- **No new model/VM/content** — constraint honored.
