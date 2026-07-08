import { Board, Point } from "../../engine/board";
import { group } from "../../engine/liberties";
import { capturedUnderBestPlay, captureLine } from "../reader";
import { annotate } from "../payoff";
import { Rng, randint, shuffle } from "../../engine/rng";
import { Puzzle } from "../types";

const DEPTH = 12;

// The single White stone whose removal makes the ladder work — the breaker to highlight.
// Returns null if no single stone is the culprit (the escape is not cleanly attributable).
export function findBreaker(board: Board, target: Point): Point | null {
  for (const s of board.stones()) {
    if (s.c !== "w" || (s.x === target.x && s.y === target.y)) continue;
    const without = Board.from(board.size, board.stones().filter((q) => !(q.x === s.x && q.y === s.y)));
    if (capturedUnderBestPlay(without, target, "b", DEPTH)) return { x: s.x, y: s.y };
  }
  return null;
}

// A clean base ladder shape: a 2-liberty White target confined by Black, with an optional diagonal
// wall stone. (Mirrors the shape construction in topics/ladder.ts; duplicated on purpose so the two
// generators stay independent and topic 8's committed bank is never perturbed by a shared refactor.)
function baseShape(rng: Rng, size: number): { board: Board; target: Point } | null {
  const board = new Board(size);
  const target: Point = { x: randint(rng, 1, size - 2), y: randint(rng, 1, size - 2) };
  board.set(target.x, target.y, "w");
  const nbrs = shuffle(rng, board.neighbors(target.x, target.y));
  for (let i = 0; i < 2; i++) board.set(nbrs[i]!.x, nbrs[i]!.y, "b");
  const diags = shuffle(rng, [
    { x: target.x + 1, y: target.y + 1 }, { x: target.x - 1, y: target.y + 1 },
    { x: target.x + 1, y: target.y - 1 }, { x: target.x - 1, y: target.y - 1 },
  ].filter((p) => p.x >= 0 && p.y >= 0 && p.x < size && p.y < size));
  if (diags.length && board.get(diags[0]!.x, diags[0]!.y) === null) board.set(diags[0]!.x, diags[0]!.y, "b");
  if (group(board, target.x, target.y).liberties.length !== 2) return null;
  if (board.stones().some((s) => s.c === "b" && group(board, s.x, s.y).liberties.length <= 1)) return null;
  return { board, target };
}

function allEmpty(board: Board): Point[] {
  const out: Point[] = [];
  for (let y = 0; y < board.size; y++) for (let x = 0; x < board.size; x++) if (board.get(x, y) === null) out.push({ x, y });
  return out;
}

export function generateLadderBreaker(rng: Rng, opts: { rung: number; size: number; count: number }): Puzzle[] {
  const { rung, size, count } = opts;
  const out: Puzzle[] = [];
  const seen = new Set<string>();
  const need = { caught: Math.ceil(count / 2), escapes: Math.floor(count / 2) };
  const have = { caught: 0, escapes: 0 };
  let guard = 0;

  while (out.length < count && guard++ < count * 6000) {
    const wantEscapes = have.escapes < need.escapes && (have.caught >= need.caught || guard % 2 === 0);
    const base = baseShape(rng, size);
    if (!base) continue;
    const { board, target } = base;
    if (!capturedUnderBestPlay(board, target, "b", DEPTH)) continue; // both classes start from a working ladder

    let puzzle: Puzzle | null = null;
    if (!wantEscapes) {
      if (have.caught >= need.caught) continue;
      const line = captureLine(board, target, "b", DEPTH);
      if (!line || line.filter((m) => m.c === "b").length < 2) continue;
      puzzle = {
        id: "tmp", topic: 9, rung, mode: "Q-binary", size, stones: board.stones(), toPlay: "b",
        prompt: "If Black ladders the marked stone, is it caught?",
        solution: { kind: "choice", id: "caught" },
        marks: [{ x: target.x, y: target.y, kind: "mark" }],
        payoff: annotate(size, board.stones(), line),
      };
    } else {
      if (have.escapes >= need.escapes) continue;
      let breaker: Point | null = null;
      for (const bp of shuffle(rng, allEmpty(board)).filter((p) => Math.abs(p.x - target.x) + Math.abs(p.y - target.y) >= 2)) {
        board.set(bp.x, bp.y, "w");
        const clean = group(board, bp.x, bp.y).liberties.length >= 2 &&
          !board.stones().some((s) => s.c === "b" && group(board, s.x, s.y).liberties.length <= 1);
        if (clean && !capturedUnderBestPlay(board, target, "b", DEPTH)) {
          const found = findBreaker(board, target);
          if (found) { breaker = found; break; }
        }
        board.set(bp.x, bp.y, null);
      }
      if (!breaker) continue;
      puzzle = {
        id: "tmp", topic: 9, rung, mode: "Q-binary", size, stones: board.stones(), toPlay: "b",
        prompt: "If Black ladders the marked stone, is it caught?",
        solution: { kind: "choice", id: "escapes" },
        marks: [{ x: target.x, y: target.y, kind: "mark" }],
        breaker,
      };
    }

    const sig = JSON.stringify({ s: puzzle.stones });
    if (seen.has(sig)) continue;
    seen.add(sig);
    if (puzzle.solution.kind === "choice") have[puzzle.solution.id as "caught" | "escapes"]++;
    out.push(puzzle);
  }
  if (out.length < count) {
    throw new Error(`generateLadderBreaker: produced ${out.length}/${count} (rung ${rung}, size ${size})`);
  }
  return out;
}
