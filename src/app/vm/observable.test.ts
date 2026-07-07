import { describe, it, expect } from "vitest";
import { Observable } from "./observable";

class Counter extends Observable<{ n: number }> {
  constructor() { super({ n: 0 }); }
  inc() { this.set({ n: this.snapshot.n + 1 }); }
}

describe("Observable", () => {
  it("exposes an immutable snapshot and notifies subscribers on change", () => {
    const c = new Counter();
    expect(c.snapshot).toEqual({ n: 0 });
    let calls = 0;
    const prev = c.snapshot;
    c.subscribe(() => calls++);
    c.inc();
    expect(calls).toBe(1);
    expect(c.snapshot).toEqual({ n: 1 });
    expect(prev).toEqual({ n: 0 }); // old snapshot not mutated
  });

  it("unsubscribe stops notifications", () => {
    const c = new Counter();
    let calls = 0;
    const off = c.subscribe(() => calls++);
    c.inc();
    off();
    c.inc();
    expect(calls).toBe(1);
  });
});
