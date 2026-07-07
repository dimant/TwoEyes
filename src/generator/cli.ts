import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { makeRng } from "../engine/rng";
import { generateLiberties } from "./topics/liberties";
import { generateCapture } from "./topics/atari";
import { assembleBank, writeBank } from "./bank";
import { Bank, Puzzle } from "./types";

const PER_RUNG = 20;
const SEED = 20260706;

// Curate a rung for a good learning flow: bucket by a difficulty key (liberty
// count for Q, board busyness for M), then round-robin the buckets in ascending
// order. The learner meets one of each difficulty right away (immediate variety)
// and simpler boards surface first. Deterministic — keeps the bank reproducible.
function curateRung(puzzles: Puzzle[]): Puzzle[] {
  const key = (p: Puzzle): number =>
    p.mode === "Q-count" && p.solution.kind === "value" ? p.solution.value : p.stones.length;
  const buckets = new Map<number, Puzzle[]>();
  for (const p of puzzles) {
    const k = key(p);
    (buckets.get(k) ?? buckets.set(k, []).get(k)!).push(p);
  }
  const keys = [...buckets.keys()].sort((a, b) => a - b);
  const out: Puzzle[] = [];
  for (let more = true; more; ) {
    more = false;
    for (const k of keys) {
      const b = buckets.get(k)!;
      if (b.length) { out.push(b.shift()!); more = true; }
    }
  }
  return out;
}

export function buildBank(seed: number): Bank {
  const rng = makeRng(seed);
  const groups: Puzzle[][] = [];

  // Topic 1 — liberties (Q): rung 1 open board, rung 2 under attack
  groups.push(curateRung(generateLiberties(rng, { rung: 1, size: 5, count: PER_RUNG })));
  groups.push(curateRung(generateLiberties(rng, { rung: 2, size: 5, count: PER_RUNG })));

  // Topic 2 — capture a single stone: rung 1 interior, rung 2 on the edge (roomy 7x7 frame)
  groups.push(curateRung(generateCapture(rng, { topic: 2, rung: 1, size: 7, count: PER_RUNG, groupSize: { min: 1, max: 1 }, region: "interior" })));
  groups.push(curateRung(generateCapture(rng, { topic: 2, rung: 2, size: 7, count: PER_RUNG, groupSize: { min: 1, max: 1 }, region: "edge" })));

  // Topic 3 — capture a group: rung 1 two stones, rung 2 three-four stones (roomy 7x7 frame)
  groups.push(curateRung(generateCapture(rng, { topic: 3, rung: 1, size: 7, count: PER_RUNG, groupSize: { min: 2, max: 2 }, region: "any" })));
  groups.push(curateRung(generateCapture(rng, { topic: 3, rung: 2, size: 7, count: PER_RUNG, groupSize: { min: 3, max: 4 }, region: "any" })));

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
