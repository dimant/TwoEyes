import { Board, Stone, Point } from "../../engine/board";
import { play } from "../../engine/rules";
import { group } from "../../engine/liberties";
import { validateM, GoalFn } from "../validate";
import { Rng, randint, shuffle } from "../../engine/rng";
import { Puzzle } from "../types";

const capturesAtLeast = (k: number): GoalFn => (_b, _m, _c, res) => res.captured.length >= k;

// Grow a connected white blob of `n` stones starting near the centre.
function growBlob(rng: Rng, size: number, n: number): Point[] | null {
  const start = { x: randint(rng, 1, size - 2), y: randint(rng, 1, size - 2) };
  const blob: Point[] = [start];
  const inBlob = (p: Point) => blob.some((q) => q.x === p.x && q.y === p.y);
  while (blob.length < n) {
    const frontier: Point[] = [];
    for (const s of blob)
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const p = { x: s.x + dx, y: s.y + dy };
        if (p.x >= 0 && p.y >= 0 && p.x < size && p.y < size && !inBlob(p)) frontier.push(p);
      }
    if (frontier.length === 0) return null;
    blob.push(shuffle(rng, frontier)[0] as Point);
  }
  return blob;
}

export function generateCapture(
  rng: Rng,
  opts: { topic: number; rung: number; minCaptured: number; size: number; count: number },
): Puzzle[] {
  const { topic, rung, minCaptured, size, count } = opts;
  const out: Puzzle[] = [];
  let guard = 0;

  while (out.length < count && guard++ < count * 500) {
    const n = minCaptured === 1 ? 1 : randint(rng, minCaptured, minCaptured + 1);
    const blob = growBlob(rng, size, n);
    if (!blob) continue;

    const board = new Board(size);
    for (const s of blob) board.set(s.x, s.y, "w");

    // outside liberties of the blob
    const libs: Point[] = group(board, blob[0]!.x, blob[0]!.y).liberties;
    if (libs.length < 2) continue; // need one to leave open

    const shuffled = shuffle(rng, libs);
    const leaveOpen = shuffled[0] as Point;
    const fill = shuffled.slice(1);
    for (const p of fill) board.set(p.x, p.y, "b");

    // black surrounding stones must not themselves be pre-captured / in atari-that-breaks-uniqueness
    const v = validateM(board, "b", capturesAtLeast(minCaptured), "unique");
    if (!v.valid) continue;

    const sol = v.solution[0] as Point;
    const res = play(board, sol.x, sol.y, "b");
    if (!res.ok || res.captured.length < minCaptured) continue;

    out.push({
      id: "tmp", topic, rung, mode: "M", size,
      stones: board.stones(), toPlay: "b",
      prompt: minCaptured >= 2 ? "Black to play — capture the group." : "Black to play — capture the stone.",
      solution: { kind: "move", points: [sol] },
      captured: res.captured,
    });
  }
  return out;
}
