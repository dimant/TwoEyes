import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { makeRng } from "../engine/rng";
import { generateLiberties } from "./topics/liberties";
import { generateCapture } from "./topics/atari";
import { generateEscape, generateEscapeRun, generateEscapeCapture } from "./topics/escape";
import { generateSelfAtari } from "./topics/selfatari";
import { generateDoubleAtari } from "./topics/doubleatari";
import { generateConnect, generateCaptureCutter } from "./topics/connectcut";
import { generateNet } from "./topics/net";
import { generateSnapback } from "./topics/snapback";
import { generateLadder } from "./topics/ladder";
import { generateLadderBreaker } from "./topics/ladderbreaker";
import { assembleBank, writeBank } from "./bank";
import { Bank, Puzzle } from "./types";

const PER_RUNG = 20;
const SEED = 20260706;

// Curate a rung for a good learning flow: bucket by a difficulty key (liberty
// count for Q, board busyness for M), then round-robin the buckets in ascending
// order. The learner meets one of each difficulty right away (immediate variety)
// and simpler boards surface first. Deterministic — keeps the bank reproducible.
function curateRung(puzzles: Puzzle[]): Puzzle[] {
  const key = (p: Puzzle): number => {
    if (p.mode === "Q-count" && p.solution.kind === "value") return p.solution.value;
    if (p.mode === "Q-binary" && p.solution.kind === "choice") return p.solution.id === "safe" ? 0 : 1;
    return p.stones.length;
  };
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

  // Topic 4 — escape atari. RNG SPACER: the (now frozen) generateEscape is
  // replayed here purely to consume the shared RNG stream exactly as the
  // committed bank did, so topics 5/6/7/10/11 below stay byte-for-byte identical.
  // curateRung() is pure (no RNG), so only generateEscape() needs replaying.
  // The real, ENRICHED Topic 4 is generated from its own seed at the end of
  // buildBank (see below), like topics 8/9.
  generateEscape(rng, { rung: 1, size: 7, count: PER_RUNG, region: "interior" });
  generateEscape(rng, { rung: 2, size: 7, count: PER_RUNG, region: "edge" });

  // Topic 5 — don't self-atari (Q-binary): rung 1 interior, rung 2 any
  groups.push(curateRung(generateSelfAtari(rng, { rung: 1, size: 7, count: PER_RUNG, region: "interior" })));
  groups.push(curateRung(generateSelfAtari(rng, { rung: 2, size: 7, count: PER_RUNG, region: "any" })));

  // Topic 6 — double atari: two rungs
  groups.push(curateRung(generateDoubleAtari(rng, { rung: 1, size: 7, count: PER_RUNG })));
  groups.push(curateRung(generateDoubleAtari(rng, { rung: 2, size: 7, count: PER_RUNG })));

  // Topic 7 — connect & cut: rung 1 connect, rung 2 capture the cutting stone
  groups.push(curateRung(generateConnect(rng, { size: 5, count: PER_RUNG })));
  groups.push(curateRung(generateCaptureCutter(rng, { size: 5, count: PER_RUNG })));

  // Topic 10 — net (geta): rung 1 shallow reads, rung 2 deeper
  groups.push(curateRung(generateNet(rng, { rung: 1, size: 7, count: PER_RUNG, depth: 4 })));
  groups.push(curateRung(generateNet(rng, { rung: 2, size: 7, count: PER_RUNG, depth: 8 })));

  // Topic 11 — snapback: rung 1 recapture ≥2, rung 2 recapture ≥3
  groups.push(curateRung(generateSnapback(rng, { rung: 1, size: 7, count: PER_RUNG, minRecapture: 2 })));
  groups.push(curateRung(generateSnapback(rng, { rung: 2, size: 7, count: PER_RUNG, minRecapture: 3 })));

  // Topic 8 — ladder: appended LAST so the RNG draws for every existing topic (and
  // hence their committed puzzles) are unchanged; only 40 new puzzles are added.
  groups.push(curateRung(generateLadder(rng, { rung: 1, size: 7, count: PER_RUNG, requireFailingAlt: false })));
  groups.push(curateRung(generateLadder(rng, { rung: 2, size: 9, count: PER_RUNG, requireFailingAlt: true })));

  // Topic 9 — ladder-breaker: appended LAST so every existing topic's RNG draws (and committed
  // puzzles) are unchanged; only 40 new puzzles are added.
  groups.push(curateRung(generateLadderBreaker(rng, { rung: 1, size: 9, count: PER_RUNG })));
  groups.push(curateRung(generateLadderBreaker(rng, { rung: 2, size: 9, count: PER_RUNG })));

  // Topic 4 (enriched) — drawn from its OWN seed so edits here never disturb
  // other topics, and appended last so its slot in the shared stream is
  // irrelevant (mirrors topics 8/9). Rung 1: run to safety (1-3 stone groups).
  // Rung 2: capture the attacker to escape.
  const escapeRng = makeRng(seed ^ 0x00457363); // "Esc"
  groups.push(curateRung(generateEscapeRun(escapeRng, { rung: 1, size: 7, count: PER_RUNG, region: "any", maxGroup: 3 })));
  groups.push(curateRung(generateEscapeCapture(escapeRng, { rung: 2, size: 7, count: PER_RUNG, region: "any" })));

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
