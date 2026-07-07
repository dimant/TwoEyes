import { useViewModel } from "../useViewModel";
import type { PlayerViewModel } from "../vm/player-vm";
import type { Input } from "../model/answer";
import { Board } from "./Board";
import { NumberPad, YesNo } from "./inputs";
import { Feedback } from "./Feedback";

export function PlayerScreen({ player, onExit }: { player: PlayerViewModel; onExit: () => void }) {
  const s = useViewModel(player);

  if (s.done || !s.puzzle) {
    return (
      <div className="screen player">
        <div className="done-note">
          <div className="seal">✓</div>
          <h2>Rung complete</h2>
          <button className="btn" onClick={onExit}>Back to map</button>
        </div>
      </div>
    );
  }

  const p = s.puzzle;
  const resolved = s.phase === "correct" || s.phase === "revealed";
  const submit = (i: Input) => player.submit(i);

  return (
    <div className="screen player">
      <div className="prompt">
        <div className="who">{p.toPlay === "b" ? "● Black to play" : "○ White to play"}</div>
        <div className="q">{p.prompt}</div>
      </div>
      <div className="board-hold">
        <Board
          puzzle={p}
          reveal={resolved}
          onTapPoint={p.mode === "M" && !resolved ? (pt) => submit({ kind: "move", point: pt }) : undefined}
        />
      </div>
      {!resolved && p.mode === "Q-count" && <NumberPad onPick={(n) => submit({ kind: "value", value: n })} />}
      {!resolved && p.mode === "Q-binary" && <YesNo onPick={(id) => submit({ kind: "choice", id })} />}
      {!resolved && p.mode === "M" && <p className="hint">Tap a point to play.</p>}
      {s.phase !== "idle" && (
        <Feedback
          phase={s.phase}
          onNext={() => player.next()}
          onRetry={() => player.retry()}
        />
      )}
    </div>
  );
}
