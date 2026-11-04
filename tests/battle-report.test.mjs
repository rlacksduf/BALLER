import test from "node:test";
import assert from "node:assert/strict";
import { buildBattleReport } from "../src/utils/battleReport.ts";
const player = (position, per90 = {}, rates = {}) => ({
  count: 5,
  minutes: 450,
  position,
  totals: {},
  coverage: {},
  per90,
  rates,
});
test("마무리와 창출의 실제 차이로 두 선수 장단점과 결과를 만든다", () => {
  const a = player(
    "Forward",
    {
      goalsScored: 1,
      shotsOnTarget: 2,
      passesKey: 0.5,
      assists: 0,
      passesTotal: 12,
    },
    { passing: 65 },
  );
  const b = player(
    "Midfielder",
    {
      goalsScored: 0.25,
      shotsOnTarget: 0.5,
      passesKey: 3,
      assists: 0.5,
      passesTotal: 100,
    },
    { passing: 90 },
  );
  const report = buildBattleReport(a, b, "Haaland", "Foden");
  assert.ok(report.left.strengths.some((text) => text.includes("마무리")));
  assert.ok(report.left.weaknesses.some((text) => text.includes("기회 창출")));
  assert.ok(report.right.strengths.some((text) => text.includes("기회 창출")));
  assert.match(report.verdict.join(" "), /득점이 필요하면 Haaland/);
  assert.match(report.verdict.join(" "), /찬스를 만들려면 Foden/);
  assert.ok(!report.verdict.join(" ").includes("전체 패스"));
  assert.ok(!report.verdict.join(" ").includes("우열을 단정"));
});
test("누락값은 약점이나 상대 승리로 바꾸지 않으며 동일 기록은 박빙으로 처리한다", () => {
  const a = player("Forward", { goalsScored: null, shotsOnTarget: null }),
    b = player("Forward", { goalsScored: 2, shotsOnTarget: 3 });
  const missing = buildBattleReport(a, b, "A", "B");
  assert.equal(missing.compared, 0);
  assert.deepEqual(missing.left.weaknesses, []);
  assert.deepEqual(missing.right.strengths, []);
  const tie = buildBattleReport(b, b, "A", "B");
  assert.equal(tie.left.strengths.length, 0);
  assert.match(tie.verdict[0], /박빙/);
});
test("선수 순서를 바꿔도 같은 선수의 강점은 유지된다", () => {
  const a = player("Forward", { goalsScored: 1 }),
    b = player("Forward", { goalsScored: 0.2 });
  const forward = buildBattleReport(a, b, "A", "B"),
    reverse = buildBattleReport(b, a, "B", "A");
  assert.deepEqual(forward.left.strengths, reverse.right.strengths);
  assert.deepEqual(forward.right.weaknesses, reverse.left.weaknesses);
});
test("성공률에는 퍼센트를 쓰고 한 분야만으로 전체 승자를 만들지 않는다", () => {
  const report = buildBattleReport(
    player("Midfielder", {}, { passing: 90 }),
    player("Midfielder", {}, { passing: 70 }),
    "A",
    "B",
    "en",
  );
  assert.match(report.left.strengths[0], /90% vs 70%/);
  assert.ok(!report.left.strengths[0].includes("per 90"));
  assert.ok(!report.verdict.join(" ").includes("gets the pick"));
});
test("골키퍼를 공격수의 득점 지표로 평가하지 않고 0경기에는 결과를 만들지 않는다", () => {
  const keeper = player(
      "Goalkeeper",
      { goalsScored: 0 },
      { passing: 80, saving: 90 },
    ),
    forward = player("Forward", { goalsScored: 1 }, { passing: 70 });
  assert.ok(
    !buildBattleReport(keeper, forward, "GK", "FW").left.weaknesses.some(
      (text) => text.includes("마무리"),
    ),
  );
  const empty = buildBattleReport({ ...keeper, count: 0 }, forward, "A", "B");
  assert.equal(empty.compared, 0);
});
