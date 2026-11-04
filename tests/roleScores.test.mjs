import test from "node:test";
import assert from "node:assert/strict";
import { aggregate } from "../src/utils/scouting.ts";
import {
  roleScore,
  getRole,
  roleBattle,
  roleVerdict,
} from "../src/utils/roleScores.ts";
const data = (position = "Forward", extra = {}) =>
  aggregate(
    Array.from({ length: 3 }, () => ({
      minutes: 90,
      position,
      stats: {
        goalsScored: 1,
        assists: 0.4,
        shotsOnTarget: 2,
        passesKey: 2.5,
        dribblesSuccessful: 3,
        dribblesTotal: 4,
        passesSuccessful: 95,
        passesTotal: 100,
        tacklesTotal: 3,
        interceptionsTotal: 2,
        duelsWon: 3,
        duelsTotal: 4,
        goalsSaved: 4,
        goalsConceded: 1,
        ...extra,
      },
    })),
  );
test("API·프로필의 포지션 이름을 역할에 매핑한다", () => {
  assert.equal(getRole("Forward"), "FW");
  assert.equal(getRole("Centre-Back"), "DF");
  assert.equal(getRole("Midfielder"), "MF");
  assert.equal(getRole("Goalkeeper"), "GK");
  assert.equal(getRole("unknown"), null);
});
test("공개 목표값에서 점수는 100을 넘지 않는다", () => {
  const score = roleScore(data());
  assert.equal(score.overall, 100);
  assert.ok(
    Object.values(score.axes).every((v) => v === null || (v >= 0 && v <= 100)),
  );
});
test("같은 기록도 포지션에 맞는 가중치로 계산한다", () => {
  const a = roleScore(data("Forward", { goalsScored: 0, shotsOnTarget: 0 }));
  const b = roleScore(data("Defender", { goalsScored: 0, shotsOnTarget: 0 }));
  assert.ok(a.overall < b.overall);
});
test("미상 포지션과 작은 표본에는 종합 점수를 생성하지 않는다", () => {
  assert.equal(roleScore(data("unknown")).overall, null);
  assert.equal(
    roleScore(
      aggregate([
        { minutes: 90, position: "Forward", stats: { goalsScored: 4 } },
      ]),
    ).overall,
    null,
  );
});
test("누락값은 낮은 점수나 0점으로 치환하지 않는다", () => {
  const score = roleScore(
    data("Forward", { goalsScored: null, shotsOnTarget: null }),
  );
  assert.equal(score.axes.finishing, null);
  assert.equal(score.overall, null);
});
test("골키퍼 선방률을 실제 시도수로 계산한다", () => {
  const a = data("Goalkeeper");
  assert.equal(a.rates.saving, 80);
  assert.ok(roleScore(a).axes.goalkeeping > 80);
});
test("FW 대 DF·GK는 서로 다른 역할의 대결 설명을 생성한다", () => {
  assert.match(roleBattle(data(), data("Defender")), /공격 돌파 VS 수비 저지/);
  assert.match(roleBattle(data(), data("Goalkeeper")), /마무리 VS 골문 방어/);
});
test("전술 요약은 백분위나 우열을 주장하지 않는다", () => {
  assert.match(roleVerdict(data()), /포지션별로 가중치/);
});
