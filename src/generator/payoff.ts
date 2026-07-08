import { Board, Stone, Color } from "../engine/board";
import { play } from "../engine/rules";
import type { DemoMove } from "./types";

export interface PlayedMove { x: number; y: number; c: Color; }

// Replay a move line from an initial position through the real rules engine,
// recording the stones each move removes. Build-time only — this is how a payoff
// line's `captures` become engine-truth rather than hand-counted.
export function annotate(size: number, stones: Stone[], moves: PlayedMove[]): DemoMove[] {
  let board = Board.from(size, stones);
  const out: DemoMove[] = [];
  for (const m of moves) {
    const res = play(board, m.x, m.y, m.c);
    if (!res.ok) throw new Error(`payoff move illegal at (${m.x},${m.y}) ${m.c}: ${res.reason}`);
    const dm: DemoMove = { x: m.x, y: m.y, c: m.c };
    if (res.captured.length) dm.captures = res.captured.map((p) => ({ x: p.x, y: p.y }));
    out.push(dm);
    board = res.board;
  }
  return out;
}
