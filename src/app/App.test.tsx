import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { App } from "./App";

describe("App", () => {
  beforeEach(() => window.localStorage.clear());

  it("shows the topic map and opens a topic into the player", () => {
    render(<App />);
    expect(screen.getByText(/Capturing basics/i)).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: /Liberties/i }));
    fireEvent.click(screen.getByRole("button", { name: /Start practicing/ }));
    expect(screen.getByText("● Black to play")).toBeDefined();
  });

  it("opens a lesson from the map and returns to the map on dismiss", () => {
    render(<App />);
    fireEvent.click(screen.getByTestId("learn-1"));
    // lesson takes over: the dialog shows and the map is gone
    expect(screen.getByRole("dialog")).toBeDefined();
    expect(screen.queryByText(/Capturing basics/i)).toBeNull();
    // the map browser's dismiss reads "Back to map" (not "Start practicing") and returns to the map
    expect(screen.queryByRole("button", { name: /Start practicing/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Back to map/ }));
    expect(screen.getByText(/Capturing basics/i)).toBeDefined();
  });

  it("viewing a lesson from the map marks it seen, so entering the topic skips the auto-lesson", () => {
    render(<App />);
    fireEvent.click(screen.getByTestId("learn-1"));           // view topic 1's lesson
    fireEvent.click(screen.getByRole("button", { name: /Back to map/ })); // dismiss -> marks seen
    fireEvent.click(screen.getByRole("button", { name: /Liberties/i }));       // enter topic 1
    // lesson does NOT auto-open — we land straight in practice
    expect(screen.getByText("● Black to play")).toBeDefined();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
