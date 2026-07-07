export type Color = "b" | "w";
export interface Pt { x: number; y: number; }
export interface Stone extends Pt { c: Color; }
export type Mode = "M" | "Q-count" | "Q-binary";
export interface Mark { x: number; y: number; kind: "mark" | "target" | "atari"; }
export type Solution =
  | { kind: "move"; points: Pt[] }
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
  solution: Solution;
  captured?: Pt[];
  ataris?: Pt[];
  marks?: Mark[];
}

export interface Bank { seed: number; stage: string; puzzles: Puzzle[]; }
