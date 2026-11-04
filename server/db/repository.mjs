import { readFile, mkdir, open, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { createClient } from "@supabase/supabase-js";
import { normalizePayload } from "./normalize.mjs";
const tables = [
  "baller_players",
  "baller_teams",
  "baller_matches",
  "baller_player_match_stats",
  "baller_player_seasons",
  "baller_provider_responses",
];
export async function createLocalRepository(directory = "memory://") {
  let lockFile;
  if (directory !== "memory://") {
    await mkdir(directory, { recursive: true });
    lockFile = resolve(directory, ".baller-owner.lock");
    try {
      const lock = await open(lockFile, "wx", 0o600);
      await lock.writeFile(String(process.pid));
      await lock.close();
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      let owner;
      try {
        owner = Number(await readFile(lockFile, "utf8"));
        if (!Number.isSafeInteger(owner) || owner <= 0)
          throw new Error("Invalid DB owner lock");
        process.kill(owner, 0);
      } catch (check) {
        if (check.code === "ESRCH") {
          await unlink(lockFile);
          const lock = await open(lockFile, "wx", 0o600);
          await lock.writeFile(String(process.pid));
          await lock.close();
          owner = null;
        } else throw new Error("Local DB is already in use");
      }
      if (owner)
        throw new Error(
          "Local DB is already in use; run Vite through BALLER_BACKEND_URL or stop the other server.",
        );
    }
  }
  let db;
  try {
    db = await PGlite.create(directory);
    await db.exec(
      await readFile(new URL("./schema.sql", import.meta.url), "utf8"),
    );
  } catch (error) {
    if (db) await db.close();
    if (lockFile) await unlink(lockFile).catch(() => {});
    throw error;
  }
  return {
    kind: "local-postgres",
    async ingestPlan(plan) {
      const result = await db.query(
        "select public.baller_ingest($1::jsonb) as count",
        [JSON.stringify(plan)],
      );
      return result.rows[0].count;
    },
    async ingest(path, body, options) {
      const plan = normalizePayload(path, body, options);
      const result = await db.query(
        "select public.baller_ingest($1::jsonb) as count",
        [JSON.stringify(plan)],
      );
      return result.rows[0].count;
    },
    async cached(scope, path) {
      const result = await db.query(
        "select body,expires_at,fetched_at from public.baller_provider_responses where scope=$1 and path=$2",
        [scope, path],
      );
      return result.rows[0] ?? null;
    },
    async listPlayers({
      q = "",
      provider = "highlightly",
      limit = 20,
      offset = 0,
    } = {}) {
      return (
        await db.query(
          "select provider,external_id,name,nationality,position,logo,updated_at from public.baller_players where provider=$1 and name ilike $2 escape '\\' order by external_id limit $3 offset $4",
          [provider, "%" + q.replace(/[\\%_]/g, "\\$&") + "%", limit, offset],
        )
      ).rows;
    },
    async library({ provider = "highlightly", limit = 100, offset = 0 } = {}) {
      return (
        await db.query(
          "select p.*,coalesce((select jsonb_agg(to_jsonb(s)) from public.baller_player_seasons s where s.provider=p.provider and s.player_id=p.external_id),'[]'::jsonb) as seasons from public.baller_players p where provider=$1 order by external_id limit $2 offset $3",
          [provider, limit, offset],
        )
      ).rows;
    },
    async pruneCache(before) {
      return (
        await db.query(
          "delete from public.baller_provider_responses where expires_at<$1::timestamptz returning path",
          [before],
        )
      ).rows.length;
    },
    async player(provider, id) {
      const rows = (
        await db.query(
          "select * from public.baller_players where provider=$1 and external_id=$2",
          [provider, id],
        )
      ).rows;
      return rows[0] ?? null;
    },
    async seasons(provider, id) {
      return (
        await db.query(
          "select * from public.baller_player_seasons where provider=$1 and player_id=$2 order by season desc,league",
          [provider, id],
        )
      ).rows;
    },
    async matchStats(provider, id, { limit = 100, offset = 0 } = {}) {
      return (
        await db.query(
          "select s.*,m.played_at,m.league_name,m.season,m.status from public.baller_player_match_stats s join public.baller_matches m on m.provider=s.provider and m.external_id=s.match_id where s.provider=$1 and s.player_id=$2 order by m.played_at desc nulls last,s.match_id desc limit $3 offset $4",
          [provider, id, limit, offset],
        )
      ).rows;
    },
    async counts() {
      const result = {};
      for (const table of tables)
        result[table] = Number(
          (await db.query(`select count(*) as count from public.${table}`))
            .rows[0].count,
        );
      return result;
    },
    query: (sql, params) => db.query(sql, params),
    close: async () => {
      await db.close();
      if (lockFile) await unlink(lockFile).catch(() => {});
    },
  };
}
export function createSupabaseRepository(url, secret) {
  if (!url || !secret)
    throw new Error("Supabase server credentials are required");
  if (secret.startsWith("sb_publishable_"))
    throw new Error("A Supabase Secret key is required, not a publishable key");
  const client = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const unwrap = (result) => {
    if (result.error) throw new Error("Database operation failed");
    return result.data;
  };
  return {
    kind: "supabase",
    async ingestPlan(plan) {
      return unwrap(await client.rpc("baller_ingest", { plan }));
    },
    async ingest(path, body, options) {
      return unwrap(
        await client.rpc("baller_ingest", {
          plan: normalizePayload(path, body, options),
        }),
      );
    },
    async cached(scope, path) {
      return unwrap(
        await client
          .from("baller_provider_responses")
          .select("body,expires_at,fetched_at")
          .eq("scope", scope)
          .eq("path", path)
          .maybeSingle(),
      );
    },
    async listPlayers({
      q = "",
      provider = "highlightly",
      limit = 20,
      offset = 0,
    } = {}) {
      let query = client
        .from("baller_players")
        .select(
          "provider,external_id,name,nationality,position,logo,updated_at",
        )
        .eq("provider", provider)
        .order("external_id")
        .range(offset, offset + limit - 1);
      if (q)
        query = query.ilike("name", "%" + q.replace(/[\\%_]/g, "\\$&") + "%");
      return unwrap(await query);
    },
    async library({ provider = "highlightly", limit = 100, offset = 0 } = {}) {
      return unwrap(
        await client
          .from("baller_players")
          .select("*,seasons:baller_player_seasons(*)")
          .eq("provider", provider)
          .order("external_id")
          .range(offset, offset + limit - 1),
      );
    },
    async pruneCache(before) {
      const result = await client
        .from("baller_provider_responses")
        .delete({ count: "exact" })
        .lt("expires_at", before);
      if (result.error) throw new Error("Database operation failed");
      return result.count;
    },
    async player(provider, id) {
      return unwrap(
        await client
          .from("baller_players")
          .select("*")
          .eq("provider", provider)
          .eq("external_id", id)
          .maybeSingle(),
      );
    },
    async seasons(provider, id) {
      return unwrap(
        await client
          .from("baller_player_seasons")
          .select("*")
          .eq("provider", provider)
          .eq("player_id", id)
          .order("season", { ascending: false }),
      );
    },
    async matchStats(provider, id, { limit = 100, offset = 0 } = {}) {
      return unwrap(
        await client
          .from("baller_player_match_stats")
          .select("*")
          .eq("provider", provider)
          .eq("player_id", id)
          .order("match_id", { ascending: false })
          .range(offset, offset + limit - 1),
      );
    },
    async counts() {
      const result = {};
      for (const table of tables) {
        const response = await client
          .from(table)
          .select("*", { count: "exact", head: true });
        if (response.error) throw new Error("Database operation failed");
        result[table] = response.count;
      }
      return result;
    },
    close: async () => {},
  };
}
// HMR 중에도 동일한 로컬 데이터 디렉터리를 중복 개방하지 않습니다.
const singletonKey = Symbol.for("baller.database.repository");
export function getRepository() {
  if (!globalThis[singletonKey])
    globalThis[singletonKey] = (async () => {
      if (process.env.BALLER_DB_DRIVER === "supabase")
        return createSupabaseRepository(
          process.env.SUPABASE_URL,
          process.env.SUPABASE_SECRET_KEY ??
            process.env.SUPABASE_SERVICE_ROLE_KEY,
        );
      return createLocalRepository(
        process.env.BALLER_DB_DIR ??
          resolve(process.cwd(), ".data", "postgres"),
      );
    })().catch((error) => {
      delete globalThis[singletonKey];
      throw error;
    });
  return globalThis[singletonKey];
}
