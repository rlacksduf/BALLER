import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
const cache = new Map();
const pending = new Map();
const blocked = new Map();
const diskFile =
  process.env.BALLER_CACHE_FILE ??
  resolve(
    process.env.VERCEL ? "/tmp" : process.cwd(),
    ".cache",
    "highlightly.json",
  );
let diskLoaded = false;
function loadDisk() {
  if (diskLoaded) return;
  diskLoaded = true;
  try {
    if (!existsSync(diskFile)) return;
    const data = JSON.parse(readFileSync(diskFile, "utf8"));
    for (const [key, value] of Object.entries(data.cache ?? {}))
      cache.set(key, value);
    for (const [key, value] of Object.entries(data.blocked ?? {}))
      blocked.set(key, value);
  } catch {
    /* 캐시 손상 시 화면의 오류 처리를 사용합니다. */
  }
}
function persist() {
  try {
    mkdirSync(dirname(diskFile), { recursive: true });
    writeFileSync(
      diskFile,
      JSON.stringify({
        cache: Object.fromEntries(cache),
        blocked: Object.fromEntries(blocked),
      }),
      { mode: 0o600 },
    );
  } catch {
    /* 읽기 전용 환경에서는 메모리 캐시를 사용합니다. */
  }
}
const scopeKey = (key) =>
  createHash("sha256").update(key).digest("hex").slice(0, 24);
export function blockLiveRequests(
  apiKey,
  until = Date.now() + 24 * 60 * 60 * 1000,
) {
  loadDisk();
  blocked.set(scopeKey(apiKey), until);
  persist();
}
export function resumeLiveRequests(apiKey) {
  loadDisk();
  if (apiKey) blocked.delete(scopeKey(apiKey));
  persist();
}
export function getQuotaStatus(apiKey) {
  loadDisk();
  return { blockedUntil: apiKey ? (blocked.get(scopeKey(apiKey)) ?? 0) : 0 };
}

export async function queryHighlightly(
  path,
  apiKey = process.env.HIGHLIGHTLY_API_KEY,
  request = fetch,
) {
  if (!apiKey)
    return {
      status: 503,
      body: {
        error:
          "Highlightly API 키가 설정되지 않았습니다. 프로젝트의 .env.local에 HIGHLIGHTLY_API_KEY를 설정하고 개발 서버를 재시작해 주세요.",
      },
    };
  const live = request === fetch;
  if (live) loadDisk();
  const cacheKey = scopeKey(apiKey) + ":" + path;
  const cached = cache.get(cacheKey);
  if (
    cached &&
    (cached.expires > Date.now() ||
      (live && (blocked.get(scopeKey(apiKey)) ?? 0) > Date.now()))
  )
    return cached.result;
  let staleDatabase;
  if (live && process.env.BALLER_DB_DISABLED !== "true") {
    try {
      const { getRepository } = await import("./db/repository.mjs");
      const repo = await getRepository();
      const stored = await repo.cached(scopeKey(apiKey), path);
      if (stored) {
        const fallback={status:200,source:'database',body:stored.body,metadata:{fetchedAt:stored.fetched_at,stale:Date.parse(stored.expires_at)<=Date.now()}};
        if(!fallback.metadata.stale)return fallback;
        staleDatabase=fallback;
      }
    } catch {
      return {
        status: 503,
        body: {
          error:
            "DB 조회에 실패했습니다. 요청량 보호를 위해 외부 API로 우회하지 않습니다.",
        },
      };
    }
  }
  if (live && (blocked.get(scopeKey(apiKey)) ?? 0) > Date.now())
    return staleDatabase ?? {
      status: 429,
      blockedUntil: blocked.get(scopeKey(apiKey)),
      body: {
        error:
          "API 요청 한도를 소진해 외부 조회를 중단했습니다. 저장된 기록을 사용해 주세요.",
      },
    };
  if (
    live &&
    process.env.BALLER_DB_DISABLED !== "true" &&
    process.env.BALLER_ALLOW_LIVE_API !== "true"
  )
    return staleDatabase ?? {
      status: 503,
      body: {
        error:
          "외부 API 수집이 비활성화되어 있습니다. 현재는 DB에 저장된 기록만 조회합니다.",
      },
    };
  if (pending.has(cacheKey)) return pending.get(cacheKey);
  const operation = (async () => {
    try {
      const response = await request(`https://soccer.highlightly.net${path}`, {
        headers: { "x-rapidapi-key": apiKey },
        signal: AbortSignal.timeout(10000),
      });
      if (live && response.status === 429) {
        const retry = Number(response.headers.get("retry-after"));
        blockLiveRequests(
          apiKey,
          Date.now() + (retry > 0 ? retry * 1000 : 24 * 60 * 60 * 1000),
        );
      }
      if (!response.ok)
        return staleDatabase ?? {
          status: response.status === 429 ? 429 : 502,
          body: {
            error:
              response.status === 429
                ? "API 요청 한도를 초과했습니다. 잠시 후 다시 시도해 주세요."
                : response.status === 401 || response.status === 403
                  ? "API 키 또는 Football API 이용 권한을 확인해 주세요."
                  : "데이터 제공업체에 연결할 수 없습니다.",
          },
        };
      const body = await response.json();
      const result = { status: 200, body };
      if (cache.size >= 100) cache.delete(cache.keys().next().value);
      const ttl = /^\/players\/\d+$/.test(path)?7*86400000:path.startsWith("/box-score/")?3650*86400000:path.startsWith("/matches?")?15*60*1000:86400000;
      cache.set(cacheKey, { expires: Date.now() + ttl, result });
      if (live) {
        persist();
        if (process.env.BALLER_DB_DISABLED !== "true") {
          const { getRepository } = await import("./db/repository.mjs");
          await (
            await getRepository()
          ).ingest(path, body, {
            scope: scopeKey(apiKey),
            expiresAt: new Date(Date.now() + ttl).toISOString(),
          });
        }
      }
      return result;
    } catch {
      return staleDatabase ?? {
        status: 502,
        body: {
          error: "API 응답을 받지 못했습니다. 잠시 후 다시 시도해 주세요.",
        },
      };
    }
  })();
  pending.set(cacheKey, operation);
  try {
    return await operation;
  } finally {
    pending.delete(cacheKey);
  }
}

// 시즌 기록과 경기 목록의 이름 체계가 다를 때 검증된 ID로 연결합니다.
export function normalizeEntityName(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(fc|cf|afc|football club)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
}
export function selectExactEntity(rows, name) {
  if (!Array.isArray(rows)) return null;
  const exact = rows.filter(
    (row) =>
      Number.isSafeInteger(row?.id) &&
      typeof row?.name === "string" &&
      normalizeEntityName(row.name) === normalizeEntityName(name),
  );
  return exact.length === 1 ? exact[0] : null;
}
async function matchesByIdentity(team, league, season, side, apiKey, request) {
  const teamName = team
    .replace(/^(FC|CF|AFC)\s+/i, "")
    .replace(/\s+(FC|CF|AFC)$/i, "")
    .trim();
  // 공식 API에서 확인한 시즌 통계명 → 경기 대회명.
  const saudiLeague=normalizeEntityName(league)==='saudiproleague';
  // Confirmed from the provider's SA catalog: season stats use Saudi Pro League,
  // while fixture catalog uses Pro League. Country is required to avoid other Pro Leagues.
  const leagueName = saudiLeague ? "Pro League" : league === "LaLiga" ? "La Liga" : league;
  const teamResponse = await queryHighlightly(
    `/teams?${new URLSearchParams({ name: teamName, type: "club", limit: "100" })}`,
    apiKey,
    request,
  );
  if (teamResponse.status !== 200) return teamResponse;
  const leagueResponse = await queryHighlightly(
    `/leagues?${new URLSearchParams(saudiLeague?{countryCode:"SA",season,limit:"100"}:{ leagueName, season, limit: "100" })}`,
    apiKey,
    request,
  );
  if (leagueResponse.status !== 200) return leagueResponse;
  const resolvedTeam = selectExactEntity(teamResponse.body?.data, team);
  const leagueRows=leagueResponse.body?.data;
  const candidates=saudiLeague&&Array.isArray(leagueRows)?leagueRows.filter(row=>row.country?.code==='SA'||row.country?.name==='Saudi Arabia'):leagueRows;
  const resolvedLeague = selectExactEntity(candidates, leagueName);
  if (!resolvedTeam || !resolvedLeague)
    return {
      status: 422,
      body: {
        error: `${team} · ${league}의 경기 조회용 식별자를 확정하지 못했습니다. 팀·대회 이름 차이 또는 데이터 제공 범위를 확인해야 합니다.`,
      },
    };
  return queryHighlightly(
    `/matches?${new URLSearchParams({ [side === "home" ? "homeTeamId" : "awayTeamId"]: String(resolvedTeam.id), leagueId: String(resolvedLeague.id), season, limit: "100", offset: "0" })}`,
    apiKey,
    request,
  );
}

export async function footballResponse(url, apiKey, request) {
  if (url.searchParams.get("action") === "status")
    return {
      status: 200,
      body: getQuotaStatus(apiKey ?? process.env.HIGHLIGHTLY_API_KEY),
    };
  if (!request && process.env.BALLER_DB_DISABLED !== "true") {
    try {
      const { storedFootball } = await import("./db/football-read.mjs");
      const stored = await storedFootball(url);
      if (stored) {
        const {preferStored}=await import('./db/read-policy.mjs');
        const effectiveKey=apiKey??process.env.HIGHLIGHTLY_API_KEY;
        return preferStored(stored,()=>queryHighlightly(stored.refreshPath,effectiveKey),{allowed:url.searchParams.get('refresh')==='1'&&!!stored.refreshPath&&process.env.BALLER_ALLOW_LIVE_API==='true'&&!(getQuotaStatus(effectiveKey).blockedUntil>Date.now())});
      }
      // A read in saved-only mode returns an empty DB search, not a provider error.
      if(url.searchParams.has('name')&&process.env.BALLER_ALLOW_LIVE_API!=='true'&&url.searchParams.get('name').trim().length>=2&&url.searchParams.get('name').trim().length<=80&&/^\d{1,5}$/.test(url.searchParams.get('offset')??'0')&&Number(url.searchParams.get('offset')??0)<=10000)
        return {status:200,source:'database',body:{data:[],scope:'stored-players',pagination:{limit:12,offset:Number(url.searchParams.get('offset')??0)}}};
    } catch {
      return {
        status: 503,
        body: {
          error:
            "저장 DB 조회를 완료하지 못했습니다. 외부 API로 자동 우회하지 않습니다.",
        },
      };
    }
  }
  const matchId = url.searchParams.get("matchId");
  if (matchId) {
    if (!/^\d{1,12}$/.test(matchId))
      return { status: 400, body: { error: "올바른 경기 ID가 필요합니다." } };
    return queryHighlightly(`/box-score/${matchId}`, apiKey, request);
  }
  if (url.searchParams.get("action") === "matches") {
    const team = url.searchParams.get("team")?.trim() ?? "";
    const league = url.searchParams.get("league")?.trim() ?? "";
    const season = url.searchParams.get("season") ?? "";
    const side = url.searchParams.get("side");
    if (
      !team ||
      team.length > 100 ||
      !league ||
      league.length > 100 ||
      !/^20\d{2}$/.test(season) ||
      !["home", "away"].includes(side)
    )
      return { status: 400, body: { error: "팀·대회·시즌을 확인해 주세요." } };
    const result = await queryHighlightly(
      `/matches?${new URLSearchParams({ [side === "home" ? "homeTeamName" : "awayTeamName"]: team, leagueName: league, season, limit: "100", offset: "0" })}`,
      apiKey,
      request,
    );
    if (
      result.status !== 200 ||
      !Array.isArray(result.body?.data) ||
      result.body.data.length > 0
    )
      return result;
    return matchesByIdentity(team, league, season, side, apiKey, request);
  }
  const id = url.searchParams.get("id");
  const name = url.searchParams.get("name")?.trim() ?? "";
  if (id) {
    if (!/^\d{1,12}$/.test(id))
      return { status: 400, body: { error: "올바른 선수 ID가 필요합니다." } };
    return queryHighlightly(
      url.searchParams.get("action") === "profile"
        ? `/players/${id}`
        : `/players/${id}/statistics`,
      apiKey,
      request,
    );
  }
  if (name.length < 2 || name.length > 80)
    return {
      status: 400,
      body: { error: "선수 이름을 2~80자로 입력해 주세요." },
    };
  const offset = url.searchParams.get("offset") ?? "0";
  if (!/^\d{1,5}$/.test(offset) || Number(offset) > 10000)
    return { status: 400, body: { error: "올바른 페이지가 필요합니다." } };
  return queryHighlightly(
    `/players?${new URLSearchParams({ name, limit: "12", offset })}`,
    apiKey,
    request,
  );
}
