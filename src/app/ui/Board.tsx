import type { Puzzle, Pt } from "../model/types";

export interface BoardProps {
  puzzle: Puzzle;
  reveal?: boolean;
  onTapPoint?: (p: Pt) => void;
}

const CELL = 40;
const M = 24;

export function Board({ puzzle, reveal, onTapPoint }: BoardProps) {
  const { size, stones } = puzzle;
  const W = M * 2 + (size - 1) * CELL;
  const px = (v: number) => M + v * CELL;
  const r = CELL * 0.44;
  const occupied = (x: number, y: number) => stones.some((s) => s.x === x && s.y === y);
  const isMark = (kind: string, x: number, y: number) =>
    (puzzle.marks ?? []).some((m) => m.kind === kind && m.x === x && m.y === y);
  const isCaptured = (x: number, y: number) => (puzzle.captured ?? []).some((c) => c.x === x && c.y === y);

  const lines = [];
  for (let i = 0; i < size; i++) {
    const p = px(i);
    const w = i === 0 || i === size - 1 ? 2 : 1.2;
    lines.push(<line key={`h${i}`} x1={M} y1={p} x2={M + (size - 1) * CELL} y2={p} stroke="var(--line)" strokeWidth={w} />);
    lines.push(<line key={`v${i}`} x1={p} y1={M} x2={p} y2={M + (size - 1) * CELL} stroke="var(--line)" strokeWidth={w} />);
  }

  const taps: JSX.Element[] = [];
  if (onTapPoint) {
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        if (occupied(x, y)) continue;
        taps.push(
          <circle key={`t${x}-${y}`} className="tap" data-tap="" cx={px(x)} cy={px(y)} r={CELL * 0.46}
            fill="transparent" onClick={() => onTapPoint({ x, y })} />,
        );
      }
  }

  return (
    <svg className="board" viewBox={`0 0 ${W} ${W}`} role="img" aria-label={puzzle.prompt || "Go board"}>
      <rect x={6} y={6} width={W - 12} height={W - 12} rx={10} fill="var(--board)" stroke="var(--board-edge)" strokeWidth={2} />
      {lines}
      {size % 2 === 1 && <circle cx={px((size - 1) / 2)} cy={px((size - 1) / 2)} r={3.2} fill="var(--star)" />}
      {(puzzle.ataris ?? []).map((a, i) => (
        <circle key={`a${i}`} cx={px(a.x)} cy={px(a.y)} r={r + 4} fill="none" stroke="var(--warn)" strokeWidth={3} />
      ))}
      {reveal && (puzzle.captured ?? []).map((c, i) => (
        <circle key={`c${i}`} cx={px(c.x)} cy={px(c.y)} r={r + 4} fill="none" stroke="var(--warn)" strokeWidth={2.5} strokeDasharray="4 4" />
      ))}
      {stones.map((s, i) => (
        <g key={`s${i}`}>
          <circle className="stone" cx={px(s.x)} cy={px(s.y)} r={r}
            fill={s.c === "b" ? "var(--black)" : "var(--white)"}
            stroke={s.c === "b" ? "var(--black-rim)" : "var(--white-rim)"} strokeWidth={1.2}
            opacity={reveal && isCaptured(s.x, s.y) ? 0.5 : 1} />
          <ellipse cx={px(s.x) - r * 0.3} cy={px(s.y) - r * 0.34} rx={r * 0.32} ry={r * 0.22}
            fill={s.c === "b" ? "rgba(255,255,255,.18)" : "rgba(255,255,255,.7)"} />
          {isMark("mark", s.x, s.y) && (
            <circle cx={px(s.x)} cy={px(s.y)} r={r + 3} fill="none" stroke="var(--accent)" strokeWidth={2.6} />
          )}
        </g>
      ))}
      {(puzzle.marks ?? []).filter((m) => m.kind === "target").map((m, i) => (
        <circle key={`m${i}`} cx={px(m.x)} cy={px(m.y)} r={r} fill="none" stroke="var(--accent)" strokeWidth={2.6} />
      ))}
      {reveal && puzzle.solution.kind === "move" && puzzle.solution.points.map((p, i) => (
        <g key={`sol${i}`}>
          <circle cx={px(p.x)} cy={px(p.y)} r={r} fill="var(--black)" opacity={0.4} />
          <circle cx={px(p.x)} cy={px(p.y)} r={r + 3} fill="none" stroke="var(--accent)" strokeWidth={2.6} />
        </g>
      ))}
      {taps}
    </svg>
  );
}
