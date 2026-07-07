import { Board, Point, Color } from "../engine/board";
import { play, PlayResult } from "../engine/rules";

export type Policy = "unique" | "any-valid";
export type GoalFn = (before: Board, move: Point, color: Color, res: PlayResult) => boolean;

export function goalMoves(board: Board, color: Color, goal: GoalFn): Point[] {
  const out: Point[] = [];
  for (let y = 0; y < board.size; y++)
    for (let x = 0; x < board.size; x++) {
      if (board.get(x, y) !== null) continue;
      const res = play(board, x, y, color);
      if (res.ok && goal(board, { x, y }, color, res)) out.push({ x, y });
    }
  return out;
}

export function validateM(
  board: Board, color: Color, goal: GoalFn, policy: Policy,
): { valid: boolean; solution: Point[] } {
  const moves = goalMoves(board, color, goal);
  if (moves.length === 0) return { valid: false, solution: [] };
  if (policy === "unique") return { valid: moves.length === 1, solution: moves };
  return { valid: true, solution: moves };
}
