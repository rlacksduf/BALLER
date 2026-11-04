import { test } from "node:test";
import assert from "node:assert/strict";
import { createLocalRepository } from "../server/db/repository.mjs";
import { storedFootball } from "../server/db/football-read.mjs";
import { freshness, preferStored } from "../server/db/read-policy.mjs";
import {
  savedAnalysis,
  saveLibrarySnapshots,
} from "../server/db/saved-analysis.mjs";
import { aggregate } from "../src/utils/scouting.ts";
import { backendResponse } from "../server/backend.mjs";

test("프로필 7일·시즌 1일 정책을 분리하고 실패한 갱신에는 저장 기록을 반환한다", async () => {
  const date = "2026-10-01T00:00:00Z",
    now = Date.parse(date) + 2 * 86400000;
  assert.equal(freshness("profile", [date], now).stale, false);
  assert.equal(freshness("seasons", [date], now).stale, true);
  let calls = 0;
  const saved = { status: 200, body: { goals: 2 }, metadata: { stale: true } };
  assert.equal(
    await preferStored(
      saved,
      () => {
        calls++;
      },
      { allowed: false },
    ),
    saved,
  );
  assert.equal(calls, 0);
  const fallback = await preferStored(
    saved,
    async () => ({ status: 429, blockedUntil: 123 }),
    { allowed: true },
  );
  assert.deepEqual(fallback.body, saved.body);
  assert.equal(fallback.blockedUntil, 123);
  assert.equal(
    (
      await preferStored(
        saved,
        async () => {
          throw Error("offline");
        },
        { allowed: true },
      )
    ).status,
    200,
  );
});

test("프로필 원본이 없어도 DB의 기본 신상·소속을 표시한다", async () => {
  const repo = await createLocalRepository();
  try {
    await repo.ingest("/players/5/statistics", [
      {
        id: 5,
        name: "Stored Player",
        perCompetition: [
          {
            club: "Stored FC",
            league: "League",
            season: "26/27",
            type: "national league",
            goals: 2,
            assists: 0,
            gamesPlayed: 1,
            minutesPlayed: 90,
          },
        ],
      },
    ]);
    const result = await storedFootball(
      new URL("http://local/api/football?id=5&action=profile"),
      repo,
    );
    assert.equal(result.status, 200);
    assert.equal(result.body[0].profile.club.current, "Stored FC");
    assert.equal(result.body[0].profile.position.main, null);
    assert.equal(result.metadata.partial, true);
    const search = await storedFootball(
      new URL("http://local/api/football?name=Stored"),
      repo,
    );
    assert.equal(search.body.data.length, 1);
  } finally {
    await repo.close();
  }
});

test("브라우저 합산 기록은 별도 스냅샷으로 보관하며 시즌·대회가 다른 요청에 섞지 않는다", async () => {
  const repo = await createLocalRepository();
  try {
    await repo.ingest("/players/5", [{ id: 5, name: "Stored Player" }]);
    const data = aggregate([
      { minutes: 90, position: "Forward", stats: { goalsScored: 2 } },
    ]);
    await saveLibrarySnapshots(repo, [
      {
        id: 5,
        updatedAt: "2026-11-01T00:00:00Z",
        aggregate: { season: "26/27", competition: "national league", data },
      },
    ]);
    const result = await savedAnalysis(
      repo,
      "highlightly",
      5,
      "26/27",
      "national league",
    );
    assert.equal(result.snapshot.totals.goalsScored, 2);
    assert.equal(result.snapshot.totals.expectedGoals, null);
    assert.equal(result.source, "browser-snapshot");
    assert.equal(result.externalApiCalled, false);
    assert.equal(
      (await savedAnalysis(repo, "highlightly", 5, "25/26", "national league"))
        .snapshot,
      null,
    );
    assert.equal(
      (await savedAnalysis(repo, "highlightly", 5, "26/27", "national cup"))
        .snapshot,
      null,
    );
    assert.equal((await repo.counts()).baller_player_match_stats, 0);
    const invalid = await backendResponse(
      new URL("http://local/api/backend/players/5/analysis?season=bad"),
      repo,
    );
    assert.equal(invalid.status, 400);
  } finally {
    await repo.close();
  }
});

test("상세 분석은 완료 경기와 선택 시즌·리그만 포함하며 누락 지표를 0으로 만들지 않는다", async () => {
  const repo = await createLocalRepository();
  try {
    await repo.ingest("/players/5/statistics", [
      {
        id: 5,
        name: "Player",
        profile: { position: { main: "Forward" } },
        perCompetition: [
          {
            club: "FC",
            league: "League",
            season: "26/27",
            type: "national league",
            goals: 2,
            assists: 0,
            gamesPlayed: 1,
            minutesPlayed: 90,
          },
        ],
      },
    ]);
    await repo.ingest("/matches?season=2026", {
      data: [
        {
          id: 9,
          date: "2026-10-01T12:00:00Z",
          league: { id: 3, name: "League", season: 2026 },
          state: { description: "Finished" },
        },
      ],
    });
    await repo.ingest("/box-score/9", [
      {
        team: { id: 10, name: "FC" },
        players: [
          {
            id: 5,
            name: "Player",
            minutesPlayed: 90,
            statistics: { goalsScored: 2 },
          },
        ],
      },
    ]);
    const result = await savedAnalysis(
      repo,
      "highlightly",
      5,
      "26/27",
      "national league",
    );
    assert.equal(result.samples.length, 1);
    assert.equal(result.samples[0].stats.goalsScored, 2);
    assert.equal(result.samples[0].stats.expectedGoals, null);
    assert.equal(
      (await savedAnalysis(repo, "highlightly", 5, "25/26", "national league"))
        .samples.length,
      0,
    );
  } finally {
    await repo.close();
  }
});
