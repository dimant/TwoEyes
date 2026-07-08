import { useState } from "react";
import { useViewModel } from "../useViewModel";
import type { PlayerViewModel } from "../vm/player-vm";
import type { Input } from "../model/answer";
import { MASTERY } from "../model/progress";
import type { Lesson } from "../content/lessons";
import { Board } from "./Board";
import { PayoffBoard } from "./PayoffBoard";
import { LessonScreen } from "./LessonScreen";
import { NumberPad, YesNo, type ChoiceOption } from "./inputs";
import { Feedback } from "./Feedback";

const Q_CHOICES: Record<number, [ChoiceOption, ChoiceOption]> = {
  5: [{ id: "self-atari", label: "Self-atari" }, { id: "safe", label: "Safe" }],
  9: [{ id: "caught", label: "Caught" }, { id: "escapes", label: "Escapes" }],
};

function PlayerHead({ mastery, onExit, onLearn }: { mastery: number; onExit: () => void; onLearn?: () => void }) {
  return (
    <div className="player-head">
      <button className="back" onClick={onExit} aria-label="Back to the map">‹ Map</button>
      <div className="pips" aria-label={`${mastery} of ${MASTERY} correct`}>
        {Array.from({ length: MASTERY }).map((_, i) => (
          <span key={i} className={`pip${i < mastery ? " on" : ""}`} />
        ))}
      </div>
      {onLearn && <button className="learn" onClick={onLearn} aria-label="Show the lesson">Learn</button>}
    </div>
  );
}

export function PlayerScreen({
  player,
  onExit,
  lesson,
  lessonSeen = true,
  onLessonSeen,
}: {
  player: PlayerViewModel;
  onExit: () => void;
  lesson?: Lesson;
  lessonSeen?: boolean;
  onLessonSeen?: () => void;
}) {
  const s = useViewModel(player);
  // Auto-open the lesson the first time this topic is entered; the Learn button reopens it.
  const [showLesson, setShowLesson] = useState(!!lesson && !lessonSeen);
  const dismissLesson = () => { setShowLesson(false); onLessonSeen?.(); };
  const learnProps = lesson ? { onLearn: () => setShowLesson(true) } : {};

  if (lesson && showLesson) {
    return <LessonScreen lesson={lesson} onDismiss={dismissLesson} />;
  }

  if (s.done || !s.puzzle) {
    return (
      <div className="screen player">
        <PlayerHead mastery={s.mastery} onExit={onExit} {...learnProps} />
        <div className="done-note">
          <div className="seal">✓</div>
          <h2>Rung complete</h2>
          <p className="sub">Nicely done — that's this rung mastered.</p>
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
      <PlayerHead mastery={s.mastery} onExit={onExit} {...learnProps} />
      <div className="prompt">
        <div className="who">{p.toPlay === "b" ? "● Black to play" : "○ White to play"}</div>
        <div className="q">{p.prompt}</div>
      </div>
      <div className="board-hold">
        {resolved && p.payoff ? (
          <PayoffBoard key={p.id} puzzle={p} payoff={p.payoff} />
        ) : (
          <Board
            puzzle={p}
            reveal={resolved}
            onTapPoint={p.mode === "M" && !resolved ? (pt) => submit({ kind: "move", point: pt }) : undefined}
          />
        )}
      </div>
      {!resolved && p.mode === "Q-count" && <NumberPad onPick={(n) => submit({ kind: "value", value: n })} />}
      {!resolved && p.mode === "Q-binary" && (
        <YesNo options={Q_CHOICES[p.topic]!} onPick={(id) => submit({ kind: "choice", id })} />
      )}
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
