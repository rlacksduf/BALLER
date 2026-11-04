import { apiRequest } from "./apiRequest.ts";
import { seasonStart } from "../utils/seasons.ts";
export type Match = {
  id: number;
  date: string;
  home: string;
  away: string;
  score: string;
};
export type MatchPlayer = {
  name: string;
  position: string;
  minutes: number | null;
  rating: string;
  stats: Record<string, number | string | null>;
};
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
async function get(
  params: Record<string, string>,
  signal: AbortSignal,
): Promise<unknown> {
  return apiRequest(new URLSearchParams(params), signal);
}
export async function getMatches(
  team: string,
  league: string,
  season: string,
  signal: AbortSignal,
): Promise<{ matches: Match[]; limited: boolean }> {
  const matches: Match[] = [];
  let limited = false;
  for (const side of ["home", "away"]) {
    const body = await get(
      {
        action: "matches",
        team,
        league,
        season: String(seasonStart(season)),
        side,
      },
      signal,
    );
    if (!record(body) || !Array.isArray(body.data))
      throw new Error("경기 목록 응답 형식이 올바르지 않습니다.");
    if (
      record(body.pagination) &&
      typeof body.pagination.totalCount === "number" &&
      body.pagination.totalCount > 100
    )
      limited = true;
    for (const row of body.data) {
      if (
        !record(row) ||
        !record(row.state) ||
        !record(row.homeTeam) ||
        !record(row.awayTeam)
      )
        continue;
      if (
        ![
          "Finished",
          "Finished after penalties",
          "Finished after extra time",
        ].includes(String(row.state.description))
      )
        continue;
      if (
        typeof row.id !== "number" ||
        typeof row.date !== "string" ||
        typeof row.homeTeam.name !== "string" ||
        typeof row.awayTeam.name !== "string"
      )
        continue;
      matches.push({
        id: row.id,
        date: row.date,
        home: row.homeTeam.name,
        away: row.awayTeam.name,
        score:
          record(row.state.score) && typeof row.state.score.current === "string"
            ? row.state.score.current
            : "—",
      });
    }
  }
  return {
    matches: [
      ...new Map(matches.map((match) => [match.id, match])).values(),
    ].sort((a, b) => Date.parse(b.date) - Date.parse(a.date)),
    limited,
  };
}
export function parseMatchPlayer(
  body: unknown,
  playerId: number,
): MatchPlayer | null {
  if (!Array.isArray(body))
    throw new Error("경기 상세 응답 형식이 올바르지 않습니다.");
  for (const team of body) {
    if (!record(team) || !Array.isArray(team.players)) continue;
    const player = team.players.find(
      (row) => record(row) && row.id === playerId,
    );
    if (!record(player)) continue;
    const raw = Array.isArray(player.statistics)
      ? player.statistics[0]
      : player.statistics;
    if (!record(raw))
      throw new Error("이 선수의 경기 상세 통계가 제공되지 않았습니다.");
    const stats: Record<string, number | string | null> = {};
    for (const [key, value] of Object.entries(raw))
      stats[key] =
        (typeof value === "number" &&
          Number.isFinite(value) &&
          (value >= 0 || key === "expectedGoalsPrevented")) ||
        typeof value === "string"
          ? (value as number | string)
          : null;
    return {
      name: String(player.name ?? ""),
      position: typeof player.position === "string" ? player.position : "—",
      minutes:
        typeof player.minutesPlayed === "number" &&
        Number.isFinite(player.minutesPlayed) &&
        player.minutesPlayed >= 0
          ? player.minutesPlayed
          : null,
      rating: typeof player.matchRating === "string" ? player.matchRating : "—",
      stats,
    };
  }
  return null;
}
export async function getMatchPlayer(
  matchId: number,
  playerId: number,
  signal: AbortSignal,
) {
  return parseMatchPlayer(
    await get({ matchId: String(matchId) }, signal),
    playerId,
  );
}
