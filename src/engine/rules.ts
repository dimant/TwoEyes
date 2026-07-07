import { Board, Color, Point } from "./board";
import { group } from "./liberties";

export function opposite(c: Color): Color { return c === "b" ? "w" : "b"; }

export interface PlayResult {
  ok: boolean;
  board: Board;
  captured: Point[];
  reason?: string;
}

export function play(board: Board, x: number, y: number, color: Color): PlayResult {
  if (!board.inBounds(x, y)) return { ok: false, board, captured: [], reason: "out-of-bounds" };
  if (board.get(x, y) !== null) return { ok: false, board, captured: [], reason: "occupied" };

  const next = board.clone();
  next.set(x, y, color);
  const opp = opposite(color);
  const captured: Point[] = [];

  for (const n of next.neighbors(x, y)) {
    if (next.get(n.x, n.y) === opp) {
      const g = group(next, n.x, n.y);
      if (g.liberties.length === 0) {
        for (const s of g.stones) next.set(s.x, s.y, null);
        captured.push(...g.stones);
      }
    }
  }

  if (captured.length === 0 && group(next, x, y).liberties.length === 0) {
    return { ok: false, board, captured: [], reason: "suicide" };
  }
  return { ok: true, board: next, captured };
}
