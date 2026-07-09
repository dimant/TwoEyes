import { Observable } from "../vm/observable";
import type { KeyValue } from "./progress";

export type Theme = "system" | "light" | "dark";

// The order the top-bar button cycles through.
export const THEME_ORDER: Theme[] = ["system", "light", "dark"];
export const THEME_KEY = "two-eyes:theme";

function isTheme(v: string | null): v is Theme {
  return v === "system" || v === "light" || v === "dark";
}

// Holds the chosen theme and persists it. Headless: no DOM access — applyTheme (below)
// is the single place that touches the document, wired up by App.
export class ThemeStore extends Observable<{ theme: Theme }> {
  constructor(private readonly storage: KeyValue) {
    const stored = storage.getItem(THEME_KEY);
    super({ theme: isTheme(stored) ? stored : "system" });
  }

  cycle(): void {
    const cur = this.snapshot.theme;
    const next = THEME_ORDER[(THEME_ORDER.indexOf(cur) + 1) % THEME_ORDER.length]!;
    this.storage.setItem(THEME_KEY, next);
    this.set({ theme: next });
  }
}

// Applies a theme to a root element: forced modes set data-theme (the stylesheet's
// :root[data-theme=...] overrides win); "system" clears it so @media prefers-color-scheme
// resumes control. Takes the root as a parameter so the model stays DOM-free and testable.
export function applyTheme(theme: Theme, root: { dataset: { theme?: string } }): void {
  if (theme === "system") delete root.dataset.theme;
  else root.dataset.theme = theme;
}
