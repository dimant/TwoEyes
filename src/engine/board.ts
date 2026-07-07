export type Color = "b" | "w";
export type Cell = Color | null;
export interface Point { x: number; y: number; }
export interface Stone extends Point { c: Color; }

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

export class Board {
  readonly size: number;
  private grid: Cell[];

  constructor(size: number) {
    this.size = size;
    this.grid = new Array(size * size).fill(null);
  }

  static from(size: number, stones: Stone[]): Board {
    const b = new Board(size);
    for (const s of stones) b.set(s.x, s.y, s.c);
    return b;
  }

  private idx(x: number, y: number): number { return y * this.size + x; }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.size && y < this.size;
  }

  get(x: number, y: number): Cell {
    if (!this.inBounds(x, y)) return null;
    return this.grid[this.idx(x, y)] ?? null;
  }

  set(x: number, y: number, c: Cell): void {
    if (!this.inBounds(x, y)) throw new RangeError(`out of bounds: (${x}, ${y})`);
    this.grid[this.idx(x, y)] = c;
  }

  clone(): Board {
    const b = new Board(this.size);
    b.grid = this.grid.slice();
    return b;
  }

  neighbors(x: number, y: number): Point[] {
    const out: Point[] = [];
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy;
      if (this.inBounds(nx, ny)) out.push({ x: nx, y: ny });
    }
    return out;
  }

  stones(): Stone[] {
    const out: Stone[] = [];
    for (let y = 0; y < this.size; y++)
      for (let x = 0; x < this.size; x++) {
        const c = this.get(x, y);
        if (c) out.push({ x, y, c });
      }
    return out;
  }
}
