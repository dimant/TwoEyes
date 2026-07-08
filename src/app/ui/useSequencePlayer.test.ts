// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSequencePlayer } from "./useSequencePlayer";
import type { Stone, DemoMove } from "../model/types";

const initial: Stone[] = [{ x: 0, y: 0, c: "w" }];
const payoff: DemoMove[] = [
  { x: 1, y: 0, c: "b" },
  { x: 0, y: 1, c: "b", captures: [{ x: 0, y: 0 }] },
];

describe("useSequencePlayer", () => {
  it("opens at the initial position with no moves played", () => {
    const { result } = renderHook(() => useSequencePlayer(initial, payoff));
    expect(result.current.step).toBe(0);
    expect(result.current.stones).toEqual(initial);
    expect(result.current.atEnd).toBe(false);
  });

  it("next() plays exactly one move per call and applies captures", () => {
    const { result } = renderHook(() => useSequencePlayer(initial, payoff));
    act(() => result.current.next());
    expect(result.current.step).toBe(1);
    expect(result.current.stones).toHaveLength(2); // white + placed black
    expect(result.current.atEnd).toBe(false);
    act(() => result.current.next());
    expect(result.current.step).toBe(2);
    expect(result.current.stones).toHaveLength(2); // white captured, second black placed
    expect(result.current.stones.every((s) => s.c === "b")).toBe(true);
    expect(result.current.atEnd).toBe(true);
  });

  it("next() past the end is a no-op", () => {
    const { result } = renderHook(() => useSequencePlayer(initial, payoff));
    act(() => { result.current.next(); result.current.next(); result.current.next(); });
    expect(result.current.step).toBe(2);
    expect(result.current.atEnd).toBe(true);
  });

  it("replay() returns to the initial position", () => {
    const { result } = renderHook(() => useSequencePlayer(initial, payoff));
    act(() => { result.current.next(); result.current.next(); });
    expect(result.current.atEnd).toBe(true);
    act(() => result.current.replay());
    expect(result.current.step).toBe(0);
    expect(result.current.stones).toEqual(initial);
    expect(result.current.atEnd).toBe(false);
  });
});
