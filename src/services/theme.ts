import { useSyncExternalStore } from "react";
export type Theme = "blue" | "dark";
const storageKey = "baller-theme";
const listeners = new Set<() => void>();
let theme: Theme = "blue";
try {
  if (localStorage.getItem(storageKey) === "dark") theme = "dark";
} catch {
  /* Keep the default theme when storage is unavailable. */
}
function apply() {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme =
    theme === "dark" ? "dark" : "normal";
}
apply();
export function setTheme(value: Theme) {
  theme = value;
  apply();
  try {
    localStorage.setItem(storageKey, value);
  } catch {
    /* Selection still works for the current session. */
  }
  listeners.forEach((listener) => listener());
}
export function useTheme() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => theme,
  );
}
window.addEventListener("storage", (event) => {
  if (event.key !== storageKey) return;
  theme = event.newValue === "dark" ? "dark" : "blue";
  apply();
  listeners.forEach((listener) => listener());
});
