---
name: verify
description: Drive the Two Eyes app in a headless browser to verify a UI change works at runtime. Use when confirming a player/map/lesson change in the real app (not just tests).
---

# Verifying Two Eyes in the browser

Two Eyes is a React + Vite PWA. The surface is the GUI — drive it with the
**bundled Playwright** (`node_modules/playwright`, Chromium) and screenshot.

## Launch

```bash
node_modules/.bin/vite --port 5178 --strictPort >/tmp/vite.log 2>&1 &
# ready when: curl -s -o /dev/null -w '%{http_code}' http://localhost:5178/  -> 200
```

Kill when done: `lsof -ti tcp:5178 | xargs kill`.

## Drive (Playwright, CommonJS)

Run scripts from a scratch dir but require Playwright by absolute path (the
scratch dir has no `node_modules`):

```js
const { chromium } = require('/Users/diman/src/golife/node_modules/playwright');
```

Recipes that work:
- **Reach a topic's puzzles fast:** the map gates topics linearly. Triple-tap
  a locked topic card to skip-ahead unlock + enter:
  `const t = page.getByRole('button', { name: /Capture a stone/ }); await t.click(); await t.click(); await t.click();`
- **Dismiss the auto-lesson:** `page.getByRole('button', { name: /Start practicing/ }).click()`
  (map-browser lessons dismiss with `/Back to map/` instead).
- **Solve a puzzle deterministically:** the first puzzle in a rung is
  `bank.puzzles(topic,rung)[0]` = the bank's first matching entry. Get its
  solution point and board pixel from the bank; board geometry is `M=24, CELL=40`,
  `px(v)=M+v*CELL`. Click the tap target: `page.locator('[data-tap][cx="64"][cy="24"]').click()`.
- **Board queries:** stones are `circle.stone`; white = `fill="var(--white)"`,
  black = `fill="var(--black)"`. The learner's move ring is `circle.pick-ring`.
- **Stepped reveal (ladders/nets/snapback + capture topics 2/3/7):** reveal shows
  a **Next move ▸** button (`getByRole('button',{name:/Next move/i})`); stepping
  folds the payoff; **Replay** resets. Feedback's advance button is **Next →**
  (distinct glyph) — target `/Next →/` to avoid matching `/Next move/`.

Screenshot each state (`page.screenshot({ path })`) and read the PNGs back as
evidence. Console noise from Vite/React devtools is expected.

## Notes
- Fresh browser = empty localStorage, so topic lessons auto-open on first entry.
- `npx playwright install chromium` if the browser binary is missing.
