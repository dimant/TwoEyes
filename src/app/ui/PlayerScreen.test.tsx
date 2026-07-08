import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PlayerScreen } from "./PlayerScreen";
import { PlayerViewModel } from "../vm/player-vm";
import { PuzzleBank } from "../model/bank";
import { ProgressStore } from "../model/progress";
import type { Bank } from "../model/types";
import { lessonFor } from "../content/lessons";

const bank: Bank = { seed: 0, stage: "A", puzzles: [{
  id: "a", topic: 2, rung: 1, mode: "M", size: 5, toPlay: "b", prompt: "Capture.",
  stones: [{ x: 2, y: 2, c: "w" }, { x: 1, y: 2, c: "b" }, { x: 3, y: 2, c: "b" }, { x: 2, y: 1, c: "b" }],
  solution: { kind: "move", points: [{ x: 2, y: 3 }] }, captured: [{ x: 2, y: 2 }],
}]};
function mem() { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }; }

describe("PlayerScreen", () => {
  it("tapping the solution point shows Correct and advances on Next", () => {
    const pb = new PuzzleBank(bank);
    const vm = new PlayerViewModel(pb, new ProgressStore(mem(), pb.rungRefs()), 2, 1);
    const onExit = vi.fn();
    const { container } = render(<PlayerScreen player={vm} onExit={onExit} />);
    expect(screen.getByText("Capture.")).toBeDefined();
    // tap intersection (2,3): find its tap target and click
    const taps = container.querySelectorAll("[data-tap]");
    // the tap for (2,3) — find and click it
    const tapFor23 = Array.from(taps).find((t) => t.getAttribute("cx") === "104" && t.getAttribute("cy") === "144");
    expect(tapFor23).toBeDefined();
    fireEvent.click(tapFor23!);
    expect(screen.getByText(/Correct/)).toBeDefined();

    // Next advances the queue; with one puzzle in the rung, that reaches the done state
    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    expect(screen.getByText(/Rung complete/)).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: /Back to map/ }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it("auto-shows the lesson on first entry, then drops into the puzzle when dismissed", () => {
    const pb = new PuzzleBank(bank);
    const vm = new PlayerViewModel(pb, new ProgressStore(mem(), pb.rungRefs()), 2, 1);
    const onLessonSeen = vi.fn();
    render(
      <PlayerScreen player={vm} onExit={vi.fn()} lesson={lessonFor(2)!} lessonSeen={false} onLessonSeen={onLessonSeen} />,
    );
    // lesson is shown, puzzle prompt is not yet
    expect(screen.getByText(/Capture a stone/)).toBeDefined();
    expect(screen.queryByText("Capture.")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Start practicing/ }));
    expect(onLessonSeen).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Capture.")).toBeDefined(); // now on the puzzle
  });

  it("does not auto-show the lesson when already seen, but the Learn button reopens it", () => {
    const pb = new PuzzleBank(bank);
    const vm = new PlayerViewModel(pb, new ProgressStore(mem(), pb.rungRefs()), 2, 1);
    render(
      <PlayerScreen player={vm} onExit={vi.fn()} lesson={lessonFor(2)!} lessonSeen={true} onLessonSeen={vi.fn()} />,
    );
    expect(screen.getByText("Capture.")).toBeDefined(); // straight to the puzzle
    fireEvent.click(screen.getByRole("button", { name: /Show the lesson/ }));
    expect(screen.getByText(/Start practicing/)).toBeDefined(); // lesson reopened
  });

  it("a solved puzzle with a payoff shows the animated Replay, not the static reveal", () => {
    vi.useFakeTimers();
    try {
      const netBank: Bank = { seed: 0, stage: "B", puzzles: [{
        id: "n", topic: 10, rung: 1, mode: "M", size: 5, toPlay: "b", prompt: "Net it.",
        stones: [{ x: 2, y: 2, c: "w" }, { x: 1, y: 2, c: "b" }, { x: 3, y: 2, c: "b" }, { x: 2, y: 1, c: "b" }],
        solution: { kind: "move", points: [{ x: 2, y: 3 }] },
        payoff: [{ x: 2, y: 3, c: "b", captures: [{ x: 2, y: 2 }] }],
      }]};
      const pb = new PuzzleBank(netBank);
      const vm = new PlayerViewModel(pb, new ProgressStore(mem(), pb.rungRefs()), 10, 1);
      const { container } = render(<PlayerScreen player={vm} onExit={vi.fn()} />);
      const tap = Array.from(container.querySelectorAll("[data-tap]")).find(
        (t) => t.getAttribute("cx") === "104" && t.getAttribute("cy") === "144",
      );
      fireEvent.click(tap!);
      expect(screen.getByText(/Correct/)).toBeDefined();
      expect(screen.getByRole("button", { name: /Replay/ })).toBeDefined();
    } finally {
      vi.useRealTimers();
    }
  });
});
