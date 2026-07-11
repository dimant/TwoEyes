import { Board, Point } from "../../engine/board";
import { group } from "../../engine/liberties";
import { play } from "../../engine/rules";
import { validateM, GoalFn } from "../validate";
import { Rng, shuffle, randint } from "../../engine/rng";
import { Region, startCell, growBlob } from "../geometry";
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

// --- Phase 7 enrichment ------------------------------------------------------
// generateEscape (above) is FROZEN: it is retained only as an RNG spacer in
// buildBank so that topics generated after Topic 4 keep their committed puzzles.
// The two generators below produce the real, enriched Topic 4 content and are
// invoked from buildBank with their own seed.

export function generateEscapeRun(
  rng: Rng,
  opts: { rung: number; size: number; count: number; region: Region; maxGroup: number },
): Puzzle[] {
  const { rung, size, count, region, maxGroup } = opts;
  const out: Puzzle[] = [];
  const seen = new Set<string>();
  let guard = 0;

  while (out.length < count && guard++ < count * 2000) {
    const k = randint(rng, 1, maxGroup);
    const blob = growBlob(rng, size, k, region);
    if (!blob) continue;

    const board = new Board(size);
    for (const p of blob) board.set(p.x, p.y, "b");
    const rep = blob[0]!;

    // Reduce the whole black group to a single liberty (atari): fill all but one
    // of its liberties with white; the point left open is the escape point.
    const libs = group(board, rep.x, rep.y).liberties;
    if (libs.length < 2) continue; // need one to fill and one to leave open
    const shuffled = shuffle(rng, libs);
    for (const p of shuffled.slice(1)) board.set(p.x, p.y, "w");
    if (group(board, rep.x, rep.y).liberties.length !== 1) continue;

    // Pure extension only: every white attacker must be settled (>= 2 liberties),
    // so no black move captures white (capture-to-escape is rung 2's job).
    const whiteSettled = board
      .stones()
      .every((s) => s.c !== "w" || group(board, s.x, s.y).liberties.length >= 2);
    if (!whiteSettled) continue;

    const v = validateM(board, "b", escapeGoal(rep), "any-valid");
    if (!v.valid) continue;

    const marks = blob.map((p) => ({ x: p.x, y: p.y, kind: "mark" as const }));
    const puzzle: Puzzle = {
      id: "tmp", topic: 4, rung, mode: "M", size,
      stones: board.stones(), toPlay: "b",
      prompt: "Black to play — save your group.",
      solution: { kind: "move", points: v.solution },
      marks,
    };

    const sig = JSON.stringify({ s: puzzle.stones, sol: v.solution, m: marks });
    if (seen.has(sig)) continue;
    seen.add(sig);
    out.push(puzzle);
  }

  if (out.length < count) {
    throw new Error(`generateEscapeRun: produced ${out.length}/${count} puzzles (rung ${rung}, size ${size})`);
  }
  return out;
}
