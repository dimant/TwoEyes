import { Observable } from "./observable";
import type { PuzzleBank } from "../model/bank";
import { MASTERY, type ProgressStore } from "../model/progress";
import { checkAnswer, type Input } from "../model/answer";
import type { Puzzle } from "../model/types";

export type Phase = "idle" | "correct" | "wrong" | "revealed";

export interface PlayerState {
  puzzle: Puzzle | null;
  phase: Phase;
  misses: number;
  mastery: number;
  done: boolean;
}

export class PlayerViewModel extends Observable<PlayerState> {
  private readonly queue: Puzzle[];
  private index = 0;

  constructor(
    bank: PuzzleBank,
    private readonly progress: ProgressStore,
    private readonly topic: number,
    private readonly rung: number,
  ) {
    const queue = bank.puzzles(topic, rung);
    super({
      puzzle: queue[0] ?? null,
      phase: "idle",
      misses: 0,
      mastery: progress.masteryCount(topic, rung),
      done: queue.length === 0,
    });
    this.queue = queue;
  }

  submit(input: Input): void {
    const s = this.snapshot;
    // No input once the puzzle is resolved (solved) or the answer has been revealed —
    // you can't earn mastery after being shown the answer.
    if (!s.puzzle || s.phase === "correct" || s.phase === "revealed") return;
    if (checkAnswer(s.puzzle, input)) {
      this.progress.record(this.topic, this.rung, true);
      this.set({ ...s, phase: "correct", mastery: this.progress.masteryCount(this.topic, this.rung) });
    } else {
      this.progress.record(this.topic, this.rung, false);
      const misses = s.misses + 1;
      this.set({ ...s, phase: misses >= 2 ? "revealed" : "wrong", misses });
    }
  }

  retry(): void {
    const s = this.snapshot;
    if (s.phase === "wrong") this.set({ ...s, phase: "idle" });
  }

  reveal(): void {
    this.set({ ...this.snapshot, phase: "revealed" });
  }

  next(): void {
    this.index += 1;
    const mastery = this.progress.masteryCount(this.topic, this.rung);
    // The rung is finished once it's mastered — don't march through all 20 puzzles.
    const puzzle = mastery >= MASTERY ? null : (this.queue[this.index] ?? null);
    this.set({ puzzle, phase: "idle", misses: 0, mastery, done: puzzle === null });
  }
}
