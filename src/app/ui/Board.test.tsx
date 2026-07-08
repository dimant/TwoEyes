import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { Board } from "./Board";
import type { Puzzle } from "../model/types";

const capture: Puzzle = {
  id: "t2-r1-0", topic: 2, rung: 1, mode: "M", size: 5, toPlay: "b", prompt: "",
  stones: [{ x: 2, y: 2, c: "w" }, { x: 1, y: 2, c: "b" }, { x: 3, y: 2, c: "b" }, { x: 2, y: 1, c: "b" }],
  solution: { kind: "move", points: [{ x: 2, y: 3 }] }, captured: [{ x: 2, y: 2 }],
};

describe("Board", () => {
  it("renders one <circle class=stone> per stone", () => {
    const { container } = render(<Board puzzle={capture} />);
    expect(container.querySelectorAll("circle.stone").length).toBe(4);
  });

  it("exposes a tap target per empty intersection when onTapPoint is set", () => {
    const onTap = vi.fn();
    const { container } = render(<Board puzzle={capture} onTapPoint={onTap} />);
    const targets = container.querySelectorAll("[data-tap]");
    expect(targets.length).toBe(5 * 5 - 4); // empty points
    (targets[0] as SVGElement).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onTap).toHaveBeenCalledTimes(1);
  });

  it("does not render tap targets without onTapPoint", () => {
    const { container } = render(<Board puzzle={capture} />);
    expect(container.querySelectorAll("[data-tap]").length).toBe(0);
  });

  it("renders the override stones instead of the puzzle stones when `stones` is set", () => {
    const override = [
      { x: 0, y: 0, c: "b" as const },
      { x: 1, y: 1, c: "w" as const },
    ];
    const { container } = render(<Board puzzle={capture} stones={override} />);
    expect(container.querySelectorAll("circle.stone").length).toBe(2);
  });

  it("rings the breaker point only when revealed", () => {
    const esc: Puzzle = {
      id: "t9", topic: 9, rung: 1, mode: "Q-binary", size: 9, toPlay: "b", prompt: "",
      stones: [{ x: 5, y: 5, c: "w" }, { x: 3, y: 7, c: "w" }],
      solution: { kind: "choice", id: "escapes" }, breaker: { x: 3, y: 7 },
    };
    const { container: hidden } = render(<Board puzzle={esc} breaker={undefined} />);
    expect(hidden.querySelectorAll("circle.breaker").length).toBe(0);
    const { container: shown } = render(<Board puzzle={esc} reveal breaker={esc.breaker} />);
    expect(shown.querySelectorAll("circle.breaker").length).toBe(1);
  });
});
