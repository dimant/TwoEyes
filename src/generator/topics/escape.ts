import { Board, Point } from "../../engine/board";
import { group } from "../../engine/liberties";
import { validateM, GoalFn } from "../validate";
import { Rng, shuffle } from "../../engine/rng";
import { Region, startCell } from "../geometry";
import { Puzzle } from "../types";

// A move rescues the target if, afterwards, the target is still on the board
// and its group has >= 2 liberties.
function escapeGoal(target: Point): GoalFn {
  return (_before, _move, _color, res) => {
    if (res.board.get(target.x, target.y) !== "b") return false;
    return group(res.board, target.x, target.y).liberties.length >= 2;
  };
}

export function generateEscape(
  rng: Rng,
  opts: { rung: number; size: number; count: number; region: Region },
): Puzzle[] {
  const { rung, size, count, region } = opts;
  const out: Puzzle[] = [];
  const seen = new Set<string>();
  let guard = 0;

  while (out.length < count && guard++ < count * 800) {
    const target = startCell(rng, size, region);
    const board = new Board(size);
    board.set(target.x, target.y, "b");

    const nbrs = board.neighbors(target.x, target.y);
    if (nbrs.length < 2) continue; // need at least one to fill and one to leave open
    const shuffled = shuffle(rng, nbrs);
    const fill = shuffled.slice(1); // leave shuffled[0] open -> single liberty
    for (const p of fill) board.set(p.x, p.y, "w");

    // target must be in atari
    if (group(board, target.x, target.y).liberties.length !== 1) continue;
    // every white attacker must be settled (>= 2 liberties) so escape is by extension
    const whiteSettled = board
      .stones()
      .every((s) => s.c !== "w" || group(board, s.x, s.y).liberties.length >= 2);
    if (!whiteSettled) continue;

    const v = validateM(board, "b", escapeGoal(target), "any-valid");
    if (!v.valid) continue;

    const puzzle: Puzzle = {
      id: "tmp",
      topic: 4,
      rung,
      mode: "M",
      size,
      stones: board.stones(),
      toPlay: "b",
      prompt: "Black to play — save the stone in atari.",
      solution: { kind: "move", points: v.solution },
      marks: [{ x: target.x, y: target.y, kind: "mark" }],
    };

    const sig = JSON.stringify({ s: puzzle.stones, m: [target.x, target.y] });
    if (seen.has(sig)) continue;
    seen.add(sig);
    out.push(puzzle);
  }

  if (out.length < count) {
    throw new Error(`generateEscape: produced ${out.length}/${count} puzzles (rung ${rung}, size ${size})`);
  }
  return out;
}
