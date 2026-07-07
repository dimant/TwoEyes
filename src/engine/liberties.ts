import { Board, Point, Color } from "./board";

export interface GroupInfo { stones: Point[]; liberties: Point[]; }

export function group(board: Board, x: number, y: number): GroupInfo {
  const color = board.get(x, y);
  if (!color) return { stones: [], liberties: [] };

  const seen = new Set<string>();
  const libSeen = new Set<string>();
  const stones: Point[] = [];
  const liberties: Point[] = [];
  const stack: Point[] = [{ x, y }];
  seen.add(`${x},${y}`);

  while (stack.length) {
    const p = stack.pop() as Point;
    stones.push(p);
    for (const n of board.neighbors(p.x, p.y)) {
      const key = `${n.x},${n.y}`;
      const c = board.get(n.x, n.y);
      if (c === null) {
        if (!libSeen.has(key)) { libSeen.add(key); liberties.push(n); }
      } else if (c === (color as Color) && !seen.has(key)) {
        seen.add(key);
        stack.push(n);
      }
    }
  }
  return { stones, liberties };
}

export function libertyCount(board: Board, x: number, y: number): number {
  return group(board, x, y).liberties.length;
}
