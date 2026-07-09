# Phase 6 — Theme Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a cycling top-bar button that switches the colour theme System → Light → Dark → System, persisted across sessions.

**Architecture:** A headless `ThemeStore` (Observable) holds the chosen `Theme` and persists it via the existing `KeyValue` storage; a pure `applyTheme` helper sets/clears `data-theme` on the document root (the stylesheet already reacts to it). `App` owns the store, renders a `ThemeToggle` button, and applies the theme to `document.documentElement` in an effect. A tiny inline script in `index.html` applies a forced theme before first paint to avoid a flash.

**Tech Stack:** TypeScript (ESM), React 18 (`useMemo`/`useEffect`/`useSyncExternalStore` via `useViewModel`), Vitest + @testing-library/react + jsdom. Model layer stays headless.

## Global Constraints

- **No colour/token change** — the palette is unchanged; this is wiring + a control.
- **Three modes only:** `"system" | "light" | "dark"`. `system` clears `data-theme` (media query governs); `light`/`dark` set `data-theme`.
- **Cycle order is exactly** `system → light → dark → system` (`THEME_ORDER = ["system","light","dark"]`).
- **Storage key is exactly** `"two-eyes:theme"` (`THEME_KEY`), via the existing `KeyValue`/`safeStorage` abstraction.
- **Model stays headless** — `src/app/model/theme.ts` must not touch the DOM; `applyTheme` takes the root element as a parameter.
- **Default is `"system"`** when storage is empty or holds an invalid value.
- Test commands: single file `npx vitest run <path>`; full suite `npm test`; types `npm run typecheck`; build `npm run build`.

---

### Task 1: Theme model — `ThemeStore` + `applyTheme`

Headless model: the store holds/persists the chosen theme; the helper applies it to a root element. No DOM access in the store.

**Files:**
- Create: `src/app/model/theme.ts`
- Test: `src/app/model/theme.test.ts`

**Interfaces:**
- Produces:
  - `type Theme = "system" | "light" | "dark"`
  - `const THEME_ORDER: Theme[]` (= `["system","light","dark"]`)
  - `const THEME_KEY: string` (= `"two-eyes:theme"`)
  - `class ThemeStore extends Observable<{ theme: Theme }>` with `constructor(storage: KeyValue)` and `cycle(): void`
  - `function applyTheme(theme: Theme, root: { dataset: { theme?: string } }): void`

- [ ] **Step 1: Write the failing tests**

Create `src/app/model/theme.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { ThemeStore, applyTheme, THEME_KEY } from "./theme";
import type { KeyValue } from "./progress";

function mem(init?: Record<string, string>): KeyValue {
  const m = new Map<string, string>(Object.entries(init ?? {}));
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) };
}

describe("ThemeStore", () => {
  it("defaults to system when storage is empty", () => {
    expect(new ThemeStore(mem()).snapshot.theme).toBe("system");
  });

  it("reads a persisted theme", () => {
    expect(new ThemeStore(mem({ [THEME_KEY]: "dark" })).snapshot.theme).toBe("dark");
  });

  it("falls back to system for an invalid stored value", () => {
    expect(new ThemeStore(mem({ [THEME_KEY]: "bogus" })).snapshot.theme).toBe("system");
  });

  it("cycle() advances system->light->dark->system and persists each step", () => {
    const storage = mem();
    const s = new ThemeStore(storage);
    s.cycle();
    expect(s.snapshot.theme).toBe("light");
    expect(storage.getItem(THEME_KEY)).toBe("light");
    s.cycle();
    expect(s.snapshot.theme).toBe("dark");
    expect(storage.getItem(THEME_KEY)).toBe("dark");
    s.cycle();
    expect(s.snapshot.theme).toBe("system");
    expect(storage.getItem(THEME_KEY)).toBe("system");
  });
});

describe("applyTheme", () => {
  it("sets data-theme for the forced modes", () => {
    const el = { dataset: {} as { theme?: string } };
    applyTheme("light", el);
    expect(el.dataset.theme).toBe("light");
    applyTheme("dark", el);
    expect(el.dataset.theme).toBe("dark");
  });

  it("removes data-theme for system", () => {
    const el = { dataset: { theme: "dark" } as { theme?: string } };
    applyTheme("system", el);
    expect(el.dataset.theme).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/app/model/theme.test.ts`
Expected: FAIL — `./theme` does not exist yet (import/module-not-found error).

- [ ] **Step 3: Implement `src/app/model/theme.ts`**

```ts
import { Observable } from "../vm/observable";
import type { KeyValue } from "./progress";

export type Theme = "system" | "light" | "dark";

// The order the top-bar button cycles through.
export const THEME_ORDER: Theme[] = ["system", "light", "dark"];
export const THEME_KEY = "two-eyes:theme";

function isTheme(v: string | null): v is Theme {
  return v === "system" || v === "light" || v === "dark";
}

// Holds the chosen theme and persists it. Headless: no DOM access — applyTheme (below)
// is the single place that touches the document, wired up by App.
export class ThemeStore extends Observable<{ theme: Theme }> {
  constructor(private readonly storage: KeyValue) {
    const stored = storage.getItem(THEME_KEY);
    super({ theme: isTheme(stored) ? stored : "system" });
  }

  cycle(): void {
    const cur = this.snapshot.theme;
    const next = THEME_ORDER[(THEME_ORDER.indexOf(cur) + 1) % THEME_ORDER.length]!;
    this.storage.setItem(THEME_KEY, next);
    this.set({ theme: next });
  }
}

// Applies a theme to a root element: forced modes set data-theme (the stylesheet's
// :root[data-theme=...] overrides win); "system" clears it so @media prefers-color-scheme
// resumes control. Takes the root as a parameter so the model stays DOM-free and testable.
export function applyTheme(theme: Theme, root: { dataset: { theme?: string } }): void {
  if (theme === "system") delete root.dataset.theme;
  else root.dataset.theme = theme;
}
```

Note: the constructor reads the `storage` **parameter** (not `this.storage`) before `super()`, which is required — `this` is unavailable until after `super()`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/app/model/theme.test.ts`
Expected: PASS — all `ThemeStore` and `applyTheme` tests green.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/model/theme.ts src/app/model/theme.test.ts
git commit -m "$(cat <<'EOF'
feat(app): ThemeStore + applyTheme (headless theme model)

A persisted Observable holding system/light/dark and a pure helper that
sets/clears data-theme on a root element. No DOM access in the store.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013CsZD5HwrD78GC6o8uPZ5F
EOF
)"
```

---

### Task 2: `ThemeToggle` control + wiring + no-FOUC script

The visible button, the `App` wiring that owns the store and drives the DOM, the top-bar styling, and the pre-paint script.

**Files:**
- Create: `src/app/ui/ThemeToggle.tsx`
- Test: `src/app/ui/ThemeToggle.test.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/app/styles.css`
- Modify: `index.html`

**Interfaces:**
- Consumes: `ThemeStore`, `applyTheme`, `Theme`, `THEME_ORDER` from `src/app/model/theme.ts` (Task 1); `safeStorage` from `src/app/store.ts`; `useViewModel` from `src/app/useViewModel.ts`.
- Produces: `ThemeToggle({ store }: { store: ThemeStore }): JSX.Element`.

- [ ] **Step 1: Write the failing ThemeToggle test**

Create `src/app/ui/ThemeToggle.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeToggle } from "./ThemeToggle";
import { ThemeStore } from "../model/theme";

function mem() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
}

describe("ThemeToggle", () => {
  it("shows the current mode in its accessible name and cycles on click", () => {
    const store = new ThemeStore(mem());
    render(<ThemeToggle store={store} />);
    expect(screen.getByRole("button", { name: /Theme: system/ })).toBeDefined();
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("button", { name: /Theme: light/ })).toBeDefined();
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("button", { name: /Theme: dark/ })).toBeDefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/app/ui/ThemeToggle.test.tsx`
Expected: FAIL — `./ThemeToggle` does not exist yet.

- [ ] **Step 3: Implement `src/app/ui/ThemeToggle.tsx`**

```tsx
import { THEME_ORDER, type Theme, type ThemeStore } from "../model/theme";
import { useViewModel } from "../useViewModel";

const ICON: Record<Theme, string> = { system: "◐", light: "☀", dark: "☾" };
const nextTheme = (t: Theme): Theme =>
  THEME_ORDER[(THEME_ORDER.indexOf(t) + 1) % THEME_ORDER.length]!;

export function ThemeToggle({ store }: { store: ThemeStore }) {
  const { theme } = useViewModel(store);
  return (
    <button
      className="theme-toggle"
      onClick={() => store.cycle()}
      aria-label={`Theme: ${theme}. Switch to ${nextTheme(theme)}.`}
      title={`Theme: ${theme}`}
    >
      <span aria-hidden="true">{ICON[theme]}</span>
    </button>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/app/ui/ThemeToggle.test.tsx`
Expected: PASS.

- [ ] **Step 5: Wire the store into `App.tsx`**

Make these edits to `src/app/App.tsx`:

Change the React import (line 1):
```tsx
import { useEffect, useMemo, useState } from "react";
```

Change the store import (line 2) to also bring in `safeStorage`:
```tsx
import { createStore, safeStorage } from "./store";
```

Add these imports after the existing import block (after the `lessonFor` import):
```tsx
import { ThemeStore, applyTheme } from "./model/theme";
import { ThemeToggle } from "./ui/ThemeToggle";
import { useViewModel } from "./useViewModel";
```

Inside `App`, after the `const [lessonTopic, setLessonTopic] = useState<number | null>(null);` line, add:
```tsx
  const themeStore = useMemo(() => new ThemeStore(safeStorage()), []);
  const { theme } = useViewModel(themeStore);
  useEffect(() => { applyTheme(theme, document.documentElement); }, [theme]);
```

Replace the header line:
```tsx
      <header className="topbar"><span className="brand">Two Eyes</span></header>
```
with:
```tsx
      <header className="topbar">
        <span className="brand">Two Eyes</span>
        <ThemeToggle store={themeStore} />
      </header>
```

- [ ] **Step 6: Add the top-bar button styling to `src/app/styles.css`**

Append (near the other `.topbar` rules, after line 54 `}` of `.brand`):
```css
.topbar { position: relative; }
.theme-toggle {
  position: absolute; right: 14px; top: 50%; transform: translateY(-50%);
  appearance: none; width: 34px; height: 34px; border-radius: 10px;
  border: 1px solid var(--hair); background: var(--panel); color: var(--ink);
  font: inherit; font-size: 16px; line-height: 1; display: grid; place-items: center;
  cursor: pointer; transition: filter .15s;
}
.theme-toggle:hover { filter: brightness(1.04); }
.theme-toggle:focus-visible { outline: 2px solid var(--accent-ink); outline-offset: 2px; }
```

- [ ] **Step 7: Add the no-FOUC inline script to `index.html`**

In `index.html`, insert this block immediately after the `<title>Two Eyes</title>` line (line 10), inside `<head>`:
```html
    <script>
      // Apply a forced theme before first paint (no flash). "system"/absent leaves the
      // attribute unset so @media prefers-color-scheme applies.
      try {
        var t = localStorage.getItem("two-eyes:theme");
        if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
      } catch (e) {}
    </script>
```

- [ ] **Step 8: Run the full suite, typecheck, and build**

Run: `npx vitest run src/app/ui/ThemeToggle.test.tsx src/app/model/theme.test.ts`
Expected: PASS.

Run: `npm test`
Expected: PASS — full suite green.

Run: `npm run typecheck`
Expected: no errors (note: `document.documentElement` satisfies `applyTheme`'s `{ dataset: { theme?: string } }` parameter).

Run: `npm run build`
Expected: `tsc --noEmit` clean, Vite build succeeds.

- [ ] **Step 9: Commit**

```bash
git add src/app/ui/ThemeToggle.tsx src/app/ui/ThemeToggle.test.tsx src/app/App.tsx src/app/styles.css index.html
git commit -m "$(cat <<'EOF'
feat(app): light/dark theme toggle in the top bar

A cycling icon button (System -> Light -> Dark) wired to ThemeStore;
App applies the theme to the document root on change. An inline script
applies a forced theme before first paint to avoid a flash.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013CsZD5HwrD78GC6o8uPZ5F
EOF
)"
```

---

## Manual verification (after both tasks)

Run `npm run dev` and, in the browser:
1. The top bar shows a theme button (auto glyph ◐ initially).
2. Click it → ☀ and the UI switches to light (forced, even if the OS is dark); click → ☾ dark; click → ◐ system (follows the OS again).
3. Reload → the last choice persists, with no flash of the wrong theme when a forced theme differs from the OS.

## Self-review notes (author)

- **Spec coverage:** three modes + cycle order + default (Task 1 `ThemeStore` + tests); `applyTheme` set/clear (Task 1 + tests); cycling icon button in the top bar with accessible name (Task 2 `ThemeToggle` + test); App owns store + applies on change (Task 2 Step 5); no-FOUC script (Task 2 Step 7); styling (Task 2 Step 6). All covered.
- **Type consistency:** `ThemeStore(storage: KeyValue)`, `cycle(): void`, `applyTheme(theme, root)`, `THEME_ORDER`, `THEME_KEY`, `Theme` are defined in Task 1 and consumed identically in Task 2. `useViewModel(store)` returns `{ theme }`.
- **Headless model:** `theme.ts` imports only `Observable` and the `KeyValue` type; no DOM. The DOM is touched only by `applyTheme` (via App) and the inline script.
- **No colour/token change; palette untouched.**
