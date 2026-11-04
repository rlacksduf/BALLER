import {savedAnalysis,saveLibrarySnapshots} from "./db/saved-analysis.mjs";
import {basicProfile,freshness} from "./db/read-policy.mjs";
import { libraryPlan } from "./db/import-library.mjs";
import { getRepository } from "./db/repository.mjs";
const providerOf = (url) => {
  const provider = url.searchParams.get("provider") ?? "highlightly";
  if (!["highlightly", "statsbomb", "demo"].includes(provider))
    throw new Error("Invalid provider");
  return provider;
};
const integer = (raw, fallback, max) => {
  if (raw === null) return fallback;
  if (!/^\d+$/.test(raw) || Number(raw) > max)
    throw new Error("Invalid pagination");
  return Number(raw);
};
export async function backendResponse(url, repository) {
  try {
    const provider = providerOf(url),
      limit = integer(url.searchParams.get("limit"), 20, 100),
      offset = integer(url.searchParams.get("offset"), 0, 10000);
    if (limit < 1)
      return { status: 400, body: { error: "limit은 1 이상이어야 합니다." } };
    const repo = repository ?? (await getRepository());
    if (url.pathname === "/api/backend/health")
      return {
        status: 200,
        body: {
          database: repo.kind,
          status: "ready",
          counts: await repo.counts(),
          externalApiCalled: false,
        },
      };
    if (url.pathname === "/api/backend/players") {
      const q = (url.searchParams.get("q") ?? "").trim();
      if (q.length > 80)
        return {
          status: 400,
          body: { error: "검색어는 80자 이하여야 합니다." },
        };
      return {
        status: 200,
        body: {
          data: await repo.listPlayers({ q, provider, limit, offset }),
          pagination: { limit, offset },
          source: "database",
        },
      };
    }
    if (url.pathname === "/api/backend/library") {
      const items = await repo.library({ provider, limit, offset });
      const nullable = (value) =>
        value === null || value === undefined ? null : Number(value);
      const data = items.map((player) => {
        const p = basicProfile(player,player.seasons);
        return {
          id: Number(player.external_id),
          name: player.name,
          logo: player.logo,
          updatedAt: player.updated_at,
          profile: p
            ? {
                name: player.name,
                birthDate: p.birthDate ?? null,
                citizenship: p.citizenship ?? null,
                height: p.height ?? null,
                foot: p.foot ?? null,
                position: p.position?.main ?? null,
                secondary: p.position?.secondary ?? null,
                club: p.club?.current ?? null,
                joined: p.club?.joinedAt ?? null,
                contract: p.club?.contractExpiry ?? null,
              }
            : null,
          stats: player.seasons.map((row) => ({
            club: row.club,
            league: row.league,
            season: row.season,
            type: row.competition_type,
            gamesPlayed: nullable(row.appearances),
            minutesPlayed: nullable(row.minutes),
            goals: nullable(row.goals),
            assists: nullable(row.assists),
          })),
        };
      });
      return {
        status: 200,
        body: { data, pagination: { limit, offset }, source: "database" },
      };
    }
    const match = url.pathname.match(
      /^\/api\/backend\/players\/(\d{1,12})(?:\/(seasons|matches|analysis))?$/,
    );
    if (match && Number(match[1]) > 0) {
      const id = Number(match[1]);
      const player = await repo.player(provider, id);
      if (!player)
        return { status: 404, body: { error: "DB에 저장된 선수가 없습니다." } };
      if(match[2]==='analysis')return {status:200,body:await savedAnalysis(repo,provider,id,url.searchParams.get('season')??'',url.searchParams.get('competition')??'')};
      const data =
        match[2] === "seasons"
          ? await repo.seasons(provider, id)
          : match[2] === "matches"
            ? await repo.matchStats(provider, id, { limit, offset })
            : player;
      return { status: 200, body: { data, source: "database",metadata:freshness(match[2]==='seasons'?'seasons':'profile',match[2]==='seasons'?data.map(row=>row.updated_at):[player.updated_at]) } };
    }
    return { status: 404, body: { error: "API 경로를 찾을 수 없습니다." } };
  } catch (error) {
    if (
      error.message === "Invalid provider" ||
      error.message === "Invalid pagination" || error.message === "Invalid analysis filters"
    )
      return { status: 400, body: { error: "조회 조건을 확인해 주세요." } };
    return {
      status: 503,
      body: {
        error: "DB 연결을 확인해 주세요. 외부 API로 자동 우회하지 않습니다.",
      },
    };
  }
}
export async function handleBackend(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  if (
    req.method === "POST" &&
    new URL(req.url, "http://localhost").pathname === "/api/backend/library"
  ) {
    let origin;
    try {
      origin = new URL(req.headers.origin);
    } catch {
      origin = null;
    }
    const remote = req.socket?.remoteAddress;
    if (
      process.env.BALLER_ALLOW_BROWSER_IMPORT !== "true" ||
      !origin ||
      !["127.0.0.1", "localhost", "[::1]"].includes(origin.hostname) ||
      origin.host !== req.headers.host ||
      !["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(remote)
    ) {
      res.statusCode = 403;
      res.end(
        JSON.stringify({ error: "로컬 개발 화면에서만 가져올 수 있습니다." }),
      );
      return;
    }
    let length = 0;
    const chunks = [];
    try {
      for await (const chunk of req) {
        length += chunk.length;
        if (length > 2 * 1024 * 1024) {
          res.statusCode = 413;
          res.end(JSON.stringify({ error: "가져오기 파일이 너무 큽니다." }));
          return;
        }
        chunks.push(chunk);
      }
      const plan = libraryPlan(
        JSON.parse(Buffer.concat(chunks).toString("utf8")),
      );
      const repo = await getRepository();
      await repo.ingestPlan(plan);
      const importedAnalyses=await saveLibrarySnapshots(repo,JSON.parse(Buffer.concat(chunks).toString("utf8")).players);
      res.end(
        JSON.stringify({
          importedAnalyses,
          importedPlayers: plan.players.length,
          importedSeasons: plan.seasons.length,
          counts: await repo.counts(),
        }),
      );
      return;
    } catch (error) {
      res.statusCode = 400;
      res.end(
        JSON.stringify({
          error:
            error instanceof SyntaxError
              ? "JSON 형식을 확인해 주세요."
              : "저장 기록 가져오기에 실패했습니다. 기존 DB는 유지됩니다.",
        }),
      );
      return;
    }
  }
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.statusCode = 405;
    res.end(JSON.stringify({ error: "읽기 전용 API입니다." }));
    return;
  }
  const result = await backendResponse(new URL(req.url, "http://localhost"));
  res.statusCode = result.status;
  res.end(JSON.stringify(result.body));
}
