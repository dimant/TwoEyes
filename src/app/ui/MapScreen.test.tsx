import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MapScreen } from "./MapScreen";
import { MapViewModel } from "../vm/map-vm";
import { PuzzleBank } from "../model/bank";
import { ProgressStore, MASTERY } from "../model/progress";
import type { Bank, Puzzle } from "../model/types";

function mk(topic: number, rung: number, id: string): Puzzle {
  return { id, topic, rung, mode: "M", size: 5, stones: [], toPlay: "b", prompt: "",
    solution: { kind: "move", points: [{ x: 1, y: 1 }] } };
}
const bank: Bank = { seed: 0, stage: "A", puzzles: [mk(1, 1, "a"), mk(1, 2, "b")] };
function mem() { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }; }

describe("MapScreen rung selection", () => {
  it("opens rung 1 when nothing is cleared, rung 2 once rung 1 is cleared", () => {
    const pb = new PuzzleBank(bank);
    const progress = new ProgressStore(mem(), pb.rungRefs());
    const map = new MapViewModel(pb, progress);
    const onOpen = vi.fn();
    const onLearn = vi.fn();

    const { rerender } = render(<MapScreen map={map} onOpen={onOpen} onLearn={onLearn} />);
    fireEvent.click(screen.getByRole("button", { name: /Liberties/ }));
    expect(onOpen).toHaveBeenLastCalledWith(1, 1);

    for (let i = 0; i < MASTERY; i++) progress.record(1, 1, true);
    map.refresh();
    rerender(<MapScreen map={map} onOpen={onOpen} onLearn={onLearn} />);
    fireEvent.click(screen.getByRole("button", { name: /Liberties/ }));
    expect(onOpen).toHaveBeenLastCalledWith(1, 2);
  });
});

describe("MapScreen skip-ahead", () => {
  const bank2: Bank = { seed: 0, stage: "A", puzzles: [
    mk(1, 1, "a"), mk(1, 2, "b"), mk(2, 1, "c"), mk(2, 2, "d"), mk(3, 1, "e"), mk(3, 2, "f"),
  ] };
  function setup() {
    const pb = new PuzzleBank(bank2);
    const map = new MapViewModel(pb, new ProgressStore(mem(), pb.rungRefs()));
    const onOpen = vi.fn();
    const onLearn = vi.fn();
    render(<MapScreen map={map} onOpen={onOpen} onLearn={onLearn} />);
    return { map, locked: screen.getByRole("button", { name: /Capture a stone/ }), onOpen, onLearn }; // topic 2, locked
  }

  const unlocked = (map: MapViewModel, topic: number) =>
    map.snapshot.rows.find((r) => r.topic === topic)?.unlocked ?? false;

  it("ignores single taps but jumps in on three quick taps (touch-safe, no MouseEvent.detail)", () => {
    const { locked, onOpen } = setup();
    fireEvent.click(locked); // each tap reports detail:1 on touch — must still count
    expect(onOpen).not.toHaveBeenCalled();
    fireEvent.click(locked);
    expect(onOpen).not.toHaveBeenCalled();
    fireEvent.click(locked); // third tap within the window -> jump in
    expect(onOpen).toHaveBeenCalledWith(2, 1);
  });

  it("three quick taps persistently unlock the tapped lesson and all prior ones", () => {
    const { map } = setup();
    const t3 = screen.getByRole("button", { name: /Capture a group/ }); // topic 3, locked
    expect(unlocked(map, 3)).toBe(false);
    fireEvent.click(t3);
    fireEvent.click(t3);
    fireEvent.click(t3);
    expect(unlocked(map, 1)).toBe(true);
    expect(unlocked(map, 2)).toBe(true); // prior lesson unlocked too
    expect(unlocked(map, 3)).toBe(true);
  });

  it("does not jump in when the third tap lands on a different locked topic", () => {
    const { onOpen } = setup();
    const t2 = screen.getByRole("button", { name: /Capture a stone/ });
    const t3 = screen.getByRole("button", { name: /Capture a group/ });
    fireEvent.click(t2);
    fireEvent.click(t2);
    fireEvent.click(t3); // resets — only 1 tap on t3
    expect(onOpen).not.toHaveBeenCalled();
  });
});

describe("MapScreen lessons browser", () => {
  const bank3: Bank = { seed: 0, stage: "A", puzzles: [
    mk(1, 1, "a"), mk(1, 2, "b"), mk(2, 1, "c"), mk(2, 2, "d"), mk(3, 1, "e"), mk(3, 2, "f"),
  ] };
  function setup() {
    const pb = new PuzzleBank(bank3);
    const map = new MapViewModel(pb, new ProgressStore(mem(), pb.rungRefs()));
    const onOpen = vi.fn();
    const onLearn = vi.fn();
    render(<MapScreen map={map} onOpen={onOpen} onLearn={onLearn} />);
    return { map, onOpen, onLearn };
  }
  const unlocked = (map: MapViewModel, topic: number) =>
    map.snapshot.rows.find((r) => r.topic === topic)?.unlocked ?? false;

  it("shows a Learn control on every card, including locked ones", () => {
    setup();
    expect(screen.getByTestId("learn-1")).toBeDefined(); // topic 1 unlocked
    expect(screen.getByTestId("learn-2")).toBeDefined(); // topic 2 locked
    expect(screen.getByTestId("learn-3")).toBeDefined(); // topic 3 locked
  });

  it("clicking Learn calls onLearn with the topic without opening or unlocking it", () => {
    const { map, onOpen, onLearn } = setup();
    fireEvent.click(screen.getByTestId("learn-2")); // locked topic
    expect(onLearn).toHaveBeenCalledWith(2);
    expect(onOpen).not.toHaveBeenCalled();
    expect(unlocked(map, 2)).toBe(false);
  });

  it("the Learn control does not match title-based button queries", () => {
    setup();
    // exactly one button matches the title — the card's main control, not Learn
    expect(screen.getAllByRole("button", { name: /Liberties/ })).toHaveLength(1);
  });
});
