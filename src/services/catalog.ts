import type { CompetitionStats, PlayerProfile } from "./football";
import type { Aggregate } from "../utils/scouting";
export type CatalogPlayer = {
  id: number;
  name: string;
  stats: CompetitionStats[];
  profile: PlayerProfile | null;
  logo: string | null;
  updatedAt: string;
  aggregate?: { season: string; competition: string; data: Aggregate };
};
const key = "baller-catalog-v1",
  event = "baller-catalog-change";
let previous: string | null | undefined,
  cache: CatalogPlayer[] = [];
export function getCatalog(): CatalogPlayer[] {
  if (typeof localStorage === "undefined") return cache;
  try {
    const raw = localStorage.getItem(key);
    if (raw === previous) return cache;
    previous = raw;
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    cache = Array.isArray(parsed)
      ? parsed.filter(
          (row): row is CatalogPlayer =>
            row &&
            typeof row === "object" &&
            Number.isSafeInteger(row.id) &&
            typeof row.name === "string" &&
            Array.isArray(row.stats) &&
            typeof row.updatedAt === "string",
        )
      : [];
  } catch {
    cache = [];
  }
  return cache;
}
export function savePlayer(
  id: number,
  patch: Partial<Omit<CatalogPlayer, "id">>,
) {
  if (typeof localStorage === "undefined") return;
  const players = getCatalog(),
    existing = players.find((p) => p.id === id);
  const player: CatalogPlayer = {
    id,
    name: `Player ${id}`,
    stats: [],
    profile: null,
    logo: null,
    ...existing,
    ...patch,
    updatedAt: patch.updatedAt ?? new Date().toISOString(),
  };
  try {
    localStorage.setItem(
      key,
      JSON.stringify(
        [player, ...players.filter((p) => p.id !== id)].slice(0, 100),
      ),
    );
    window.dispatchEvent(new Event(event));
  } catch {
    /* 저장 공간 부족 시 API 화면은 계속 동작합니다. */
  }
}
export function subscribeCatalog(listener: () => void) {
  window.addEventListener(event, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(event, listener);
    window.removeEventListener("storage", listener);
  };
}
export function safeLogo(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "highlightly.net"
      ? url.href
      : null;
  } catch {
    return null;
  }
}
