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

    const { rerender } = render(<MapScreen map={map} onOpen={onOpen} />);
    fireEvent.click(screen.getByRole("button", { name: /Liberties/ }));
    expect(onOpen).toHaveBeenLastCalledWith(1, 1);

    for (let i = 0; i < MASTERY; i++) progress.record(1, 1, true);
    map.refresh();
    rerender(<MapScreen map={map} onOpen={onOpen} />);
    fireEvent.click(screen.getByRole("button", { name: /Liberties/ }));
    expect(onOpen).toHaveBeenLastCalledWith(1, 2);
  });
});
