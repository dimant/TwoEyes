import { Point } from "../engine/board";
import { Rng, randint, shuffle } from "../engine/rng";

export type Region = "interior" | "edge" | "any";

export function startCell(rng: Rng, size: number, region: Region): Point {
  if (region === "interior") {
    return { x: randint(rng, 1, size - 2), y: randint(rng, 1, size - 2) };
  }
  if (region === "edge") {
    const along = randint(rng, 0, size - 1);
    const side = randint(rng, 0, 3);
    if (side === 0) return { x: along, y: 0 };
    if (side === 1) return { x: along, y: size - 1 };
    if (side === 2) return { x: 0, y: along };
    return { x: size - 1, y: along };
  }
  return { x: randint(rng, 0, size - 1), y: randint(rng, 0, size - 1) };
}

// Grow a connected blob of `n` points from a region-seeded start.
export function growBlob(rng: Rng, size: number, n: number, region: Region): Point[] | null {
  const start = startCell(rng, size, region);
  const blob: Point[] = [start];
  const inBlob = (p: Point) => blob.some((q) => q.x === p.x && q.y === p.y);
  while (blob.length < n) {
    const frontier: Point[] = [];
    for (const s of blob)
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const p = { x: s.x + dx, y: s.y + dy };
        if (p.x >= 0 && p.y >= 0 && p.x < size && p.y < size && !inBlob(p)) frontier.push(p);
      }
    if (frontier.length === 0) return null;
    blob.push(shuffle(rng, frontier)[0] as Point);
  }
  return blob;
}
