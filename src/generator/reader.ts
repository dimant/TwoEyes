import { Board, Point, Color } from "../engine/board";
import { play } from "../engine/rules";
import { group } from "../engine/liberties";

const ESCAPE_LIBS = 3;

// Empty points where WHITE, by playing, captures a Black stone touching the target
// (a black chaser in atari) — a defensive escape resource.
function defenderCaptureMoves(board: Board, targetStones: Point[]): Point[] {
  const out: Point[] = [];
  const seen = new Set<string>();
  for (const s of targetStones) {
    for (const n of board.neighbors(s.x, s.y)) {
      if (board.get(n.x, n.y) !== "b") continue; // a black chaser touching the target
      const bg = group(board, n.x, n.y);
      if (bg.liberties.length === 1) {
        const cap = bg.liberties[0]!; // white plays here to capture the chaser
        const k = `${cap.x},${cap.y}`;
        if (!seen.has(k)) { seen.add(k); out.push(cap); }
      }
    }
  }
  return out;
}

export function capturedUnderBestPlay(board: Board, target: Point, toMove: Color, depth: number): boolean {
  const g = group(board, target.x, target.y);
  if (g.stones.length === 0) return true;              // target already captured
  if (g.liberties.length >= ESCAPE_LIBS) return false; // ran free
  if (depth <= 0) return false;                        // out of reading -> assume it escaped

  if (toMove === "b") {
    // attacker: play a liberty of the target to reduce it
    for (const m of g.liberties) {
      const res = play(board, m.x, m.y, "b");
      if (!res.ok) continue;
      if (capturedUnderBestPlay(res.board, target, "w", depth - 1)) return true;
    }
    return false;
  }
  // defender (white): escape if ANY move avoids capture
  const moves = [...g.liberties, ...defenderCaptureMoves(board, g.stones)];
  for (const m of moves) {
    const res = play(board, m.x, m.y, "w");
    if (!res.ok) continue;
    if (!capturedUnderBestPlay(res.board, target, "b", depth - 1)) return false;
  }
  return true; // defender has no escaping move
}
