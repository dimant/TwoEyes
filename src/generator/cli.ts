import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { makeRng } from "../engine/rng";
import { generateLiberties } from "./topics/liberties";
import { generateCapture } from "./topics/atari";
import { assembleBank, writeBank } from "./bank";
import { Bank, Puzzle } from "./types";

const PER_RUNG = 20;
const SEED = 20260706;

export function buildBank(seed: number): Bank {
  const rng = makeRng(seed);
  const groups: Puzzle[][] = [];

  // Topic 1 — liberties (Q): rung 1 centre, rung 2 edge/corner
  for (const rung of [1, 2])
    groups.push(generateLiberties(rng, { rung, size: 5, count: PER_RUNG }));

  // Topic 2 — atari & capture (M): single stone
  for (const rung of [1, 2])
    groups.push(generateCapture(rng, { topic: 2, rung, minCaptured: 1, size: 5, count: PER_RUNG }));

  // Topic 3 — capturing multiple (M): ≥2 stones
  for (const rung of [1, 2])
    groups.push(generateCapture(rng, { topic: 3, rung, minCaptured: 2, size: 5, count: PER_RUNG }));

  return assembleBank(seed, groups);
}

function main(): void {
  const here = dirname(fileURLToPath(import.meta.url));
  const outPath = join(here, "..", "bank", "bank.json");
  const bank = buildBank(SEED);
  writeBank(bank, outPath);
  console.log(`Wrote ${bank.puzzles.length} puzzles to ${outPath}`);
}

// run only when invoked directly (not when imported by tests)
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
