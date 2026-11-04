import { apiRequest } from "./apiRequest.ts";
import { getCatalog, savePlayer, safeLogo } from "./catalog.ts";
export type ApiPlayer = { id: number; name: string; logo?: string | null };
export type CompetitionStats = {
  club: string;
  league: string;
  season: string;
  type: string;
  goals: number | null;
  assists: number | null;
  gamesPlayed: number | null;
  minutesPlayed: number | null;
};
async function get(path: string, signal?: AbortSignal): Promise<unknown> {
  return apiRequest(new URLSearchParams(path), signal);
}
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;
export async function searchApiPlayers(
  name: string,
  signal?: AbortSignal,
  offset = 0,
): Promise<ApiPlayer[]> {
  const body = await get(
    new URLSearchParams({ name, offset: String(offset) }).toString(),
    signal,
  );
  if (!record(body) || !Array.isArray(body.data))
    throw new Error("선수 목록 응답 형식이 올바르지 않습니다.");
  return body.data.map((row: unknown) => {
    if (
      !record(row) ||
      !Number.isSafeInteger(row.id) ||
      typeof row.name !== "string"
    )
      throw new Error("선수 정보 형식이 올바르지 않습니다.");
    return { id: row.id as number, name: row.name, logo: safeLogo(row.logo) };
  });
}
export async function getApiPlayerDetails(
  id: number,
  signal?: AbortSignal,
): Promise<{ name: string; stats: CompetitionStats[] }> {
  let body: unknown;
  try {
    body = await get(
      new URLSearchParams({ id: String(id) }).toString(),
      signal,
    );
  } catch (error) {
    if (signal?.aborted) throw error;
    const saved = getCatalog().find((player) => player.id === id);
    if (saved?.stats.length) return { name: saved.name, stats: saved.stats };
    throw error;
  }
  const player = Array.isArray(body)
    ? body.find((row) => record(row) && row.id === id)
    : body;
  if (!record(player) || !Array.isArray(player.perCompetition))
    throw new Error("선수 통계 응답 형식이 올바르지 않습니다.");
  const number = (value: unknown) =>
    typeof value === "number" && Number.isFinite(value) && value >= 0
      ? value
      : null;
  const stats = player.perCompetition.map((row: unknown) => {
    if (
      !record(row) ||
      !["club", "league", "season", "type"].every(
        (key) => typeof row[key] === "string",
      )
    )
      throw new Error("시즌 통계 형식이 올바르지 않습니다.");
    return {
      club: row.club as string,
      league: row.league as string,
      season: row.season as string,
      type: row.type as string,
      goals: number(row.goals),
      assists: number(row.assists),
      gamesPlayed: number(row.gamesPlayed),
      minutesPlayed: number(row.minutesPlayed),
    };
  });
  const result = {
    name:
      typeof player.fullName === "string"
        ? player.fullName
        : typeof player.name === "string"
          ? player.name
          : `Player ${id}`,
    stats,
  };
  savePlayer(id, { name: result.name, stats, logo: safeLogo(player.logo) });
  return result;
}

export type PlayerProfile = {
  name: string;
  birthDate: string | null;
  citizenship: string | null;
  height: string | null;
  foot: string | null;
  position: string | null;
  secondary: string | null;
  club: string | null;
  joined: string | null;
  contract: string | null;
};
export function parseProfile(body: unknown, id: number): PlayerProfile {
  const player = Array.isArray(body)
    ? body.find((row) => record(row) && row.id === id)
    : body;
  if (!record(player) || player.id !== id)
    throw new Error("선수 프로필을 찾을 수 없습니다.");
  const profile = record(player.profile) ? player.profile : {};
  const position = record(profile.position) ? profile.position : {};
  const club = record(profile.club) ? profile.club : {};
  const text = (value: unknown) =>
    typeof value === "string" && value.trim() ? value : null;
  return {
    name: text(player.fullName) ?? text(player.name) ?? `Player ${id}`,
    birthDate: text(profile.birthDate),
    citizenship: text(profile.citizenship),
    height: text(profile.height),
    foot: text(profile.foot),
    position: text(position.main),
    secondary: text(position.secondary),
    club: text(club.current),
    joined: text(club.joinedAt),
    contract: text(club.contractExpiry),
  };
}
export async function getPlayerProfile(id: number, signal?: AbortSignal) {
  let profile: PlayerProfile;
  try {
    profile = parseProfile(
      await get(
        new URLSearchParams({ id: String(id), action: "profile" }).toString(),
        signal,
      ),
      id,
    );
  } catch (error) {
    if (signal?.aborted) throw error;
    const saved = getCatalog().find((player) => player.id === id)?.profile;
    if (saved) return saved;
    throw error;
  }
  savePlayer(id, { name: profile.name, profile });
  return profile;
}
