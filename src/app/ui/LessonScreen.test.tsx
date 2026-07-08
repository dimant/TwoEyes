import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LessonScreen } from "./LessonScreen";
import { lessonFor } from "../content/lessons";

describe("LessonScreen", () => {
  it("shows the lesson title, caption and body, and dismisses on 'Start practicing'", () => {
    const lesson = lessonFor(10)!; // Net
    const onDismiss = vi.fn();
    render(<LessonScreen lesson={lesson} onDismiss={onDismiss} />);
    expect(screen.getByText(lesson.title)).toBeDefined();
    expect(screen.getByText(lesson.diagram.caption)).toBeDefined();
    expect(screen.getByText(lesson.body[0]!)).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: /Start practicing/ }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("uses a custom dismiss label when provided (map browser reads 'Back to map')", () => {
    const lesson = lessonFor(10)!;
    const onDismiss = vi.fn();
    render(<LessonScreen lesson={lesson} onDismiss={onDismiss} dismissLabel="Back to map" />);
    expect(screen.queryByRole("button", { name: /Start practicing/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Back to map/ }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
