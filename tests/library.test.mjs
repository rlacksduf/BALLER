import test from "node:test";
import assert from "node:assert/strict";
import { percentile, metricPercentile } from "../src/utils/percentiles.ts";
import { aggregate } from "../src/utils/scouting.ts";
import { roleBattle } from "../src/utils/roleScores.ts";
import {
  getSelection,
  setSelection,
  addSelection,
} from "../src/services/selection.ts";
const aggregateOf = (goals, position = "Forward") =>
  aggregate(
    Array.from({ length: 3 }, () => ({
      position,
      minutes: 90,
      stats: { goalsScored: goals },
    })),
  );
test("백분위는 최소 표본·동률을 처리한다", () => {
  assert.equal(percentile(2, [1, 2, 3, 4]), null);
  assert.equal(percentile(2, [2, 2, 2, 2, 2]), 50);
  assert.equal(percentile(5, [1, 2, 3, 4, 5]), 90);
});
test("다른 시즌·포지션·대회와 누락 지표는 백분위 모집단에서 제외한다", () => {
  const players = Array.from({ length: 5 }, (_, i) => ({
    id: i + 1,
    aggregate: {
      season: "26/27",
      competition: "national league",
      data: aggregateOf(i + 1),
    },
  }));
  assert.equal(
    metricPercentile(
      aggregateOf(5),
      "goalsScored",
      players,
      "26/27",
      "national league",
    ).size,
    5,
  );
  assert.equal(
    metricPercentile(
      aggregateOf(5),
      "goalsScored",
      players,
      "25/26",
      "national league",
    ).value,
    null,
  );
  assert.equal(
    metricPercentile(
      aggregateOf(5, "Defender"),
      "goalsScored",
      players,
      "26/27",
      "national league",
    ).size,
    0,
  );
});
test("여섯 포지션 대결은 선택 순서에 관계없이 같은 주제를 사용한다", () => {
  const pairs = [
    ["Forward", "Defender", "공격 돌파"],
    ["Forward", "Goalkeeper", "마무리"],
    ["Forward", "Midfielder", "득점 생산"],
    ["Midfielder", "Defender", "빌드업"],
    ["Midfielder", "Goalkeeper", "기회 창출"],
    ["Defender", "Goalkeeper", "수비 저지"],
  ];
  for (const [a, b, label] of pairs) {
    assert.match(
      roleBattle(aggregateOf(1, a), aggregateOf(1, b)),
      new RegExp(label),
    );
    assert.match(
      roleBattle(aggregateOf(1, b), aggregateOf(1, a)),
      new RegExp(label),
    );
  }
});
test("비교 선택은 두 명만 유지하며 중복·세 번째 선택을 구별한다", () => {
  const original = globalThis.localStorage,
    originalWindow = globalThis.window;
  const storage = new Map();
  globalThis.localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  };
  globalThis.window = { dispatchEvent() {} };
  try {
    setSelection([]);
    assert.equal(addSelection({ id: 1, name: "A" }), "added");
    assert.equal(addSelection({ id: 1, name: "A" }), "exists");
    assert.equal(addSelection({ id: 2, name: "B" }), "added");
    assert.equal(addSelection({ id: 3, name: "C" }), "full");
    assert.equal(getSelection().length, 2);
    setSelection([
      { id: 3, name: "C" },
      { id: 2, name: "B" },
    ]);
    assert.equal(getSelection()[0].id, 3);
  } finally {
    globalThis.localStorage = original;
    globalThis.window = originalWindow;
  }
});

test("백분위는 표본 부족·출전시간 부족·누락값을 숫자로 만들지 않는다", () => {
  const players = Array.from({ length: 4 }, (_, i) => ({
    id: i + 1,
    aggregate: {
      season: "26/27",
      competition: "national league",
      data: aggregateOf(i + 1),
    },
  }));
  assert.equal(
    metricPercentile(
      aggregateOf(5),
      "goalsScored",
      players,
      "26/27",
      "national league",
    ).value,
    null,
  );
  assert.equal(
    metricPercentile(
      aggregateOf(5),
      "expectedAssists",
      players,
      "26/27",
      "national league",
    ).value,
    null,
  );
});
