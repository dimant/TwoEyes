import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NumberPad, YesNo } from "./inputs";

describe("inputs", () => {
  it("NumberPad reports the tapped number", () => {
    const onPick = vi.fn();
    render(<NumberPad onPick={onPick} />);
    fireEvent.click(screen.getByRole("button", { name: "3" }));
    expect(onPick).toHaveBeenCalledWith(3);
  });

  it("YesNo maps buttons to solution ids", () => {
    const onPick = vi.fn();
    render(<YesNo onPick={onPick} />);
    fireEvent.click(screen.getByRole("button", { name: /self-atari/i }));
    expect(onPick).toHaveBeenCalledWith("self-atari");
    fireEvent.click(screen.getByRole("button", { name: /safe/i }));
    expect(onPick).toHaveBeenCalledWith("safe");
  });
});
