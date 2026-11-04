import type { Aggregate } from "./scouting";
import type { CatalogPlayer } from "../services/catalog";
import { getRole } from "./roleScores.ts";
export function percentile(value: number, values: number[]): number | null {
  const valid = values.filter(Number.isFinite);
  if (valid.length < 5 || !Number.isFinite(value)) return null;
  const below = valid.filter((v) => v < value).length,
    equal = valid.filter((v) => v === value).length;
  return Math.round(((below + equal * 0.5) / valid.length) * 100);
}
export function metricPercentile(
  data: Aggregate,
  key: string,
  players: CatalogPlayer[],
  season: string,
  competition: string,
): { value: number | null; size: number } {
  const role = getRole(data.position),
    value = data.per90[key];
  if (
    !role ||
    data.minutes === null ||
    data.minutes < 270 ||
    data.count < 3 ||
    typeof value !== "number"
  )
    return { value: null, size: 0 };
  const values = players.flatMap((p) => {
    const entry = p.aggregate;
    if (!entry || entry.season !== season || entry.competition !== competition)
      return [];
    const other = entry.data;
    if (
      getRole(other.position) !== role ||
      other.count < 3 ||
      other.minutes === null ||
      other.minutes < 270 ||
      typeof other.per90[key] !== "number"
    )
      return [];
    return [other.per90[key]!];
  });
  return { value: percentile(value, values), size: values.length };
}
