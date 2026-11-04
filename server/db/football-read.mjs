import { getRepository } from "./repository.mjs";
export async function storedFootball(url) {
  const id = url.searchParams.get("id"),
    name = url.searchParams.get("name")?.trim();
  if (id && /^\d{1,12}$/.test(id) && Number(id) > 0) {
    const repo = await getRepository(),
      player = await repo.player("highlightly", Number(id));
    if (!player) return null;
    if (url.searchParams.get("action") === "profile") {
      if (!player.profile) return null;
      return {
        status: 200,
        source: "database",
        body: [
          {
            id: Number(player.external_id),
            name: player.name,
            fullName: player.name,
            logo: player.logo,
            profile: player.profile,
          },
        ],
      };
    }
    const rows = await repo.seasons("highlightly", Number(id));
    if (!rows.length) return null;
    return {
      status: 200,
      source: "database",
      body: [
        {
          id: Number(player.external_id),
          name: player.name,
          fullName: player.name,
          logo: player.logo,
          perCompetition: rows.map((row) => ({
            club: row.club,
            league: row.league,
            season: row.season,
            type: row.competition_type,
            gamesPlayed:
              row.appearances === null ? null : Number(row.appearances),
            minutesPlayed: row.minutes === null ? null : Number(row.minutes),
            goals: row.goals === null ? null : Number(row.goals),
            assists: row.assists === null ? null : Number(row.assists),
          })),
        },
      ],
    };
  }
  if (!id && name && name.length >= 2 && name.length <= 80) {
    const rawOffset = url.searchParams.get("offset") ?? "0";
    if (!/^\d{1,5}$/.test(rawOffset) || Number(rawOffset) > 10000) return null;
    const repo = await getRepository(),
      rows = await repo.listPlayers({
        q: name,
        provider: "highlightly",
        limit: 12,
        offset: Number(rawOffset),
      });
    if (!rows.length) return null;
    return {
      status: 200,
      source: "database",
      body: {
        data: rows.map((p) => ({
          id: Number(p.external_id),
          name: p.name,
          fullName: p.name,
          logo: p.logo,
        })),
        pagination: { offset: Number(rawOffset), limit: 12 },
        scope: "stored-players",
      },
    };
  }
  return null;
}
