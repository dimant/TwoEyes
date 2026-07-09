import type { Stone, DemoMove, Puzzle } from "./types";

// Pure, engine-free replay of a payoff line for rendering. Placing a stone drops
// any stones the move captured, then adds the played stone.
export function applyDemoMove(stones: Stone[], m: DemoMove): Stone[] {
  const removed = new Set((m.captures ?? []).map((c) => `${c.x},${c.y}`));
  const kept = stones.filter((s) => !removed.has(`${s.x},${s.y}`));
  return [...kept, { x: m.x, y: m.y, c: m.c }];
}

// The board position after the first `step` moves of the payoff (clamped).
export function positionAt(initial: Stone[], payoff: DemoMove[], step: number): Stone[] {
  let stones = initial;
  const n = Math.min(step, payoff.length);
  for (let i = 0; i < n; i++) stones = applyDemoMove(stones, payoff[i]!);
  return stones;
}

// Derives the reveal animation for a capturing move: a single DemoMove that, when
// folded by positionAt, drops the captured stones and places the played stone. Returns
// undefined when the move doesn't capture (nothing to animate) — the caller then falls
// back to the static reveal. Unlike ladder/net payoffs, this is trivially derivable from
// already-verified fields, so it is computed at the view rather than stored in the bank.
export function captureRevealPayoff(puzzle: Puzzle): DemoMove[] | undefined {
  if (puzzle.mode !== "M") return undefined;
  if (puzzle.solution.kind !== "move") return undefined;
  const p = puzzle.solution.points[0];
  if (!p) return undefined;
  if (!puzzle.captured?.length) return undefined;
  return [{ x: p.x, y: p.y, c: puzzle.toPlay, captures: puzzle.captured }];
}
