import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { App } from "./App";

describe("App", () => {
  it("shows the topic map and opens a topic into the player", () => {
    render(<App />);
    expect(screen.getByText(/Capturing basics/i)).toBeDefined();
    // topic 1 is unlocked; click it — its lesson auto-opens on first entry
    fireEvent.click(screen.getByRole("button", { name: /Liberties/i }));
    fireEvent.click(screen.getByRole("button", { name: /Start practicing/ }));
    // dismissing the lesson drops into the player, which shows a prompt
    expect(screen.getByText("● Black to play")).toBeDefined();
  });
});
