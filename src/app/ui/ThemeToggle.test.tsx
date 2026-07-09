import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeToggle } from "./ThemeToggle";
import { ThemeStore } from "../model/theme";

function mem() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
}

describe("ThemeToggle", () => {
  it("shows the current mode in its accessible name and cycles on click", () => {
    const store = new ThemeStore(mem());
    render(<ThemeToggle store={store} />);
    expect(screen.getByRole("button", { name: /Theme: system/ })).toBeDefined();
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("button", { name: /Theme: light/ })).toBeDefined();
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("button", { name: /Theme: dark/ })).toBeDefined();
  });
});
