import test from "node:test";
import assert from "node:assert/strict";
import { footballResponse } from "../server/highlightly.mjs";
const url = (query) => new URL("http://localhost/api/football?" + query);
test("잘못된 선수·경기·목록 요청을 업스트림 호출 전에 차단한다", async () => {
  const request = () => {
    throw new Error("must not call");
  };
  for (const query of [
    "name=x",
    "id=../key",
    "matchId=abc",
    "action=matches&team=A&league=B&season=2026&side=oops",
  ])
    assert.equal(
      (await footballResponse(url(query), "test", request)).status,
      400,
    );
});
test("동일 요청의 동시 호출은 한 번만 전송하고 성공 응답을 캐시한다", async () => {
  let calls = 0;
  const request = async () => {
    calls++;
    await new Promise((resolve) => setTimeout(resolve, 5));
    return new Response(JSON.stringify({ data: [] }));
  };
  await Promise.all([
    footballResponse(url("name=ConcurrentTest"), "test", request),
    footballResponse(url("name=ConcurrentTest"), "test", request),
  ]);
  await footballResponse(url("name=ConcurrentTest"), "test", request);
  assert.equal(calls, 1);
});
test("인증 실패 원문과 키를 클라이언트에 반환하지 않는다", async () => {
  const result = await footballResponse(
    url("name=AuthFailureTest"),
    "secret-key",
    async () => new Response("secret-key", { status: 401 }),
  );
  assert.equal(result.status, 502);
  assert.ok(!JSON.stringify(result.body).includes("secret-key"));
});
test("요청 한도 초과를 구별하고 실패 응답은 캐시하지 않는다", async () => {
  let calls = 0;
  const request = async () => {
    calls++;
    return new Response("", { status: 429 });
  };
  assert.equal(
    (await footballResponse(url("name=QuotaTest"), "test", request)).status,
    429,
  );
  await footballResponse(url("name=QuotaTest"), "test", request);
  assert.equal(calls, 2);
});

test("FC Barcelona / LaLiga가 빈 목록일 때 정확한 팀·리그 ID로 재조회한다", async () => {
  const paths = [];
  const request = async (input) => {
    const url = new URL(input);
    paths.push(url);
    if (url.pathname === "/teams")
      return Response.json({ data: [{ id: 450963, name: "Barcelona" }] });
    if (url.pathname === "/leagues")
      return Response.json({ data: [{ id: 119924, name: "La Liga" }] });
    if (
      url.searchParams.get("homeTeamId") === "450963" &&
      url.searchParams.get("leagueId") === "119924"
    )
      return Response.json({ data: [{ id: 42 }] });
    return Response.json({ data: [] });
  };
  const result = await footballResponse(
    url("action=matches&team=FC+Barcelona&league=LaLiga&season=2026&side=home"),
    "test",
    request,
  );
  assert.equal(result.status, 200);
  assert.equal(result.body.data[0].id, 42);
  assert.ok(
    paths.some((path) => path.searchParams.get("leagueName") === "La Liga"),
  );
});

test("같은 정규화 이름이 여러 팀에 해당하면 첫 번째 팀을 임의 선택하지 않는다", async () => {
  const { selectExactEntity } = await import("../server/highlightly.mjs");
  assert.equal(
    selectExactEntity(
      [
        { id: 1, name: "Barcelona" },
        { id: 2, name: "FC Barcelona" },
      ],
      "FC Barcelona",
    ),
    null,
  );
  assert.equal(
    selectExactEntity(
      [
        { id: 1, name: "Barcelona B" },
        { id: 2, name: "Barcelona" },
      ],
      "FC Barcelona",
    ).id,
    2,
  );
});

test("Saudi Pro League는 사우디의 Pro League에 연결하며 다른 국가의 동명 대회를 배제한다", async () => {
  const paths = [];
  const request = async (input) => {
    const path = new URL(input);
    paths.push(path);
    if (path.pathname === "/teams")
      return Response.json({ data: [{ id: 2501873, name: "Al-Nassr" }] });
    if (path.pathname === "/leagues")
      return Response.json({
        data: [
          { id: 10, name: "Pro League", country: { name: "Belgium" } },
          { id: 262041, name: "Pro League", country: { name: "Saudi Arabia" } },
        ],
      });
    if (
      path.searchParams.get("homeTeamId") === "2501873" &&
      path.searchParams.get("leagueId") === "262041"
    )
      return Response.json({ data: [{ id: 101 }] });
    return Response.json({ data: [] });
  };
  const result = await footballResponse(
    url(
      "action=matches&team=Al-Nassr+FC&league=Saudi+Pro+League&season=2026&side=home",
    ),
    "saudi-test",
    request,
  );
  assert.equal(result.status, 200);
  assert.equal(result.body.data[0].id, 101);
  assert.ok(
    paths.some(
      (path) =>
        path.pathname === "/leagues" &&
        path.searchParams.get("countryCode") === "SA",
    ),
  );
});
