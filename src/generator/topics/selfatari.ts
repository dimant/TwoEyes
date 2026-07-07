import { Board, Point } from "../../engine/board";
import { play } from "../../engine/rules";
import { group } from "../../engine/liberties";
import { Rng, shuffle } from "../../engine/rng";
import { Region, startCell } from "../geometry";
import { Puzzle } from "../types";

export function isSelfAtari(board: Board, cand: Point): boolean {
  const res = play(board, cand.x, cand.y, "b");
  if (!res.ok) return true; // suicide / illegal -> definitely "don't play here"
  if (res.captured.length > 0) return false; // capturing is fine
  return group(res.board, cand.x, cand.y).liberties.length <= 1;
}

function build(rng: Rng, size: number, region: Region, wantSelfAtari: boolean): { board: Board; cand: Point } | null {
  const cand = startCell(rng, size, region);
  const board = new Board(size);
  const nbrs = shuffle(rng, board.neighbors(cand.x, cand.y));
  const deg = nbrs.length;
  if (deg < 3) return null; // skip corners: a "safe" corner case has no tension to judge
  // self-atari: fill all-but-one neighbour (candidate ends on 1 liberty).
  // safe: fill all-but-two (candidate ends on exactly 2 liberties) — one step from self-atari,
  // so every puzzle is a real "1 vs 2 liberties" judgment rather than a context-free point.
  const whiteCount = wantSelfAtari ? deg - 1 : deg - 2;
  for (let i = 0; i < whiteCount; i++) board.set(nbrs[i]!.x, nbrs[i]!.y, "w");
  return { board, cand };
}

export function generateSelfAtari(
  rng: Rng,
  opts: { rung: number; size: number; count: number; region: Region },
): Puzzle[] {
  const { rung, size, count, region } = opts;
  const out: Puzzle[] = [];
  const seen = new Set<string>();
  const need = { "self-atari": Math.ceil(count / 2), safe: Math.floor(count / 2) };
  const have = { "self-atari": 0, safe: 0 };
  let guard = 0;

  while (out.length < count && guard++ < count * 800) {
    const wantSelfAtari = have["self-atari"] < need["self-atari"] &&
      (have["safe"] >= need["safe"] || (guard % 2 === 0));
    const built = build(rng, size, region, wantSelfAtari);
    if (!built) continue;
    const { board, cand } = built;

    // every white stone must be settled (>= 2 liberties): keeps shapes clean and
    // guarantees playing `cand` captures nothing.
    const whiteSettled = board
      .stones()
      .every((s) => s.c !== "w" || group(board, s.x, s.y).liberties.length >= 2);
    if (!whiteSettled) continue;

    const truth = isSelfAtari(board, cand) ? "self-atari" : "safe";
    if (have[truth] >= need[truth]) continue;

    const puzzle: Puzzle = {
      id: "tmp",
      topic: 5,
      rung,
      mode: "Q-binary",
      size,
      stones: board.stones(),
      toPlay: "b",
      prompt: "If Black plays the marked point, is it self-atari?",
      solution: { kind: "choice", id: truth },
      marks: [{ x: cand.x, y: cand.y, kind: "target" }],
    };

    const sig = JSON.stringify({ s: puzzle.stones, c: [cand.x, cand.y] });
    if (seen.has(sig)) continue;
    seen.add(sig);
    have[truth]++;
    out.push(puzzle);
  }

  if (out.length < count) {
    throw new Error(`generateSelfAtari: produced ${out.length}/${count} puzzles (rung ${rung}, size ${size})`);
  }
  return out;
}
