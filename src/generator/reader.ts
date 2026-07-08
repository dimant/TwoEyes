import { Board, Point, Color } from "../engine/board";
import { play } from "../engine/rules";
import { group } from "../engine/liberties";
import type { PlayedMove } from "./payoff";

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

// Build-time. The principal variation that demonstrates the target's capture:
// attacker (Black) plays the shortest capturing line; defender (White) resists
// longest. Mirrors capturedUnderBestPlay's move model exactly, so a verified net
// always yields a non-null line. Returns null if the target is not captured within depth.
export function captureLine(board: Board, target: Point, toMove: Color, depth: number): PlayedMove[] | null {
  const g = group(board, target.x, target.y);
  if (g.stones.length === 0) return [];              // already captured
  if (g.liberties.length >= ESCAPE_LIBS) return null; // ran free
  if (depth <= 0) return null;

  if (toMove === "b") {
    // attacker: choose a capturing move, preferring the shortest resulting line
    let best: PlayedMove[] | null = null;
    for (const m of g.liberties) {
      const res = play(board, m.x, m.y, "b");
      if (!res.ok) continue;
      const tail = captureLine(res.board, target, "w", depth - 1);
      if (tail === null) continue;
      const line: PlayedMove[] = [{ x: m.x, y: m.y, c: "b" }, ...tail];
      if (best === null || line.length < best.length) best = line;
    }
    return best;
  }

  // defender (white): captured only if EVERY reply is still caught; show the most stubborn one
  const moves = [...g.liberties, ...defenderCaptureMoves(board, g.stones)];
  let longest: PlayedMove[] | null = null;
  let anyMove = false;
  for (const m of moves) {
    const res = play(board, m.x, m.y, "w");
    if (!res.ok) continue;
    anyMove = true;
    const tail = captureLine(res.board, target, "b", depth - 1);
    if (tail === null) return null; // white escapes this way -> not a forced capture
    const line: PlayedMove[] = [{ x: m.x, y: m.y, c: "w" }, ...tail];
    if (longest === null || line.length > longest.length) longest = line;
  }
  // No legal defender move (every liberty/rescue is itself illegal, e.g. suicide) —
  // the group is still on the board with a real liberty open, so play does NOT
  // auto-remove it. White effectively has no say here; hand the turn straight
  // back to Black to play the actual capturing move.
  if (!anyMove) return captureLine(board, target, "b", depth - 1);
  return longest;
}
