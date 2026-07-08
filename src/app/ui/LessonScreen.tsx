import type { Lesson } from "../content/lessons";
import type { Puzzle } from "../model/types";
import { Board } from "./Board";
import { PayoffBoard } from "./PayoffBoard";

// Renders the lesson diagram by reusing the puzzle Board: the diagram is a Puzzle-shaped
// object shown "revealed" so the teaching move appears as a ghost stone + accent ring.
function diagramPuzzle(lesson: Lesson): Puzzle {
  const d = lesson.diagram;
  return {
    id: `lesson-${lesson.topic}`,
    topic: lesson.topic,
    rung: 0,
    mode: "M",
    size: d.size,
    stones: d.stones,
    toPlay: "b",
    prompt: lesson.title,
    solution: { kind: "move", points: d.keyMove ?? [] },
    marks: d.marks,
    ataris: d.ataris,
  };
}

export function LessonScreen({ lesson, onDismiss, dismissLabel = "Start practicing" }: { lesson: Lesson; onDismiss: () => void; dismissLabel?: string }) {
  const showMove = (lesson.diagram.keyMove?.length ?? 0) > 0;
  return (
    <div className="lesson-overlay" role="dialog" aria-modal="true" aria-label={`Lesson: ${lesson.title}`}>
      <div className="lesson-card">
        <div className="lesson-eyebrow">Lesson</div>
        <h2 className="lesson-title">{lesson.title}</h2>
        <div className="lesson-board">
          {lesson.diagram.payoff ? (
            <PayoffBoard key={lesson.topic} puzzle={diagramPuzzle(lesson)} payoff={lesson.diagram.payoff} />
          ) : (
            <Board
              puzzle={diagramPuzzle(lesson)}
              reveal={showMove || Boolean(lesson.diagram.breaker)}
              breaker={lesson.diagram.breaker}
            />
          )}
        </div>
        <p className="lesson-caption">{lesson.diagram.caption}</p>
        <div className="lesson-body">
          {lesson.body.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
        <button className="btn" onClick={onDismiss}>{dismissLabel}</button>
      </div>
    </div>
  );
}
