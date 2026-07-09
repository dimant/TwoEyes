import { describe, it, expect } from "vitest";
import { ThemeStore, applyTheme, THEME_KEY } from "./theme";
import type { KeyValue } from "./progress";

function mem(init?: Record<string, string>): KeyValue {
  const m = new Map<string, string>(Object.entries(init ?? {}));
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) };
}

describe("ThemeStore", () => {
  it("defaults to system when storage is empty", () => {
    expect(new ThemeStore(mem()).snapshot.theme).toBe("system");
  });

  it("reads a persisted theme", () => {
    expect(new ThemeStore(mem({ [THEME_KEY]: "dark" })).snapshot.theme).toBe("dark");
  });

  it("falls back to system for an invalid stored value", () => {
    expect(new ThemeStore(mem({ [THEME_KEY]: "bogus" })).snapshot.theme).toBe("system");
  });

  it("cycle() advances system->light->dark->system and persists each step", () => {
    const storage = mem();
    const s = new ThemeStore(storage);
    s.cycle();
    expect(s.snapshot.theme).toBe("light");
    expect(storage.getItem(THEME_KEY)).toBe("light");
    s.cycle();
    expect(s.snapshot.theme).toBe("dark");
    expect(storage.getItem(THEME_KEY)).toBe("dark");
    s.cycle();
    expect(s.snapshot.theme).toBe("system");
    expect(storage.getItem(THEME_KEY)).toBe("system");
  });
});

describe("applyTheme", () => {
  it("sets data-theme for the forced modes", () => {
    const el = { dataset: {} as { theme?: string } };
    applyTheme("light", el);
    expect(el.dataset.theme).toBe("light");
    applyTheme("dark", el);
    expect(el.dataset.theme).toBe("dark");
  });

  it("removes data-theme for system", () => {
    const el = { dataset: { theme: "dark" } as { theme?: string } };
    applyTheme("system", el);
    expect(el.dataset.theme).toBeUndefined();
  });
});
