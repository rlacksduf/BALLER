import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { createLocalRepository } from "../server/db/repository.mjs";
import { normalizePayload } from "../server/db/normalize.mjs";
import { libraryPlan } from "../server/db/import-library.mjs";
import { backendResponse } from "../server/backend.mjs";
let repo;
before(async () => {
  repo = await createLocalRepository();
});
after(async () => {
  await repo.close();
});
const season = [
  {
    id: 1,
    name: "Example Player",
    profile: { citizenship: "KR", position: { main: "Forward" } },
    perCompetition: [
      {
        club: "Example FC",
        league: "Test League",
        season: "26/27",
        type: "national league",
        gamesPlayed: 1,
        minutesPlayed: 90,
        goals: 2,
        assists: 0,
      },
    ],
  },
];
const fixture = {
  data: [
    {
      id: 100,
      date: "2026-11-01T12:00:00Z",
      homeTeam: { id: 10, name: "Example FC" },
      awayTeam: { id: 20, name: "Other FC" },
      league: { id: 30, name: "Test League", season: 2026 },
      state: { description: "Finished", score: { current: "2 - 0" } },
    },
  ],
};
const box = [
  {
    team: { id: 10, name: "Example FC" },
    players: [
      {
        id: 1,
        name: "Example Player",
        minutesPlayed: 90,
        statistics: {
          goalsScored: 2,
          assists: 0,
          shotsTotal: 3,
          expectedGoals: null,
        },
      },
    ],
  },
];
test("프로필·시즌·경기·경기별 스탯을 실제 PostgreSQL에 저장한다", async () => {
  await repo.ingest("/players/1/statistics", season);
  await repo.ingest("/matches?season=2026", fixture);
  await repo.ingest("/box-score/100", box);
  const counts = await repo.counts();
  assert.equal(counts.baller_players, 1);
  assert.equal(counts.baller_teams, 2);
  assert.equal(counts.baller_matches, 1);
  assert.equal(counts.baller_player_match_stats, 1);
  assert.equal((await repo.seasons("highlightly", 1))[0].goals, "2");
});
test("같은 선수·경기를 재수집하면 중복 없이 갱신한다", async () => {
  const updated = structuredClone(box);
  updated[0].players[0].statistics.goalsScored = 3;
  await repo.ingest("/box-score/100", updated);
  const rows = await repo.matchStats("highlightly", 1);
  assert.equal(rows.length, 1);
  assert.equal(Number(rows[0].goals), 3);
  assert.equal(rows[0].statistics.expectedGoals, null);
  assert.equal((await repo.player("highlightly", 1)).nationality, "KR");
});
test("잘못된 외래키가 있으면 선수 생성과 캐시까지 전체 롤백한다", async () => {
  const before = await repo.counts();
  const plan = normalizePayload("/players/2", [{ id: 2, name: "Rollback" }]);
  plan.stats = [{ player_id: 999, match_id: 999, statistics: {} }];
  await assert.rejects(() => repo.ingestPlan(plan));
  assert.equal(await repo.player("highlightly", 2), null);
  assert.deepEqual(await repo.counts(), before);
});
test("다른 데이터 제공업체의 같은 ID는 충돌하지 않는다", async () => {
  await repo.ingest("/players/1", [{ id: 1, name: "Open Dataset Player" }], {
    provider: "statsbomb",
  });
  assert.equal((await repo.player("highlightly", 1)).name, "Example Player");
  assert.equal((await repo.player("statsbomb", 1)).name, "Open Dataset Player");
});
test("DB 읽기 API는 외부 호출 없이 동작하고 검색 SQL을 매개변수 처리한다", async () => {
  assert.equal(
    (
      await backendResponse(
        new URL("http://localhost/api/backend/players/1/seasons"),
        repo,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await backendResponse(
        new URL("http://localhost/api/backend/players/999"),
        repo,
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await backendResponse(
        new URL("http://localhost/api/backend/players?limit=101"),
        repo,
      )
    ).status,
    400,
  );
  assert.deepEqual(await repo.listPlayers({ q: "%' OR 1=1 --" }), []);
});
test("캐시는 스코프별로 분리하며 RLS와 invoker 함수를 사용한다", async () => {
  await repo.ingest(
    "/players?name=Example",
    { data: [] },
    { scope: "scope-a" },
  );
  assert.ok(await repo.cached("scope-a", "/players?name=Example"));
  assert.equal(await repo.cached("scope-b", "/players?name=Example"), null);
  const tables = await repo.query(
    "select relrowsecurity from pg_class where relname like 'baller_%' and relkind='r'",
  );
  assert.ok(tables.rows.every((row) => row.relrowsecurity));
  const fn = await repo.query(
    "select prosecdef from pg_proc where proname='baller_ingest'",
  );
  assert.equal(fn.rows[0].prosecdef, false);
});
test("브라우저 저장 기록은 검증 후 실제 시즌 테이블로 가져온다", async () => {
  const plan = libraryPlan({
    players: [
      {
        id: 5,
        name: "Saved Player",
        stats: [
          {
            club: "Saved FC",
            league: "League",
            season: "26/27",
            type: "national league",
            goals: 0,
            assists: null,
            minutesPlayed: 90,
            gamesPlayed: 1,
          },
        ],
      },
    ],
  });
  await repo.ingestPlan(plan);
  const row = (await repo.seasons("highlightly", 5))[0];
  assert.equal(Number(row.goals), 0);
  assert.equal(row.assists, null);
  assert.throws(() =>
    libraryPlan({ players: [{ id: -1, name: "Bad", stats: [] }] }),
  );
});
