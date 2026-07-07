import { Board, Point } from "../../engine/board";
import { libertyCount } from "../../engine/liberties";
import { Rng, randint, shuffle } from "../../engine/rng";
import { Puzzle } from "../types";

export function generateLiberties(
  rng: Rng,
  opts: { rung: number; size: number; count: number },
): Puzzle[] {
  const { rung, size, count } = opts;
  const out: Puzzle[] = [];
  let guard = 0;

  while (out.length < count && guard++ < count * 500) {
    const board = new Board(size);
    // rung 1: centre; rung >=2: allow edge/corner placement
    const edgey = rung >= 2;
    const lo = edgey ? 0 : 1, hi = edgey ? size - 1 : size - 2;
    const mark: Point = { x: randint(rng, lo, hi), y: randint(rng, lo, hi) };
    board.set(mark.x, mark.y, "b");

    // rung >=3: add up to two enemy contacts to vary the count
    if (rung >= 3) {
      const contacts = shuffle(rng, board.neighbors(mark.x, mark.y));
      const k = randint(rng, 1, Math.min(2, contacts.length));
      for (let i = 0; i < k; i++) board.set(contacts[i]!.x, contacts[i]!.y, "w");
    }

    const value = libertyCount(board, mark.x, mark.y);
    if (value < 1 || value > 4) continue;

    out.push({
      id: "tmp", topic: 1, rung, mode: "Q-count", size,
      stones: board.stones(), toPlay: "b",
      prompt: "How many liberties does the marked stone have?",
      solution: { kind: "value", value },
      marks: [{ x: mark.x, y: mark.y, kind: "mark" }],
    });
  }
  if (out.length < count) {
    throw new Error(
      `generateLiberties: produced ${out.length}/${count} puzzles (rung ${rung}, size ${size})`,
    );
  }
  return out;
}
