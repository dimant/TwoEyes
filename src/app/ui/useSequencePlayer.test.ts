// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSequencePlayer } from "./useSequencePlayer";
import type { Stone, DemoMove } from "../model/types";

const initial: Stone[] = [{ x: 0, y: 0, c: "w" }];
const payoff: DemoMove[] = [
  { x: 1, y: 0, c: "b" },
  { x: 0, y: 1, c: "b", captures: [{ x: 0, y: 0 }] },
];

describe("useSequencePlayer", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("auto-advances one move per tick and applies captures", () => {
    const { result } = renderHook(() => useSequencePlayer(initial, payoff, 100));
    expect(result.current.stones).toHaveLength(1);
    expect(result.current.playing).toBe(true);
    act(() => { vi.advanceTimersByTime(100); });
    expect(result.current.stones).toHaveLength(2);
    act(() => { vi.advanceTimersByTime(100); });
    expect(result.current.stones).toHaveLength(2);
    expect(result.current.stones.every((s) => s.c === "b")).toBe(true);
    expect(result.current.done).toBe(true);
    expect(result.current.playing).toBe(false);
  });

  it("replay restarts from the initial position", () => {
    const { result } = renderHook(() => useSequencePlayer(initial, payoff, 100));
    act(() => { vi.advanceTimersByTime(200); });
    expect(result.current.done).toBe(true);
    act(() => { result.current.replay(); });
    expect(result.current.stones).toHaveLength(1);
    expect(result.current.playing).toBe(true);
  });

  it("jumps to the final position under reduced motion", () => {
    (window as unknown as { matchMedia: unknown }).matchMedia = vi.fn().mockReturnValue({ matches: true });
    try {
      const { result } = renderHook(() => useSequencePlayer(initial, payoff, 100));
      expect(result.current.done).toBe(true);
      expect(result.current.stones.every((s) => s.c === "b")).toBe(true);
    } finally {
      delete (window as unknown as { matchMedia?: unknown }).matchMedia;
    }
  });
});
