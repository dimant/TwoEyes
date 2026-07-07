import { describe, it, expect } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { Observable } from "./vm/observable";
import { useViewModel } from "./useViewModel";

class Counter extends Observable<{ n: number }> {
  constructor() { super({ n: 0 }); }
  inc() { this.set({ n: this.snapshot.n + 1 }); }
}

function View({ vm }: { vm: Counter }) {
  const s = useViewModel(vm);
  return <div>count: {s.n}</div>;
}

describe("useViewModel", () => {
  it("re-renders when the view model emits", () => {
    const vm = new Counter();
    render(<View vm={vm} />);
    expect(screen.getByText("count: 0")).toBeDefined();
    act(() => vm.inc());
    expect(screen.getByText("count: 1")).toBeDefined();
  });
});
