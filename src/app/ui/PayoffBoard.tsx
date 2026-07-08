import type { Puzzle, DemoMove } from "../model/types";
import { Board } from "./Board";
import { useSequencePlayer } from "./useSequencePlayer";

export function PayoffBoard({ puzzle, payoff }: { puzzle: Puzzle; payoff: DemoMove[] }) {
  const { stones, atEnd, next, replay } = useSequencePlayer(puzzle.stones, payoff);
  return (
    <div className="payoff">
      <Board puzzle={puzzle} stones={stones} />
      {atEnd ? (
        <button className="replay" onClick={replay} aria-label="Replay the sequence">Replay</button>
      ) : (
        <button className="replay" onClick={next} aria-label="Play the next move">Next move ▸</button>
      )}
    </div>
  );
}
