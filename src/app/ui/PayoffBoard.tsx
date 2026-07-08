import type { Puzzle, DemoMove } from "../model/types";
import { Board } from "./Board";
import { useSequencePlayer } from "./useSequencePlayer";

export function PayoffBoard({ puzzle, payoff }: { puzzle: Puzzle; payoff: DemoMove[] }) {
  const { stones, playing, replay } = useSequencePlayer(puzzle.stones, payoff);
  return (
    <div className="payoff">
      <Board puzzle={puzzle} stones={stones} />
      <button className="replay" onClick={replay} disabled={playing} aria-label="Replay the sequence">
        Replay
      </button>
    </div>
  );
}
