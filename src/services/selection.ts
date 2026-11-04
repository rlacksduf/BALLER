export type Selection = { id: number; name: string };
const key = "baller-selection-v1",
  event = "baller-selection-change";
let previous: string | null | undefined,
  cache: Selection[] = [];
export function getSelection(): Selection[] {
  try {
    const raw = localStorage.getItem(key);
    if (previous === raw) return cache;
    previous = raw;
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    cache = Array.isArray(parsed)
      ? parsed
          .filter(
            (p): p is Selection =>
              p &&
              typeof p === "object" &&
              Number.isSafeInteger(p.id) &&
              p.id > 0 &&
              typeof p.name === "string",
          )
          .filter(
            (p, index, items) =>
              items.findIndex((other) => other.id === p.id) === index,
          )
          .slice(0, 2)
      : [];
    return cache;
  } catch {
    return cache;
  }
}
export function setSelection(items: Selection[]) {
  try {
    localStorage.setItem(key, JSON.stringify(items.slice(0, 2)));
    window.dispatchEvent(new Event(event));
  } catch {
    /* 저장 제한 상태에서는 현재 화면을 유지합니다. */
  }
}
export function addSelection(player: Selection): "added" | "full" | "exists" {
  const items = getSelection();
  if (items.some((p) => p.id === player.id)) return "exists";
  if (items.length >= 2) return "full";
  setSelection([...items, player]);
  return "added";
}
export function subscribeSelection(listener: () => void) {
  window.addEventListener(event, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(event, listener);
    window.removeEventListener("storage", listener);
  };
}
