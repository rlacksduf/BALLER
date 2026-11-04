const object = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const id = (value) => (Number.isSafeInteger(value) && value > 0 ? value : null);
const num = (value) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
const text = (value) =>
  typeof value === "string" && value.trim() ? value : null;
export function normalizePayload(
  path,
  body,
  {
    scope = "local",
    provider = "highlightly",
    expiresAt = new Date(Date.now() + 86400000).toISOString(),
    fetchedAt = new Date().toISOString(),
  } = {},
) {
  if (!["highlightly", "statsbomb", "demo"].includes(provider))
    throw new Error("Unsupported provider");
  const plan = {
    provider,
    path,
    players: [],
    teams: [],
    matches: [],
    seasons: [],
    stats: [],
    cache: { scope, body, expires_at: expiresAt, fetched_at: fetchedAt },
  };
  const addPlayer = (p) => {
    if (!object(p) || !id(p.id) || !text(p.name)) return;
    plan.players.push({
      external_id: p.id,
      name: text(p.fullName) ?? p.name,
      logo: text(p.logo),
      nationality: text(p.profile?.citizenship),
      position: text(p.profile?.position?.main),
      profile: object(p.profile) ? p.profile : null,
    });
  };
  const addTeam = (t) => {
    if (object(t) && id(t.id) && text(t.name))
      plan.teams.push({ external_id: t.id, name: t.name, logo: text(t.logo) });
  };
  if (/^\/players(?:\?|\/\d+(?:\/statistics)?$)/.test(path)) {
    const rows = Array.isArray(body)
      ? body
      : object(body) && Array.isArray(body.data)
        ? body.data
        : [body];
    for (const p of rows) {
      addPlayer(p);
      if (!object(p) || !id(p.id) || !text(p.name)) continue;
      for (const row of Array.isArray(p.perCompetition)
        ? p.perCompetition
        : []) {
        if (
          !object(row) ||
          !["club", "league", "season", "type"].every((k) => text(row[k]))
        )
          throw new Error("Malformed season record");
        plan.seasons.push({
          player_id: p.id,
          club: row.club,
          league: row.league,
          season: row.season,
          competition_type: row.type,
          appearances: num(row.gamesPlayed),
          minutes: num(row.minutesPlayed),
          goals: num(row.goals),
          assists: num(row.assists),
        });
      }
    }
  }
  if (path.startsWith("/teams?")) for (const t of body?.data ?? []) addTeam(t);
  if (path.startsWith("/matches?"))
    for (const m of body?.data ?? []) {
      if (!object(m) || !id(m.id)) continue;
      addTeam(m.homeTeam);
      addTeam(m.awayTeam);
      plan.matches.push({
        external_id: m.id,
        played_at:
          typeof m.date === "string" && Number.isFinite(Date.parse(m.date))
            ? new Date(m.date).toISOString()
            : null,
        home_team_id: id(m.homeTeam?.id),
        away_team_id: id(m.awayTeam?.id),
        league_id: id(m.league?.id),
        league_name: text(m.league?.name),
        season: Number.isSafeInteger(m.league?.season) ? m.league.season : null,
        status: text(m.state?.description),
        score: text(m.state?.score?.current),
      });
    }
  const matchId = path.match(/^\/box-score\/(\d+)$/)?.[1];
  if (matchId) {
    if (!Array.isArray(body)) throw new Error("Malformed box score");
    plan.matches.push({ external_id: Number(matchId) });
    for (const group of body) {
      addTeam(group.team);
      for (const p of group.players ?? []) {
        addPlayer(p);
        if (!id(p?.id) || !text(p.name)) continue;
        const s = Array.isArray(p.statistics) ? p.statistics[0] : p.statistics;
        if (!object(s)) continue;
        plan.stats.push({
          player_id: p.id,
          match_id: Number(matchId),
          team_id: id(group.team?.id),
          minutes: num(p.minutesPlayed),
          goals: num(s.goalsScored),
          assists: num(s.assists),
          shots: num(s.shotsTotal),
          shots_on_target: num(s.shotsOnTarget),
          key_passes: num(s.passesKey),
          tackles: num(s.tacklesTotal),
          interceptions: num(s.interceptionsTotal),
          statistics: s,
        });
      }
    }
  }
  for (const table of ["players", "teams", "matches", "seasons", "stats"]) {
    const keys = {
      players: (r) => r.external_id,
      teams: (r) => r.external_id,
      matches: (r) => r.external_id,
      seasons: (r) =>
        JSON.stringify([
          r.player_id,
          r.club,
          r.league,
          r.season,
          r.competition_type,
        ]),
      stats: (r) => `${r.player_id}:${r.match_id}`,
    };
    plan[table] = [
      ...new Map(plan[table].map((row) => [keys[table](row), row])).values(),
    ];
  }
  return plan;
}
