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

// Distinct white groups adjacent to any stone of `blob`, one representative
// point per group (deduped by the group's canonical stone set).
function adjacentWhiteGroups(board: Board, blob: Point[]): Point[] {
  const reps: Point[] = [];
  const seen = new Set<string>();
  for (const s of blob) {
    for (const n of board.neighbors(s.x, s.y)) {
      if (board.get(n.x, n.y) !== "w") continue;
      const g = group(board, n.x, n.y);
      const key = g.stones.map((p) => `${p.x},${p.y}`).sort().join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      reps.push({ x: n.x, y: n.y });
    }
  }
  return reps;
}

// A directly-constructed position is legal only if no group already has zero
// liberties. (Atari groups — exactly one liberty — are fine.)
function allGroupsAlive(board: Board): boolean {
  return board.stones().every((s) => group(board, s.x, s.y).liberties.length >= 1);
}

export function generateEscapeCapture(
  rng: Rng,
  opts: { rung: number; size: number; count: number; region: Region },
): Puzzle[] {
  const { rung, size, count, region } = opts;
  const out: Puzzle[] = [];
  const seen = new Set<string>();
  let guard = 0;

  while (out.length < count && guard++ < count * 4000) {
    const k = randint(rng, 1, 2);
    const blob = growBlob(rng, size, k, region);
    if (!blob) continue;

    const board = new Board(size);
    for (const p of blob) board.set(p.x, p.y, "b");
    const rep = blob[0]!;

    // Atari the black group at a single liberty L.
    const libsB = group(board, rep.x, rep.y).liberties;
    if (libsB.length < 2) continue;
    const shuffledB = shuffle(rng, libsB);
    const L = shuffledB[0]!;
    for (const p of shuffledB.slice(1)) board.set(p.x, p.y, "w");
    if (group(board, rep.x, rep.y).liberties.length !== 1) continue;

    // Put one adjacent white group into atari at a point C != L by filling its
    // other liberties with black helpers. Capturing it (at C) must free Black,
    // while extending at L must not.
    let built = false;
    for (const wg of shuffle(rng, adjacentWhiteGroups(board, blob))) {
      const wlibs = group(board, wg.x, wg.y).liberties;
      // If L is one of this group's liberties we cannot reduce it to a single
      // non-L liberty without touching L (Black's escape point) — skip it.
      if (wlibs.some((p) => p.x === L.x && p.y === L.y)) continue;
      if (wlibs.length < 1) continue;

      const trial = board.clone();
      const shuffledW = shuffle(rng, wlibs);
      // Leave shuffledW[0] = C open; fill the rest with black helpers.
      for (const p of shuffledW.slice(1)) trial.set(p.x, p.y, "b");

      if (group(trial, wg.x, wg.y).liberties.length !== 1) continue; // white now in atari at C
      if (group(trial, rep.x, rep.y).liberties.length !== 1) continue; // black still in atari at L
      if (!allGroupsAlive(trial)) continue; // legal position

      const v = validateM(trial, "b", escapeGoal(rep), "any-valid");
      if (!v.valid) continue;
      // Discriminator: plain extension at L must NOT be an escape.
      if (v.solution.some((p) => p.x === L.x && p.y === L.y)) continue;
      // Every escaping move must capture white.
      const allCaptures = v.solution.every((mv) => play(trial, mv.x, mv.y, "b").captured.length > 0);
      if (!allCaptures) continue;

      const marks = blob.map((p) => ({ x: p.x, y: p.y, kind: "mark" as const }));
      const puzzle: Puzzle = {
        id: "tmp", topic: 4, rung, mode: "M", size,
        stones: trial.stones(), toPlay: "b",
        prompt: "Black to play — save your group.",
        solution: { kind: "move", points: v.solution },
        marks,
      };
      const sig = JSON.stringify({ s: puzzle.stones, sol: v.solution, m: marks });
      if (seen.has(sig)) continue;
      seen.add(sig);
      out.push(puzzle);
      built = true;
      break;
    }
    if (!built) continue;
  }

  if (out.length < count) {
    throw new Error(`generateEscapeCapture: produced ${out.length}/${count} puzzles (rung ${rung}, size ${size})`);
  }
  return out;
}
