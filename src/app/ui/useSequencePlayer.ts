import { useState, useEffect, useMemo, useRef } from "react";
import type { Stone, DemoMove } from "../model/types";
import { positionAt } from "../model/sequence";

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export interface SequencePlayer {
  stones: Stone[];
  playing: boolean;
  done: boolean;
  replay: () => void;
}

// Auto-plays a payoff line once on mount, one move every `stepMs`. Under
// prefers-reduced-motion it starts (and replays) at the final position.
//
// The timer chain is scheduled imperatively inside a single long-lived effect
// (self-rescheduling on each tick) rather than via a `step`-dependent effect.
// Advancing the next tick's timer synchronously inside the current tick's
// callback keeps the whole chain inside one fake-timer sweep — a dependent
// effect would instead wait for React's (real, unmocked) scheduler to render
// and re-run before registering the next timeout.
export function useSequencePlayer(initial: Stone[], payoff: DemoMove[], stepMs = 450): SequencePlayer {
  const reduced = useRef(prefersReducedMotion()).current;
  const end = payoff.length;
  const [step, setStep] = useState(reduced ? end : 0);
  const [gen, setGen] = useState(0);

  useEffect(() => {
    if (reduced) return;
    let cancelled = false;
    let current = 0;
    function scheduleNext() {
      if (cancelled || current >= end) return;
      setTimeout(() => {
        if (cancelled) return;
        current += 1;
        setStep(current);
        scheduleNext();
      }, stepMs);
    }
    scheduleNext();
    return () => { cancelled = true; };
  }, [reduced, end, stepMs, gen]);

  const stones = useMemo(() => positionAt(initial, payoff, step), [initial, payoff, step]);
  const replay = () => {
    setStep(reduced ? end : 0);
    setGen((g) => g + 1);
  };
  return { stones, playing: step < end, done: step >= end, replay };
}
