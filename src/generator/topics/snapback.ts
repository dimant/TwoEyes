import { Board, Point } from "../../engine/board";
import { play } from "../../engine/rules";
import { group } from "../../engine/liberties";
import { Rng, randint, shuffle } from "../../engine/rng";
import { Puzzle } from "../types";

// Black throws in at p. Returns how many white stones Black recaptures via the snapback (0 = no snapback).
export function snapbackWorks(board: Board, p: Point): { ok: boolean; recaptured: number } {
  const r1 = play(board, p.x, p.y, "b");
  if (!r1.ok || r1.captured.length > 0) return { ok: false, recaptured: 0 };
  const g = group(r1.board, p.x, p.y);
  if (g.liberties.length !== 1) return { ok: false, recaptured: 0 }; // throw-in must be self-atari
  const lib = g.liberties[0]!;
  // White captures the throw-in group by filling its last liberty
  const r2 = play(r1.board, lib.x, lib.y, "w");
  if (!r2.ok || r2.captured.length !== g.stones.length) return { ok: false, recaptured: 0 };
  // White's capturing stone must now be catchable: Black recaptures at p again
  const r3 = play(r2.board, p.x, p.y, "b");
  if (!r3.ok || r3.captured.length < 1) return { ok: false, recaptured: 0 };
  return { ok: true, recaptured: r3.captured.length };
}

// A snapback throw-in is always played next to the white group — scan only those points.
function whiteAdjacentEmpties(board: Board): Point[] {
  const out: Point[] = [];
  const seen = new Set<string>();
  for (const s of board.stones()) {
    if (s.c !== "w") continue;
    for (const n of board.neighbors(s.x, s.y)) {
      if (board.get(n.x, n.y) !== null) continue;
      const k = `${n.x},${n.y}`;
      if (!seen.has(k)) { seen.add(k); out.push(n); }
    }
  }
  return out;
}

export function generateSnapback(
  rng: Rng,
  opts: { rung: number; size: number; count: number; minRecapture: number },
): Puzzle[] {
  const { rung, size, count, minRecapture } = opts;
  const out: Puzzle[] = [];
  const seen = new Set<string>();
  let guard = 0;

  while (out.length < count && guard++ < count * 20000) {
    const board = new Board(size);
    // a white blob of 2–4 stones
    const c: Point = { x: randint(rng, 1, size - 2), y: randint(rng, 1, size - 2) };
    const wn = randint(rng, 2, 4);
    const whites: Point[] = [c];
    board.set(c.x, c.y, "w");
    let gu = 0;
    while (whites.length < wn && gu++ < 30) {
      const from = whites[randint(rng, 0, whites.length - 1)]!;
      const nb = shuffle(rng, board.neighbors(from.x, from.y)).find((q) => board.get(q.x, q.y) === null);
      if (nb) { board.set(nb.x, nb.y, "w"); whites.push(nb); }
    }
    // fill most of the white group's liberties with black, leaving 0–3 open (the false-eye shape)
    const wl = shuffle(rng, group(board, c.x, c.y).liberties);
    const fillK = randint(rng, Math.max(0, wl.length - 3), wl.length);
    for (let k = 0; k < fillK; k++) board.set(wl[k]!.x, wl[k]!.y, "b");
    // clean: black not in atari
    if (board.stones().some((s) => s.c === "b" && group(board, s.x, s.y).liberties.length <= 1)) continue;

    // collect EVERY working throw-in (any-valid) so the grader accepts all correct answers
    const throwins = whiteAdjacentEmpties(board).filter(
      (P) => snapbackWorks(board, P).recaptured >= minRecapture,
    );
    if (throwins.length === 0) continue;

    const puzzle: Puzzle = {
      id: "tmp", topic: 11, rung, mode: "M", size, stones: board.stones(), toPlay: "b",
      prompt: "Black to play — set up a snapback.",
      solution: { kind: "move", points: throwins },
    };
    const sig = JSON.stringify({ s: puzzle.stones });
    if (seen.has(sig)) continue;
    seen.add(sig);
    out.push(puzzle);
  }
  if (out.length < count) {
    throw new Error(`generateSnapback: produced ${out.length}/${count} (rung ${rung}, size ${size})`);
  }
  return out;
}
