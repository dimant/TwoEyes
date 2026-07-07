import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { App } from "./App";

describe("App", () => {
  it("shows the topic map and opens a topic into the player", () => {
    render(<App />);
    expect(screen.getByText(/Capturing basics/i)).toBeDefined();
    // topic 1 is unlocked; click it
    fireEvent.click(screen.getByRole("button", { name: /Liberties/i }));
    // player screen shows a prompt (any puzzle prompt text ends with a period)
    expect(screen.getByText("● Black to play")).toBeDefined();
  });
});
