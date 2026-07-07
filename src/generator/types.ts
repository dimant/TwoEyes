import { Stone, Point, Color } from "../engine/board";

export type Mode = "M" | "Q-count" | "Q-choice" | "Q-binary";

export interface Mark { x: number; y: number; kind: "mark" | "target" | "atari"; }

export type SolutionSpec =
  | { kind: "move"; points: Point[] }
  | { kind: "value"; value: number }
  | { kind: "choice"; id: string };

export interface Puzzle {
  id: string;
  topic: number;
  rung: number;
  mode: Mode;
  size: number;
  stones: Stone[];
  toPlay: Color;
  prompt: string;
  solution: SolutionSpec;
  captured?: Point[];
  ataris?: Point[];
  marks?: Mark[];
}

export interface Bank { seed: number; stage: string; puzzles: Puzzle[]; }
