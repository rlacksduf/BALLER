import { localized } from "../i18n";
import { setTheme, useTheme } from "../services/theme";
export default function ThemeToggle() {
  const dark = useTheme() === "dark";
  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label={localized("다크모드", "Dark mode")}
      aria-pressed={dark}
      title={
        dark
          ? localized("기본 모드로 전환", "Switch to blue mode")
          : localized("다크모드로 전환", "Switch to dark mode")
      }
      onClick={() => setTheme(dark ? "blue" : "dark")}
    >
      <svg
        width="19"
        height="19"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {dark ? (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </>
        ) : (
          <path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z" />
        )}
      </svg>
      <span>{localized("다크모드", "Dark mode")}</span>
    </button>
  );
}
