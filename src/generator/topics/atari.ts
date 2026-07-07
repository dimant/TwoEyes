import { Board, Point } from "../../engine/board";
import { play } from "../../engine/rules";
import { group } from "../../engine/liberties";
import { validateM, GoalFn } from "../validate";
import { Rng, randint, shuffle } from "../../engine/rng";
import { Region, growBlob } from "../geometry";
import { Puzzle } from "../types";

const capturesAtLeast = (k: number): GoalFn => (_b, _m, _c, res) => res.captured.length >= k;

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

    // Clean shape: reject if any surrounding black stone is itself in atari in the
    // problem position — a beginner shouldn't see their own helper stone one move
    // from capture next to the target.
    const blackInAtari = board
      .stones()
      .some((st) => st.c === "b" && group(board, st.x, st.y).liberties.length <= 1);
    if (blackInAtari) continue;

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
