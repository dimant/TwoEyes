# Phase 6 — Light/dark theme toggle (design)

**Status:** approved, ready for planning
**Date:** 2026-07-09
**Phase:** 6 (Interaction & UX polish), item 3a of 3

## Goal

Give the learner control over the colour theme with a cycling top-bar button:
**System → Light → Dark → System**, persisted across sessions. Today the app follows
the OS via `@media (prefers-color-scheme: dark)` with no way to override.

This is **wiring + a control** — the stylesheet is already theme-aware. `src/app/styles.css`
defines `:root` light defaults, a `@media (prefers-color-scheme: dark)` block, **and**
explicit `:root[data-theme="light"]` / `:root[data-theme="dark"]` overrides. Setting (or
clearing) `data-theme` on the document root is all that is needed to force or release a
theme. No colour/token work.

## Decisions (from brainstorming)

1. **Modes:** three-way **System / Light / Dark**. `system` = no `data-theme` (the media
   query governs); `light`/`dark` = forced via `data-theme`.
2. **Control:** a single cycling icon button in the top bar (right of the brand), showing
   the active mode's icon and advancing `system→light→dark→system` on click. Not a
   segmented control.
3. **Split:** this is spec 3a of the final Phase 6 item; keyboard-accessible board input
   is a separate spec (3b).

## Design

### 1. Theme model — `src/app/model/theme.ts` (headless)

- `export type Theme = "system" | "light" | "dark"`.
- `export const THEME_ORDER: Theme[] = ["system", "light", "dark"]` — the cycle order.
- `export const THEME_KEY = "two-eyes:theme"`.
- `export class ThemeStore extends Observable<{ theme: Theme }>` — same `Observable` +
  `useViewModel` pattern as `MapViewModel`.
  - Constructor takes a `KeyValue` storage (the existing abstraction `ProgressStore` uses)
    and initialises `theme` from `storage.getItem(THEME_KEY)`, defaulting to `"system"`
    when absent or not one of the three valid values.
  - `cycle(): void` — advances to the next `Theme` in `THEME_ORDER` (wrapping), persists
    via `storage.setItem(THEME_KEY, next)`, and re-renders.
  - **No DOM access** — the store holds the value only, so it stays headless/testable.
- `export function applyTheme(theme: Theme, root: { dataset: { theme?: string } }): void`
  — sets `root.dataset.theme = "light" | "dark"` for the forced modes and **deletes**
  `root.dataset.theme` for `"system"` (so the `@media` query resumes control). Written
  against the minimal `{ dataset }` shape so it is testable with a plain object.

### 2. Control — `src/app/ui/ThemeToggle.tsx`

```tsx
export function ThemeToggle({ store }: { store: ThemeStore }): JSX.Element
```

- Subscribes via `useViewModel(store)`.
- Renders a `<button className="theme-toggle">` whose visible content is the active mode's
  icon: `☀` (light), `☾` (dark), and an auto glyph (`◐`) for system.
- `onClick={() => store.cycle()}`.
- Accessible name announces the state and the resulting action, e.g.
  `aria-label="Theme: system. Switch to light."` — the "switch to" target is the next
  mode in `THEME_ORDER`.
- Small styling added to `src/app/styles.css` reusing the existing icon-button feel
  (e.g. the `.learn`/pill or a plain ghost button); does not disturb the top-bar layout.

### 3. Wiring — `src/app/App.tsx`

- `App` owns a memoized `ThemeStore` built from the app's storage abstraction:
  `const themeStore = useMemo(() => new ThemeStore(safeStorage()), [])`, importing the
  existing `safeStorage` from `./store`. (`safeStorage()` is a stateless wrapper over
  `window.localStorage`, so a second instance alongside `ProgressStore`'s is fine; only
  the private-mode in-memory fallback would not be shared, and persistence is moot there.)
- Renders `<ThemeToggle store={themeStore} />` inside the existing
  `<header className="topbar">`, after the brand span.
- A `useEffect` keyed on the current theme calls
  `applyTheme(theme, document.documentElement)` so a single place drives the DOM. Reading
  the theme for the effect uses `useViewModel(themeStore)` (or the store snapshot).

### 4. No flash of wrong theme — `index.html`

Add a tiny inline script in `<head>` (before the app bundle) that reads
`localStorage["two-eyes:theme"]` and, for `"light"`/`"dark"`, sets
`document.documentElement.dataset.theme` before first paint; for `"system"`/absent it
leaves the attribute unset so the media query applies. This prevents a flash when a forced
theme differs from the OS preference. It intentionally duplicates the storage key and the
apply rule — the standard, minimal price for no-FOUC. Guard the `localStorage` access in a
`try/catch` (private mode can throw), matching `safeStorage`'s resilience.

## Testing

**`src/app/model/theme.test.ts`**
- `new ThemeStore(storage)` defaults to `"system"` when storage is empty, and reads back a
  persisted value (`"dark"`) when present.
- Invalid stored value falls back to `"system"`.
- `cycle()` advances `system→light→dark→system` and writes each step to storage.
- `applyTheme("light", el)` / `("dark", el)` set `el.dataset.theme` accordingly;
  `applyTheme("system", el)` deletes `el.dataset.theme` (verified against a plain
  `{ dataset: {} }`).

**`src/app/ui/ThemeToggle.test.tsx`**
- Renders the active mode's accessible name (e.g. system shows
  `aria-label` containing "Theme: system").
- Clicking cycles to the next mode and the button's accessible name updates
  (system → light).

## Out of scope

- Keyboard-accessible board input — separate spec (Phase 6, item 3b).
- Any colour/token change; the palette is unchanged.

## Files touched

- `src/app/model/theme.ts` — `Theme`, `THEME_ORDER`, `THEME_KEY`, `ThemeStore`, `applyTheme`.
- `src/app/model/theme.test.ts` — model tests.
- `src/app/ui/ThemeToggle.tsx` — the top-bar button.
- `src/app/ui/ThemeToggle.test.tsx` — control tests.
- `src/app/App.tsx` — own the store, render the toggle, apply on change.
- `src/app/styles.css` — `.theme-toggle` styling.
- `index.html` — no-FOUC inline script.
