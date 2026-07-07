import { Board, Point } from "../../engine/board";
import { group } from "../../engine/liberties";
import { validateM, GoalFn } from "../validate";
import { Rng, shuffle } from "../../engine/rng";
import { startCell } from "../geometry";
import { Puzzle } from "../types";

// After the move, >= 2 distinct white neighbour groups have exactly one liberty,
// and nothing was captured.
const doubleAtariGoal: GoalFn = (_before, move, _color, res) => {
  if (res.captured.length > 0) return false;
  const seen = new Set<string>();
  let count = 0;
  for (const n of res.board.neighbors(move.x, move.y)) {
    if (res.board.get(n.x, n.y) !== "w") continue;
    const g = group(res.board, n.x, n.y);
    const key = g.stones.map((s) => `${s.x},${s.y}`).sort().join(";");
    if (seen.has(key)) continue;
    seen.add(key);
    if (g.liberties.length === 1) count++;
  }
  return count >= 2;
};

export function generateDoubleAtari(
  rng: Rng,
  opts: { rung: number; size: number; count: number },
): Puzzle[] {
  const { rung, size, count } = opts;
  const out: Puzzle[] = [];
  const seen = new Set<string>();
  let guard = 0;

  while (out.length < count && guard++ < count * 1200) {
    const p = startCell(rng, size, "interior");
    const board = new Board(size);
    const dirs = shuffle(rng, board.neighbors(p.x, p.y));
    if (dirs.length < 2) continue;
    const w0 = dirs[0]!;
    const w1 = dirs[1]!;
    board.set(w0.x, w0.y, "w");
    board.set(w1.x, w1.y, "w");
    const whites = [w0, w1];

    // Give each white exactly two liberties: P plus one kept escape; fill the rest with black.
    let ok = true;
    for (const w of whites) {
      const others = board
        .neighbors(w.x, w.y)
        .filter((q) => board.get(q.x, q.y) === null && !(q.x === p.x && q.y === p.y));
      if (others.length < 1) { ok = false; break; }
      const keep = shuffle(rng, others);
      for (let i = 1; i < keep.length; i++) board.set(keep[i]!.x, keep[i]!.y, "b");
    }
    if (!ok) continue;
    if (whites.some((w) => group(board, w.x, w.y).liberties.length !== 2)) continue;

    const v = validateM(board, "b", doubleAtariGoal, "unique");
    if (!v.valid) continue;
    // clean shape: helper black stones must be settled
    if (board.stones().some((s) => s.c === "b" && group(board, s.x, s.y).liberties.length <= 1)) continue;

    const move = v.solution[0]!;
    const puzzle: Puzzle = {
      id: "tmp",
      topic: 6,
      rung,
      mode: "M",
      size,
      stones: board.stones(),
      toPlay: "b",
      prompt: "Black to play — atari two stones at once.",
      solution: { kind: "move", points: [move] },
      ataris: whites.map((w) => ({ x: w.x, y: w.y })),
    };

    const sig = JSON.stringify({ s: puzzle.stones, sol: move });
    if (seen.has(sig)) continue;
    seen.add(sig);
    out.push(puzzle);
  }

  if (out.length < count) {
    throw new Error(`generateDoubleAtari: produced ${out.length}/${count} puzzles (rung ${rung}, size ${size})`);
  }
  return out;
}
