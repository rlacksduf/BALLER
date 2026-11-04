import test from "node:test";
import assert from "node:assert/strict";
import { parseProfile } from "../src/services/football.ts";
test("배열 응답에서 ID가 일치하는 선수의 프로필을 읽는다", () => {
  const p = parseProfile(
    [
      {
        id: 1,
        name: "Player",
        profile: {
          citizenship: "Norway",
          position: { main: "Forward" },
          club: { current: "City" },
        },
      },
    ],
    1,
  );
  assert.equal(p.club, "City");
  assert.equal(p.position, "Forward");
  assert.equal(p.height, null);
});
test("선택 속성이 누락되어도 통계와 독립적으로 기본 프로필을 표시한다", () => {
  const p = parseProfile({ id: 1, name: "Player" }, 1);
  assert.equal(p.name, "Player");
  assert.equal(p.club, null);
});
test("다른 ID 응답은 잘못된 선수로 표시하지 않는다", () => {
  assert.throws(() => parseProfile({ id: 2, name: "Other" }, 1));
});
