import { useState, useMemo } from "react";
import type { Stone, DemoMove } from "../model/types";
import { positionAt } from "../model/sequence";

export interface SequencePlayer {
  stones: Stone[];
  step: number;
  atEnd: boolean;
  next: () => void;
  replay: () => void;
}

// Steps a payoff line one move at a time under the learner's control (a "Next move"
// button). There is no auto-advance: the board opens at the initial position and each
// next() plays exactly one more move; replay() returns to the start. Stepping is a
// discrete user action, so there's nothing timed to reconcile with reduced-motion —
// the per-stone CSS fade already respects it.
export function useSequencePlayer(initial: Stone[], payoff: DemoMove[]): SequencePlayer {
  const end = payoff.length;
  const [step, setStep] = useState(0);
  const stones = useMemo(() => positionAt(initial, payoff, step), [initial, payoff, step]);
  return {
    stones,
    step,
    atEnd: step >= end,
    next: () => setStep((s) => Math.min(s + 1, end)),
    replay: () => setStep(0),
  };
}
