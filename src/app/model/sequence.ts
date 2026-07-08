import type { Stone, DemoMove } from "./types";

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
