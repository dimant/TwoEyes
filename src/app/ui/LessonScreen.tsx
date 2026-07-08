import type { Lesson } from "../content/lessons";
import type { Puzzle } from "../model/types";
import { Board } from "./Board";

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

export function LessonScreen({ lesson, onDismiss }: { lesson: Lesson; onDismiss: () => void }) {
  const showMove = (lesson.diagram.keyMove?.length ?? 0) > 0;
  return (
    <div className="lesson-overlay" role="dialog" aria-modal="true" aria-label={`Lesson: ${lesson.title}`}>
      <div className="lesson-card">
        <div className="lesson-eyebrow">Lesson</div>
        <h2 className="lesson-title">{lesson.title}</h2>
        <div className="lesson-board">
          <Board puzzle={diagramPuzzle(lesson)} reveal={showMove} />
        </div>
        <p className="lesson-caption">{lesson.diagram.caption}</p>
        <div className="lesson-body">
          {lesson.body.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
        <button className="btn" onClick={onDismiss}>Start practicing</button>
      </div>
    </div>
  );
}
