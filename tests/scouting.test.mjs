import test from "node:test";
import assert from "node:assert/strict";
import { aggregate, scouting } from "../src/utils/scouting.ts";
import { newestSeasonFirst } from "../src/utils/seasons.ts";
const sample = (minutes, stats) => ({ minutes, position: "Forward", stats });
test("누락된 지표와 실제 0을 구별한다", () => {
  const data = aggregate([
    sample(90, { goalsScored: 0, expectedGoals: 0.5 }),
    sample(90, { goalsScored: 1 }),
  ]);
  assert.equal(data.totals.goalsScored, 1);
  assert.equal(data.totals.expectedGoals, null);
  assert.equal(data.coverage.expectedGoals, 1);
  assert.equal(data.per90.goalsScored, 0.5);
});
test("성공률은 경기별 평균이 아니라 전체 시도수로 계산한다", () => {
  const data = aggregate([
    sample(90, { passesTotal: 10, passesSuccessful: 10 }),
    sample(90, { passesTotal: 90, passesSuccessful: 45 }),
  ]);
  assert.ok(Math.abs(data.rates.passing - 55) < 1e-10);
});
test("0분·누락된 출전시간의 90분당 기록은 계산하지 않는다", () => {
  assert.equal(
    aggregate([sample(0, { goalsScored: 1 })]).per90.goalsScored,
    null,
  );
  assert.equal(
    aggregate([sample(null, { goalsScored: 1 })]).per90.goalsScored,
    null,
  );
});
test("빈 표본에는 0 합계나 강점 결론을 만들지 않는다", () => {
  const data = aggregate([]);
  assert.equal(data.totals.goalsScored, null);
  assert.equal(scouting(data).strengths.length, 0);
});
test("270분 미만이면 스타일 평가를 제한한다", () => {
  const report = scouting(aggregate([sample(90, { goalsScored: 3 })]));
  assert.equal(report.strengths.length, 0);
  assert.ok(report.limitations.length);
});
test("충분한 표본에서 규칙 기반 강점을 생성한다", () => {
  const report = scouting(
    aggregate([sample(360, { goalsScored: 4, passesKey: 8 })]),
  );
  assert.equal(report.strengths.length, 2);
  assert.match(report.verdict, /마무리/);
});
test("혼합된 시즌 형식을 시작 연도로 정렬한다", () => {
  assert.deepEqual(
    ["2025", "26/27", "2018", "25/26", "2024/25"].sort(newestSeasonFirst),
    ["26/27", "25/26", "2025", "2024/25", "2018"],
  );
});
