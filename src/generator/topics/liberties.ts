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
  const seen = new Set<string>();
  let guard = 0;

  while (out.length < count && guard++ < count * 500) {
    const board = new Board(size);
    // Marked stone anywhere on the board (both rungs) — teaches edge/corner directly.
    const mark: Point = { x: randint(rng, 0, size - 1), y: randint(rng, 0, size - 1) };
    board.set(mark.x, mark.y, "b");

    // Rung 2: put the stone "under attack" with 1..3 enemy contacts (can reach 1 liberty).
    if (rung >= 2) {
      const contacts = shuffle(rng, board.neighbors(mark.x, mark.y));
      const k = randint(rng, 1, Math.min(3, contacts.length));
      for (let i = 0; i < k; i++) board.set(contacts[i]!.x, contacts[i]!.y, "w");
    }

    const value = libertyCount(board, mark.x, mark.y);
    if (value < 1 || value > 4) continue;

    const puzzle: Puzzle = {
      id: "tmp",
      topic: 1,
      rung,
      mode: "Q-count",
      size,
      stones: board.stones(),
      toPlay: "b",
      prompt: "How many liberties does the marked stone have?",
      solution: { kind: "value", value },
      marks: [{ x: mark.x, y: mark.y, kind: "mark" }],
    };

    const sig = JSON.stringify({ s: puzzle.stones, v: value });
    if (seen.has(sig)) continue;
    seen.add(sig);
    out.push(puzzle);
  }

  if (out.length < count) {
    throw new Error(
      `generateLiberties: produced ${out.length}/${count} puzzles (rung ${rung}, size ${size})`,
    );
  }
  return out;
}
