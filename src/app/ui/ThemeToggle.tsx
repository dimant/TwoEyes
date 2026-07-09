import { THEME_ORDER, type Theme, type ThemeStore } from "../model/theme";
import { useViewModel } from "../useViewModel";

const ICON: Record<Theme, string> = { system: "◐", light: "☀", dark: "☾" };
const nextTheme = (t: Theme): Theme =>
  THEME_ORDER[(THEME_ORDER.indexOf(t) + 1) % THEME_ORDER.length]!;

export function ThemeToggle({ store }: { store: ThemeStore }) {
  const { theme } = useViewModel(store);
  return (
    <button
      className="theme-toggle"
      onClick={() => store.cycle()}
      aria-label={`Theme: ${theme}. Switch to ${nextTheme(theme)}.`}
      title={`Theme: ${theme}`}
    >
      <span aria-hidden="true">{ICON[theme]}</span>
    </button>
  );
}
