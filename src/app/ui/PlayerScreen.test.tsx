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
    fireEvent.click(screen.getByRole("button", { name: /Next →/ }));
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

  it("shows the tapped point as a circled stone (your move)", () => {
    const pb = new PuzzleBank(bank);
    const vm = new PlayerViewModel(pb, new ProgressStore(mem(), pb.rungRefs()), 2, 1);
    const { container } = render(<PlayerScreen player={vm} onExit={vi.fn()} />);
    expect(container.querySelectorAll("circle.pick-ring").length).toBe(0); // nothing picked yet
    const tap = Array.from(container.querySelectorAll("[data-tap]")).find(
      (t) => t.getAttribute("cx") === "104" && t.getAttribute("cy") === "144",
    );
    fireEvent.click(tap!);
    expect(container.querySelectorAll("circle.pick-ring").length).toBe(1);
  });

  it("a solved puzzle with a payoff shows the stepped payoff (Next move), not the static reveal", () => {
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
    expect(screen.getByRole("button", { name: /Next move/i })).toBeDefined();
  });

  it("topic 9 caught: answering reveals the stepped capture (Next move)", () => {
    const bank: Bank = { seed: 0, stage: "B", puzzles: [{
      id: "c", topic: 9, rung: 1, mode: "Q-binary", size: 5, toPlay: "b",
      prompt: "If Black ladders the marked stone, is it caught?",
      stones: [{ x: 2, y: 2, c: "w" }, { x: 1, y: 2, c: "b" }, { x: 3, y: 2, c: "b" }, { x: 2, y: 1, c: "b" }],
      solution: { kind: "choice", id: "caught" },
      marks: [{ x: 2, y: 2, kind: "mark" }],
      payoff: [{ x: 2, y: 3, c: "b", captures: [{ x: 2, y: 2 }] }],
    }]};
    const pb = new PuzzleBank(bank);
    const vm = new PlayerViewModel(pb, new ProgressStore(mem(), pb.rungRefs()), 9, 1);
    render(<PlayerScreen player={vm} onExit={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Caught/ }));
    expect(screen.getByRole("button", { name: /Next move/i })).toBeDefined();
  });

  it("topic 9 escapes: answering rings the breaker with a caption", () => {
    const bank: Bank = { seed: 0, stage: "B", puzzles: [{
      id: "e", topic: 9, rung: 1, mode: "Q-binary", size: 9, toPlay: "b",
      prompt: "If Black ladders the marked stone, is it caught?",
      stones: [{ x: 4, y: 5, c: "b" }, { x: 5, y: 5, c: "w" }, { x: 6, y: 5, c: "b" }, { x: 6, y: 6, c: "b" }, { x: 3, y: 7, c: "w" }],
      solution: { kind: "choice", id: "escapes" },
      marks: [{ x: 5, y: 5, kind: "mark" }],
      breaker: { x: 3, y: 7 },
    }]};
    const pb = new PuzzleBank(bank);
    const vm = new PlayerViewModel(pb, new ProgressStore(mem(), pb.rungRefs()), 9, 1);
    const { container } = render(<PlayerScreen player={vm} onExit={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Escapes/ }));
    expect(container.querySelectorAll("circle.breaker").length).toBe(1);
    expect(screen.getByText(/breaks the ladder/i)).toBeDefined();
  });

  it("a solved capture puzzle reveals the stepped capture (Next move ▸) and stepping removes the captured stone", () => {
    // the module-level `bank` is a topic-2 capture puzzle (captured: [{x:2,y:2}])
    const pb = new PuzzleBank(bank);
    const vm = new PlayerViewModel(pb, new ProgressStore(mem(), pb.rungRefs()), 2, 1);
    const { container } = render(<PlayerScreen player={vm} onExit={vi.fn()} />);
    const tap = Array.from(container.querySelectorAll("[data-tap]")).find(
      (t) => t.getAttribute("cx") === "104" && t.getAttribute("cy") === "144",
    );
    fireEvent.click(tap!); // solve (2,3)
    expect(screen.getByText(/Correct/)).toBeDefined();
    // reveal is the stepped payoff, not the static board
    const stepBtn = screen.getByRole("button", { name: /Next move/i });
    // captured white stone (2,2) is present at step 0, gone after stepping
    const whites = () => Array.from(container.querySelectorAll("circle.stone"))
      .filter((c) => c.getAttribute("fill") === "var(--white)");
    expect(whites()).toHaveLength(1);
    fireEvent.click(stepBtn);
    expect(whites()).toHaveLength(0);
  });

  it("a solved non-capturing move reveals statically (no Next move ▸)", () => {
    const plainBank: Bank = { seed: 0, stage: "A", puzzles: [{
      id: "nc", topic: 4, rung: 1, mode: "M", size: 5, toPlay: "b", prompt: "Escape.",
      stones: [{ x: 1, y: 1, c: "b" }, { x: 0, y: 1, c: "w" }, { x: 1, y: 0, c: "w" }],
      solution: { kind: "move", points: [{ x: 1, y: 2 }] }, // no `captured`
    }]};
    const pb = new PuzzleBank(plainBank);
    const vm = new PlayerViewModel(pb, new ProgressStore(mem(), pb.rungRefs()), 4, 1);
    const { container } = render(<PlayerScreen player={vm} onExit={vi.fn()} />);
    const tap = Array.from(container.querySelectorAll("[data-tap]")).find(
      (t) => t.getAttribute("cx") === "64" && t.getAttribute("cy") === "104", // (1,2)
    );
    fireEvent.click(tap!); // solve (1,2)
    expect(screen.getByText(/Correct/)).toBeDefined();
    expect(screen.queryByRole("button", { name: /Next move/i })).toBeNull();
  });
});
