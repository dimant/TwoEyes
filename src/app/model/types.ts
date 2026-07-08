export type Color = "b" | "w";
export interface Pt { x: number; y: number; }
export interface Stone extends Pt { c: Color; }
// Mirrors src/generator/types.ts. "Q-choice" isn't used by the current bank but is
// kept in the union so the two hand-maintained copies don't silently diverge.
export type Mode = "M" | "Q-count" | "Q-binary" | "Q-choice";
export interface Mark { x: number; y: number; kind: "mark" | "target" | "atari"; }
export type Solution =
  | { kind: "move"; points: Pt[] }
  | { kind: "value"; value: number }
  | { kind: "choice"; id: string };

export interface DemoMove { x: number; y: number; c: Color; captures?: Pt[]; }

export interface Puzzle {
  id: string;
  topic: number;
  rung: number;
  mode: Mode;
  size: number;
  stones: Stone[];
  toPlay: Color;
  prompt: string;
  solution: Solution;
  captured?: Pt[];
  ataris?: Pt[];
  marks?: Mark[];
  payoff?: DemoMove[];
}

export interface Bank { seed: number; stage: string; puzzles: Puzzle[]; }
