import test from "node:test";
import assert from "node:assert/strict";
import { collectSeason } from "../src/services/seasonStats.ts";
import { parseMatchPlayer } from "../src/services/matchStats.ts";
const row = {
  club: "City",
  league: "League",
  season: "26/27",
  type: "national league",
  goals: 1,
  assists: 0,
  minutesPlayed: 90,
  gamesPlayed: 1,
};
const match = {
  id: 1,
  date: "2026-10-01T12:00:00Z",
  homeTeam: { name: "City" },
  awayTeam: { name: "Other" },
  state: { description: "Finished", score: { current: "1 - 0" } },
};
const body = [
  {
    team: { id: 1 },
    players: [
      {
        id: 5,
        name: "Player",
        minutesPlayed: 90,
        position: "Forward",
        statistics: { goalsScored: 1, passesTotal: 10 },
      },
    ],
  },
];
test("실제 응답의 object 통계와 문서의 array 통계를 모두 처리한다", () => {
  assert.equal(parseMatchPlayer(body, 5).stats.goalsScored, 1);
  const array = structuredClone(body);
  array[0].players[0].statistics = [array[0].players[0].statistics];
  assert.equal(parseMatchPlayer(array, 5).stats.goalsScored, 1);
  assert.equal(parseMatchPlayer(body, 999), null);
});
test("잘못된 수치와 누락 기록을 실제 0으로 처리하지 않는다", () => {
  const input = structuredClone(body);
  input[0].players[0].statistics = {
    shotsTotal: -2,
    expectedGoalsPrevented: -0.5,
    expectedGoals: null,
  };
  input[0].players[0].minutesPlayed = -1;
  const player = parseMatchPlayer(input, 5);
  assert.equal(player.stats.shotsTotal, null);
  assert.equal(player.stats.expectedGoalsPrevented, -0.5);
  assert.equal(player.minutes, null);
});
test("홈·원정·중복 팀 목록의 같은 경기 ID를 한 번만 수집한다", async () => {
  const original = globalThis.fetch;
  let boxes = 0;
  globalThis.fetch = async (input) => {
    const url = new URL(input, "http://localhost");
    if (url.searchParams.has("matchId")) {
      boxes++;
      return Response.json(body);
    }
    return Response.json({ data: [match], pagination: { totalCount: 1 } });
  };
  try {
    const result = await collectSeason(
      5,
      [row, row],
      "26/27",
      new AbortController().signal,
      () => {},
    );
    assert.equal(result.fixtures, 1);
    assert.equal(result.samples.length, 1);
    assert.equal(boxes, 1);
  } finally {
    globalThis.fetch = original;
  }
});
test("한도 초과 시 수집을 중단하고 원인과 부분 범위를 유지한다", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (input) =>
    new URL(input, "http://localhost").searchParams.has("matchId")
      ? Response.json({ error: "요청 한도 초과" }, { status: 429 })
      : Response.json({ data: [match], pagination: { totalCount: 101 } });
  try {
    const result = await collectSeason(
      5,
      [row],
      "26/27",
      new AbortController().signal,
      () => {},
    );
    assert.equal(result.stopped, true);
    assert.equal(result.limited, true);
    assert.equal(result.failed, 1);
    assert.equal(result.checked, 1);
    assert.match(result.failure, /한도/);
  } finally {
    globalThis.fetch = original;
  }
});
test("사용자의 수집 취소를 조회 실패 표본으로 만들지 않는다", async () => {
  const original = globalThis.fetch;
  const controller = new AbortController();
  globalThis.fetch = async () => {
    controller.abort();
    throw new DOMException("Aborted", "AbortError");
  };
  try {
    await assert.rejects(
      () => collectSeason(5, [row], "26/27", controller.signal, () => {}),
      { name: "AbortError" },
    );
  } finally {
    globalThis.fetch = original;
  }
});

test("시즌 출전은 있는데 조회 경기가 없으면 0경기 분석으로 완료하지 않는다", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () =>
    Response.json({ data: [], pagination: { totalCount: 0 } });
  try {
    await assert.rejects(
      () =>
        collectSeason(
          5,
          [row],
          "26/27",
          new AbortController().signal,
          () => {},
        ),
      /출전 기록은 있지만/,
    );
  } finally {
    globalThis.fetch = original;
  }
});
