import type { Puzzle, Pt } from "./types";

export type Input =
  | { kind: "move"; point: Pt }
  | { kind: "value"; value: number }
  | { kind: "choice"; id: string };

export function checkAnswer(puzzle: Puzzle, input: Input): boolean {
  const s = puzzle.solution;
  if (s.kind === "move" && input.kind === "move") {
    return s.points.some((p) => p.x === input.point.x && p.y === input.point.y);
  }
  if (s.kind === "value" && input.kind === "value") return input.value === s.value;
  if (s.kind === "choice" && input.kind === "choice") return input.id === s.id;
  return false;
}
