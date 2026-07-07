# Two Eyes

Learn the game of go from your very first stone — a puzzle app for **complete beginners**, built entirely on **public-domain** content and designed to work **offline**.

> In go, a group with **two eyes** lives. That idea — and the capturing and life-and-death fundamentals that lead up to it — is what this app teaches, one small puzzle at a time.

## Status

- ✅ **Content pipeline** — a minimal go rules engine plus deterministic puzzle generators that emit a committed, engine-verified puzzle bank.
- ⬜ **App** — an installable, offline-first PWA (React, MVVM) that serves the puzzles. _In progress._

## The puzzle bank

`src/bank/bank.json` holds the generated **Stage A** puzzles (capturing basics): **120 puzzles** across 3 topics × 2 rungs × 20 —

| Topic | Rungs | Mode |
|---|---|---|
| 1 · Liberties | open board · under attack | count (Q) |
| 2 · Capture a stone | interior · on the edge | play a move (M) |
| 3 · Capture a group | two stones · three–four stones | play a move (M) |

Every puzzle is proven **solvable, unique, and clean** against the rules engine (`src/bank/bank.test.ts`). The bank is committed data, not build output — the app bundles it unchanged; `npm run generate` reproduces it deterministically from a fixed seed.

## Develop

```sh
npm install
npm test          # unit tests + bank solvability suite (160 tests)
npm run typecheck  # tsc --noEmit
npm run generate   # rebuild src/bank/bank.json (deterministic)
```

## Layout

```
src/engine/      go rules core — board, liberties, capture (build-time only)
src/generator/   puzzle generators, validator, bank writer + CLI
src/bank/        the committed bank.json and its solvability suite
docs/superpowers/ design spec (specs/) and implementation plans (plans/)
```

## Content & licensing

All puzzle content is **generated** — public-domain by construction, with solutions verified by the engine. See the design spec in `docs/superpowers/specs/` for the content-sourcing rationale (why generation beats scraping existing collections for a beginner app).
