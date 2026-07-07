import { Board, Point } from "../../engine/board";
import { play } from "../../engine/rules";
import { group } from "../../engine/liberties";
import { validateM, GoalFn } from "../validate";
import { Rng, randint, shuffle } from "../../engine/rng";
import { Puzzle } from "../types";

function blackGroupCount(board: Board): number {
  const seen = new Set<string>();
  let n = 0;
  for (const s of board.stones()) {
    if (s.c !== "b") continue;
    const key = group(board, s.x, s.y).stones.map((q) => `${q.x},${q.y}`).sort().join(";");
    if (!seen.has(key)) { seen.add(key); n++; }
  }
  return n;
}

// Goal: playing here leaves Black as a single connected group.
const connectsGoal: GoalFn = (_before, _move, _c, res) => blackGroupCount(res.board) === 1;

export function generateConnect(rng: Rng, opts: { size: number; count: number }): Puzzle[] {
  const { size, count } = opts;
  const out: Puzzle[] = [];
  const seen = new Set<string>();
  let guard = 0;
  const DIRS: [number, number][] = [[1, 0], [0, 1]];

  while (out.length < count && guard++ < count * 800) {
    const board = new Board(size);
    // two black stones two apart along a random axis, gap in the middle
    const [dx, dy] = shuffle(rng, DIRS)[0]!;
    const a: Point = { x: randint(rng, 0, size - 1 - 2 * dx), y: randint(rng, 0, size - 1 - 2 * dy) };
    const b: Point = { x: a.x + 2 * dx, y: a.y + 2 * dy };
    const mid: Point = { x: a.x + dx, y: a.y + dy };
    board.set(a.x, a.y, "b");
    board.set(b.x, b.y, "b");
    if (blackGroupCount(board) !== 2) continue; // must start as two groups

    const v = validateM(board, "b", connectsGoal, "unique");
    if (!v.valid) continue;
    const sol = v.solution[0]!;
    if (sol.x !== mid.x || sol.y !== mid.y) continue; // the connect is the middle point

    const puzzle: Puzzle = {
      id: "tmp", topic: 7, rung: 1, mode: "M", size, stones: board.stones(), toPlay: "b",
      prompt: "Black to play — connect your stones.",
      solution: { kind: "move", points: [sol] },
    };
    const sig = JSON.stringify({ s: puzzle.stones, sol });
    if (seen.has(sig)) continue;
    seen.add(sig);
    out.push(puzzle);
  }
  if (out.length < count) throw new Error(`generateConnect: ${out.length}/${count}`);
  return out;
}

const capturesGoal: GoalFn = (_b, _m, _c, res) => res.captured.length >= 1;

export function generateCaptureCutter(rng: Rng, opts: { size: number; count: number }): Puzzle[] {
  const { size, count } = opts;
  const out: Puzzle[] = [];
  const seen = new Set<string>();
  let guard = 0;

  while (out.length < count && guard++ < count * 1000) {
    // a lone white cutting stone in atari between black stones
    const board = new Board(size);
    const w: Point = { x: randint(rng, 1, size - 2), y: randint(rng, 1, size - 2) };
    board.set(w.x, w.y, "w");
    const nbrs = shuffle(rng, board.neighbors(w.x, w.y));
    // fill all but one neighbour with black -> white in atari
    for (let i = 0; i < nbrs.length - 1; i++) board.set(nbrs[i]!.x, nbrs[i]!.y, "b");
    if (group(board, w.x, w.y).liberties.length !== 1) continue;
    // clean: black stones not themselves in atari
    if (board.stones().some((s) => s.c === "b" && group(board, s.x, s.y).liberties.length <= 1)) continue;
    const v = validateM(board, "b", capturesGoal, "unique");
    if (!v.valid) continue;
    const sol = v.solution[0]!;
    const res = play(board, sol.x, sol.y, "b");
    if (!res.ok || res.captured.length < 1) continue;

    const puzzle: Puzzle = {
      id: "tmp", topic: 7, rung: 2, mode: "M", size, stones: board.stones(), toPlay: "b",
      prompt: "Black to play — capture the cutting stone.",
      solution: { kind: "move", points: [sol] }, captured: res.captured,
    };
    const sig = JSON.stringify({ s: puzzle.stones, sol });
    if (seen.has(sig)) continue;
    seen.add(sig);
    out.push(puzzle);
  }
  if (out.length < count) throw new Error(`generateCaptureCutter: ${out.length}/${count}`);
  return out;
}
