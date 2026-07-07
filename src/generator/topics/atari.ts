import { Board, Point } from "../../engine/board";
import { play } from "../../engine/rules";
import { group } from "../../engine/liberties";
import { validateM, GoalFn } from "../validate";
import { Rng, randint, shuffle } from "../../engine/rng";
import { Puzzle } from "../types";

const capturesAtLeast = (k: number): GoalFn => (_b, _m, _c, res) => res.captured.length >= k;

type Region = "interior" | "edge" | "any";

function startCell(rng: Rng, size: number, region: Region): Point {
  if (region === "interior") {
    return { x: randint(rng, 1, size - 2), y: randint(rng, 1, size - 2) };
  }
  if (region === "edge") {
    const along = randint(rng, 0, size - 1);
    const side = randint(rng, 0, 3);
    if (side === 0) return { x: along, y: 0 };
    if (side === 1) return { x: along, y: size - 1 };
    if (side === 2) return { x: 0, y: along };
    return { x: size - 1, y: along };
  }
  return { x: randint(rng, 0, size - 1), y: randint(rng, 0, size - 1) };
}

// Grow a connected white blob of `n` stones from a region-seeded start.
function growBlob(rng: Rng, size: number, n: number, region: Region): Point[] | null {
  const start = startCell(rng, size, region);
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
  opts: {
    topic: number;
    rung: number;
    size: number;
    count: number;
    groupSize: { min: number; max: number };
    region: Region;
  },
): Puzzle[] {
  const { topic, rung, size, count, groupSize, region } = opts;
  const minCaptured = groupSize.min;
  const out: Puzzle[] = [];
  const seen = new Set<string>();
  let guard = 0;

  while (out.length < count && guard++ < count * 800) {
    const n = randint(rng, groupSize.min, groupSize.max);
    const blob = growBlob(rng, size, n, region);
    if (!blob) continue;

    const board = new Board(size);
    for (const s of blob) board.set(s.x, s.y, "w");

    const libs: Point[] = group(board, blob[0]!.x, blob[0]!.y).liberties;
    if (libs.length < 2) continue; // need one liberty to leave open

    const shuffled = shuffle(rng, libs);
    const fill = shuffled.slice(1); // leave shuffled[0] open
    for (const p of fill) board.set(p.x, p.y, "b");

    const v = validateM(board, "b", capturesAtLeast(minCaptured), "unique");
    if (!v.valid) continue;

    const sol = v.solution[0] as Point;
    const res = play(board, sol.x, sol.y, "b");
    if (!res.ok || res.captured.length < minCaptured) continue;

    const puzzle: Puzzle = {
      id: "tmp",
      topic,
      rung,
      mode: "M",
      size,
      stones: board.stones(),
      toPlay: "b",
      prompt: minCaptured >= 2 ? "Black to play — capture the group." : "Black to play — capture the stone.",
      solution: { kind: "move", points: [sol] },
      captured: res.captured,
    };

    const sig = JSON.stringify({ s: puzzle.stones, sol });
    if (seen.has(sig)) continue;
    seen.add(sig);
    out.push(puzzle);
  }

  if (out.length < count) {
    throw new Error(
      `generateCapture: produced ${out.length}/${count} puzzles (topic ${topic}, rung ${rung}, region ${region}, groupSize ${groupSize.min}-${groupSize.max}, size ${size})`,
    );
  }
  return out;
}
