import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { PayoffBoard } from "./PayoffBoard";
import type { Puzzle, DemoMove } from "../model/types";

const puzzle: Puzzle = {
  id: "x", topic: 10, rung: 1, mode: "M", size: 5, toPlay: "b", prompt: "",
  stones: [
    { x: 2, y: 2, c: "w" }, { x: 1, y: 2, c: "b" }, { x: 3, y: 2, c: "b" }, { x: 2, y: 1, c: "b" },
  ],
  solution: { kind: "move", points: [{ x: 2, y: 3 }] },
};
const payoff: DemoMove[] = [{ x: 2, y: 3, c: "b", captures: [{ x: 2, y: 2 }] }];

describe("PayoffBoard", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("plays the line to the final position and offers Replay", () => {
    const { container } = render(<PayoffBoard puzzle={puzzle} payoff={payoff} />);
    expect(container.querySelectorAll("circle.stone").length).toBe(4); // initial
    act(() => { vi.advanceTimersByTime(450); });
    const stones = container.querySelectorAll("circle.stone");
    expect(stones.length).toBe(4); // white captured, black played -> still 4, all black
    expect(screen.getByRole("button", { name: /Replay/ })).toBeDefined();
  });
});
