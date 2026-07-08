import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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
  it("opens at the start with a Next-move control, steps to the end, then offers Replay", () => {
    const { container } = render(<PayoffBoard puzzle={puzzle} payoff={payoff} />);
    // opens at the initial position (no move played yet); the white stone is still there
    expect(container.querySelectorAll("circle.stone").length).toBe(4);
    expect(container.querySelector("circle.stone[fill='var(--white)']")).not.toBeNull();
    expect(screen.getByRole("button", { name: /Next move/i })).toBeDefined();
    expect(screen.queryByRole("button", { name: /^Replay$/i })).toBeNull();

    // one press plays the (only) move: black plays, white is captured
    fireEvent.click(screen.getByRole("button", { name: /Next move/i }));
    expect(container.querySelectorAll("circle.stone").length).toBe(4);
    expect(container.querySelector("circle.stone[fill='var(--white)']")).toBeNull();

    // at the end: Replay appears, Next move is gone
    expect(screen.getByRole("button", { name: /Replay/i })).toBeDefined();
    expect(screen.queryByRole("button", { name: /Next move/i })).toBeNull();

    // Replay resets to the start
    fireEvent.click(screen.getByRole("button", { name: /Replay/i }));
    expect(screen.getByRole("button", { name: /Next move/i })).toBeDefined();
    expect(container.querySelector("circle.stone[fill='var(--white)']")).not.toBeNull();
  });
});
