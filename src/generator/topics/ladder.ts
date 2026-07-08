import { Board, Point } from "../../engine/board";
import { play } from "../../engine/rules";
import { group } from "../../engine/liberties";
import { capturedUnderBestPlay, captureLine } from "../reader";
import { annotate } from "../payoff";
import { Rng, randint, shuffle } from "../../engine/rng";
import { Puzzle } from "../types";

// Target liberties where Black's atari leaves the target in atari (1 liberty) and
// leads to capture under best play — the "winning opening" ataris of the ladder.
export function winningOpenings(board: Board, t: Point): Point[] {
  const out: Point[] = [];
  for (const m of group(board, t.x, t.y).liberties) {
    const r = play(board, m.x, m.y, "b");
    if (!r.ok) continue;
    if (r.board.get(t.x, t.y) === null) { out.push(m); continue; } // immediate capture
    if (group(r.board, t.x, t.y).liberties.length !== 1) continue;  // must be an atari
    if (capturedUnderBestPlay(r.board, t, "w", 8)) out.push(m);
  }
  return out;
}

export function generateLadder(
  rng: Rng,
  opts: { rung: number; size: number; count: number; requireFailingAlt: boolean },
): Puzzle[] {
  const { rung, size, count, requireFailingAlt } = opts;
  const out: Puzzle[] = [];
  const seen = new Set<string>();
  let guard = 0;

  while (out.length < count && guard++ < count * 5000) {
    const board = new Board(size);
    const t: Point = { x: randint(rng, 1, size - 2), y: randint(rng, 1, size - 2) };
    board.set(t.x, t.y, "w");
    // fill two of the four neighbours with Black -> leave exactly 2 liberties
    const nbrs = shuffle(rng, board.neighbors(t.x, t.y));
    for (let i = 0; i < 2; i++) board.set(nbrs[i]!.x, nbrs[i]!.y, "b");
    // optional diagonal "wall" stone that channels the run
    const diags = shuffle(rng, [
      { x: t.x + 1, y: t.y + 1 }, { x: t.x - 1, y: t.y + 1 },
      { x: t.x + 1, y: t.y - 1 }, { x: t.x - 1, y: t.y - 1 },
    ].filter((p) => p.x >= 0 && p.y >= 0 && p.x < size && p.y < size));
    if (diags.length && board.get(diags[0]!.x, diags[0]!.y) === null) board.set(diags[0]!.x, diags[0]!.y, "b");

    const tg = group(board, t.x, t.y);
    if (tg.liberties.length !== 2) continue;
    // clean shape: no Black helper stone is itself in atari
    if (board.stones().some((s) => s.c === "b" && group(board, s.x, s.y).liberties.length <= 1)) continue;

    const openings = winningOpenings(board, t);
    if (openings.length !== 1) continue; // UNIQUE winning opening atari
    const opening = openings[0]!;

    if (requireFailingAlt) {
      // the OTHER liberty must be a legal atari that does NOT capture (a tempting wrong turn)
      const other = tg.liberties.find((l) => !(l.x === opening.x && l.y === opening.y));
      if (!other) continue;
      const r = play(board, other.x, other.y, "b");
      if (!r.ok) continue;
      if (group(r.board, t.x, t.y).liberties.length !== 1) continue; // must be an atari
      if (capturedUnderBestPlay(r.board, t, "w", 8)) continue;        // must escape (fail)
    }

    const line = captureLine(board, t, "b", 8);
    if (!line) continue;
    if (line.filter((m) => m.c === "b").length < 2) continue; // a real multi-step ladder
    const payoff = annotate(size, board.stones(), line);

    const puzzle: Puzzle = {
      id: "tmp", topic: 8, rung, mode: "M", size, stones: board.stones(), toPlay: "b",
      prompt: "Black to play — start the ladder to catch the stone.",
      solution: { kind: "move", points: [opening] },
      marks: [{ x: t.x, y: t.y, kind: "mark" }],
      payoff,
    };
    const sig = JSON.stringify({ s: puzzle.stones, m: [t.x, t.y] });
    if (seen.has(sig)) continue;
    seen.add(sig);
    out.push(puzzle);
  }

  if (out.length < count) {
    throw new Error(`generateLadder: produced ${out.length}/${count} (rung ${rung}, size ${size})`);
  }
  return out;
}
