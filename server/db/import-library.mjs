import { normalizePayload } from "./normalize.mjs";
export function libraryPlan(input) {
  if (
    !input ||
    !Array.isArray(input.players) ||
    input.players.length < 1 ||
    input.players.length > 100
  )
    throw new Error("선수 1~100명의 저장 기록이 필요합니다.");
  const seen = new Set();
  const plan = {
    provider: "highlightly",
    path: "/library/import",
    players: [],
    teams: [],
    matches: [],
    seasons: [],
    stats: [],
  };
  for (const player of input.players) {
    if (
      !player ||
      !Number.isSafeInteger(player.id) ||
      player.id <= 0 ||
      player.id > 999999999999 ||
      typeof player.name !== "string" ||
      !player.name.trim() ||
      player.name.length > 200 ||
      !Array.isArray(player.stats) ||
      player.stats.length > 500 ||
      seen.has(player.id)
    )
      throw new Error("선수 저장 기록 형식을 확인해 주세요.");
    seen.add(player.id);
    const p = player.profile;
    const profile = p
      ? {
          fullName: player.name,
          birthDate: p.birthDate,
          citizenship: p.citizenship,
          height: p.height,
          foot: p.foot,
          position: { main: p.position, secondary: p.secondary },
          club: {
            current: p.club,
            joinedAt: p.joined,
            contractExpiry: p.contract,
          },
        }
      : null;
    const rows = player.stats.map((row) => {
      if (
        !row ||
        !["club", "league", "season", "type"].every(
          (key) =>
            typeof row[key] === "string" &&
            row[key].length > 0 &&
            row[key].length <= 200,
        )
      )
        throw new Error("시즌 기록 형식이 올바르지 않습니다.");
      return {
        club: row.club,
        league: row.league,
        season: row.season,
        type: row.type,
        gamesPlayed: row.gamesPlayed,
        minutesPlayed: row.minutesPlayed,
        goals: row.goals,
        assists: row.assists,
      };
    });
    const body = [
      {
        id: player.id,
        name: player.name,
        fullName: player.name,
        logo: player.logo,
        profile,
        perCompetition: rows,
      },
    ];
    const normalized = normalizePayload(
      `/players/${player.id}/statistics`,
      body,
      { scope: "browser-library" },
    );
    plan.players.push(...normalized.players);
    plan.seasons.push(...normalized.seasons);
  }
  return plan;
}
