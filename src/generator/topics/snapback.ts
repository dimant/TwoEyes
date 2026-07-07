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

export function generateSnapback(
  rng: Rng,
  opts: { rung: number; size: number; count: number; minRecapture: number },
): Puzzle[] {
  const { rung, size, count, minRecapture } = opts;
  const out: Puzzle[] = [];
  const seen = new Set<string>();
  let guard = 0;

  while (out.length < count && guard++ < count * 8000) {
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

    // search every empty point for a working throw-in
    let throwin: Point | null = null;
    for (let y = 0; y < size && !throwin; y++)
      for (let x = 0; x < size; x++) {
        if (board.get(x, y) !== null) continue;
        if (snapbackWorks(board, { x, y }).recaptured >= minRecapture) { throwin = { x, y }; break; }
      }
    if (!throwin) continue;

    const puzzle: Puzzle = {
      id: "tmp", topic: 11, rung, mode: "M", size, stones: board.stones(), toPlay: "b",
      prompt: "Black to play — set up a snapback.",
      solution: { kind: "move", points: [throwin] },
    };
    const sig = JSON.stringify({ s: puzzle.stones, sol: throwin });
    if (seen.has(sig)) continue;
    seen.add(sig);
    out.push(puzzle);
  }
  if (out.length < count) {
    throw new Error(`generateSnapback: produced ${out.length}/${count} (rung ${rung}, size ${size})`);
  }
  return out;
}
