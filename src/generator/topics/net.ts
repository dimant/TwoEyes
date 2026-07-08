import { Board, Point } from "../../engine/board";
import { play } from "../../engine/rules";
import { group } from "../../engine/liberties";
import { capturedUnderBestPlay, captureLine } from "../reader";
import { Rng, randint, shuffle } from "../../engine/rng";
import { Puzzle } from "../types";
import { annotate, type PlayedMove } from "../payoff";

function nearby(size: number, t: Point): Point[] {
  const out: Point[] = [];
  for (let dy = -2; dy <= 2; dy++)
    for (let dx = -2; dx <= 2; dx++) {
      const x = t.x + dx, y = t.y + dy;
      if (x >= 0 && y >= 0 && x < size && y < size && !(dx === 0 && dy === 0)) out.push({ x, y });
    }
  return out;
}

export function generateNet(
  rng: Rng,
  opts: { rung: number; size: number; count: number; depth: number },
): Puzzle[] {
  const { rung, size, count, depth } = opts;
  const out: Puzzle[] = [];
  const seen = new Set<string>();
  let guard = 0;

  while (out.length < count && guard++ < count * 3000) {
    const board = new Board(size);
    const t: Point = { x: randint(rng, 1, size - 2), y: randint(rng, 1, size - 2) };
    board.set(t.x, t.y, "w");
    // 1–2 black wall stones adjacent to the target
    const nbrs = shuffle(rng, board.neighbors(t.x, t.y));
    const wallN = randint(rng, 1, 2);
    for (let i = 0; i < wallN; i++) board.set(nbrs[i]!.x, nbrs[i]!.y, "b");
    // extra black cloud nearby for enclosure — this is what makes nettable shapes common
    const cloud = shuffle(rng, nearby(size, t).filter((p) => board.get(p.x, p.y) === null));
    const extra = randint(rng, 1, 3);
    for (let i = 0; i < extra && i < cloud.length; i++) board.set(cloud[i]!.x, cloud[i]!.y, "b");
    const tl = group(board, t.x, t.y).liberties.length;
    if (tl < 2 || tl > 3) continue; // confined but not already atari
    if (board.stones().some((s) => s.c === "b" && group(board, s.x, s.y).liberties.length <= 1)) continue;
    // the base must be ALIVE at the bank's verification depth (8), not just the rung's search
    // depth — else a rung-1 net (searched at depth 4) could ship a base that's dead by depth 8.
    if (capturedUnderBestPlay(board, t, "w", 8)) continue;

    // find every nearby black move that nets
    const nets: Point[] = [];
    for (const P of nearby(size, t)) {
      if (board.get(P.x, P.y) !== null) continue;
      const res = play(board, P.x, P.y, "b");
      if (!res.ok || res.captured.length > 0) continue;
      if (group(res.board, t.x, t.y).liberties.length !== 2) continue; // must leave exactly 2 (a loose net)
      if (capturedUnderBestPlay(res.board, t, "w", depth)) nets.push(P);
    }
    if (nets.length === 0) continue;

    // Payoff: demonstrate the capture from the canonical (first) net point,
    // extracted at the bank's verification depth (8).
    const canonical = nets[0]!;
    const afterNet = play(board, canonical.x, canonical.y, "b");
    const tail = afterNet.ok ? captureLine(afterNet.board, t, "w", 8) : null;
    if (!tail) continue; // defensive — a verified net always yields a line
    const line: PlayedMove[] = [{ x: canonical.x, y: canonical.y, c: "b" }, ...tail];
    const puzzle: Puzzle = {
      id: "tmp", topic: 10, rung, mode: "M", size, stones: board.stones(), toPlay: "b",
      prompt: "Black to play — net the stone so it can't run.",
      solution: { kind: "move", points: nets },
      marks: [{ x: t.x, y: t.y, kind: "mark" }],
      payoff: annotate(size, board.stones(), line),
    };
    const sig = JSON.stringify({ s: puzzle.stones, m: [t.x, t.y] });
    if (seen.has(sig)) continue;
    seen.add(sig);
    out.push(puzzle);
  }
  if (out.length < count) {
    throw new Error(`generateNet: produced ${out.length}/${count} (rung ${rung}, size ${size}, depth ${depth})`);
  }
  return out;
}
