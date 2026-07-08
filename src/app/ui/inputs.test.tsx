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

  it("YesNo renders the supplied options and reports the tapped id", () => {
    const onPick = vi.fn();
    render(<YesNo options={[{ id: "caught", label: "Caught" }, { id: "escapes", label: "Escapes" }]} onPick={onPick} />);
    fireEvent.click(screen.getByRole("button", { name: /caught/i }));
    expect(onPick).toHaveBeenCalledWith("caught");
    fireEvent.click(screen.getByRole("button", { name: /escapes/i }));
    expect(onPick).toHaveBeenCalledWith("escapes");
  });
});
