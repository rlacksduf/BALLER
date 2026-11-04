import type { Aggregate } from "./scouting.ts";
import { getRole, roleWeights } from "./roleScores.ts";
import type { AxisKey } from "./roleScores.ts";
export type BattleReport = {
  left: { strengths: string[]; weaknesses: string[] };
  right: { strengths: string[]; weaknesses: string[] };
  verdict: string[];
  compared: number;
};
type Metric = {
  key: string;
  ko: string;
  en: string;
  target: number;
  rate?: boolean;
};
type Category = {
  axis: AxisKey;
  ko: string;
  en: string;
  needKo: string;
  needEn: string;
  metrics: Metric[];
};
const categories: Category[] = [
  {
    axis: "finishing",
    ko: "마무리",
    en: "finishing",
    needKo: "득점이 필요하면",
    needEn: "For goals, pick",
    metrics: [
      { key: "goalsScored", ko: "득점", en: "goals", target: 0.8 },
      {
        key: "shotsOnTarget",
        ko: "유효슈팅",
        en: "shots on target",
        target: 2,
      },
    ],
  },
  {
    axis: "creation",
    ko: "기회 창출",
    en: "chance creation",
    needKo: "찬스를 만들려면",
    needEn: "For chance creation, pick",
    metrics: [
      { key: "passesKey", ko: "키패스", en: "key passes", target: 2.5 },
      { key: "assists", ko: "도움", en: "assists", target: 0.4 },
    ],
  },
  {
    axis: "carrying",
    ko: "드리블",
    en: "dribbling",
    needKo: "돌파가 필요하면",
    needEn: "For dribbling, pick",
    metrics: [
      {
        key: "dribblesSuccessful",
        ko: "성공 드리블",
        en: "successful dribbles",
        target: 3,
      },
      {
        key: "dribbling",
        ko: "드리블 성공률",
        en: "dribble success rate",
        target: 100,
        rate: true,
      },
    ],
  },
  {
    axis: "passing",
    ko: "패스 안정성",
    en: "passing security",
    needKo: "패스 연결을 맡기려면",
    needEn: "For reliable passing, pick",
    metrics: [
      {
        key: "passing",
        ko: "패스 성공률",
        en: "pass completion",
        target: 100,
        rate: true,
      },
    ],
  },
  {
    axis: "defending",
    ko: "수비 개입",
    en: "defensive involvement",
    needKo: "수비에 힘을 더하려면",
    needEn: "For defensive involvement, pick",
    metrics: [
      { key: "tacklesTotal", ko: "태클", en: "tackles", target: 3 },
      {
        key: "interceptionsTotal",
        ko: "가로채기",
        en: "interceptions",
        target: 2,
      },
      {
        key: "duels",
        ko: "경합 승률",
        en: "duel win rate",
        target: 100,
        rate: true,
      },
    ],
  },
  {
    axis: "goalkeeping",
    ko: "선방",
    en: "shot stopping",
    needKo: "골문을 맡기려면",
    needEn: "For shot stopping, pick",
    metrics: [
      { key: "saving", ko: "선방률", en: "save rate", target: 100, rate: true },
    ],
  },
];
const number = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;
export function buildBattleReport(
  left: Aggregate,
  right: Aggregate,
  leftName: string,
  rightName: string,
  language: "ko" | "en" = "ko",
): BattleReport {
  const en = language === "en";
  const report: BattleReport = {
    left: { strengths: [], weaknesses: [] },
    right: { strengths: [], weaknesses: [] },
    verdict: [],
    compared: 0,
  };
  if (left.count < 1 || right.count < 1) {
    report.verdict = [
      en
        ? "No shared detailed stats yet. Add records for both players to start the battle."
        : "함께 비교할 상세 스탯이 아직 없어요. 두 선수의 기록이 모이면 대결 결과가 나와요.",
    ];
    return report;
  }
  const leftRole = getRole(left.position),
    rightRole = getRole(right.position);
  const fmt = (value: number) =>
    value.toLocaleString(en ? "en-US" : "ko-KR", { maximumFractionDigits: 2 });
  const shared = categories.flatMap((category) => {
    if (
      category.axis === "goalkeeping" &&
      (leftRole !== "GK" || rightRole !== "GK")
    )
      return [];
    if (
      (leftRole === "GK" || rightRole === "GK") &&
      category.axis !== "passing" &&
      category.axis !== "goalkeeping"
    )
      return [];
    if (
      leftRole &&
      leftRole === rightRole &&
      !(category.axis in roleWeights[leftRole])
    )
      return [];
    const facts = category.metrics.flatMap((metric) => {
      const a = (metric.rate ? left.rates : left.per90)[metric.key],
        b = (metric.rate ? right.rates : right.per90)[metric.key];
      if (
        !number(a) ||
        !number(b) ||
        (!metric.rate && (!(left.minutes! > 0) || !(right.minutes! > 0))) ||
        (a === 0 && b === 0)
      )
        return [];
      return [{ metric, a, b, diff: (a - b) / Math.max(metric.target, a, b) }];
    });
    if (!facts.length) return [];
    return [
      {
        category,
        facts,
        diff: facts.reduce((sum, fact) => sum + fact.diff, 0) / facts.length,
      },
    ];
  });
  report.compared = shared.length;
  const leads = shared
    .filter((item) => Math.abs(item.diff) >= 0.06)
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
  function factText(
    item: (typeof leads)[number],
    side: "left" | "right",
    strength: boolean,
  ) {
    const sign = side === "left" ? 1 : -1;
    const facts = [...item.facts].sort(
      (a, b) => (strength ? 1 : -1) * sign * (b.diff - a.diff),
    );
    const fact =
      facts.find((f) => (strength ? 1 : -1) * sign * f.diff > 0) ?? facts[0]!;
    const own = side === "left" ? fact.a : fact.b,
      other = side === "left" ? fact.b : fact.a;
    const label = en ? fact.metric.en : fact.metric.ko;
    const values = fact.metric.rate
      ? `${fmt(own)}% vs ${fmt(other)}%`
      : `${fmt(own)} vs ${fmt(other)}`;
    return en
      ? `${item.category.en}: ${label} ${values}${fact.metric.rate ? "" : " per 90"} — ${strength ? "ahead of" : "behind"} the opponent.`
      : `${item.category.ko} ${strength ? "우세" : "아쉬움"} · ${fact.metric.rate ? "" : "90분당 "}${label} ${values}`;
  }
  for (const item of leads) {
    const winner = item.diff > 0 ? "left" : "right",
      loser = winner === "left" ? "right" : "left";
    report[winner].strengths.push(factText(item, winner, true));
    report[loser].weaknesses.push(factText(item, loser, false));
  }
  report.left.strengths = report.left.strengths.slice(0, 3);
  report.left.weaknesses = report.left.weaknesses.slice(0, 3);
  report.right.strengths = report.right.strengths.slice(0, 3);
  report.right.weaknesses = report.right.weaknesses.slice(0, 3);
  const a = leads.find((item) => item.diff > 0),
    b = leads.find((item) => item.diff < 0);
  function headline(item: (typeof leads)[number]) {
    const winner = item.diff > 0 ? leftName : rightName;
    const fact = [...item.facts].sort(
      (x, y) => Math.sign(item.diff) * (y.diff - x.diff),
    )[0]!;
    const own = item.diff > 0 ? fact.a : fact.b,
      opponent = item.diff > 0 ? fact.b : fact.a;
    const values = fact.metric.rate
      ? `${fmt(own)}% vs ${fmt(opponent)}%`
      : `${fmt(own)} vs ${fmt(opponent)}`;
    return en
      ? `${winner} leads in ${item.category.en}, with ${fact.metric.en} at ${values}${fact.metric.rate ? "" : " per 90"}.`
      : `${winner}의 무기는 ${item.category.ko}! ${fact.metric.rate ? "" : "90분당 "}${fact.metric.ko} ${values}의 기록으로 앞서요.`;
  }
  if (a) report.verdict.push(headline(a));
  if (b) report.verdict.push(headline(b));
  if (a && b) {
    report.verdict.push(
      en
        ? `${a.category.needEn} ${leftName}; ${b.category.needEn.toLowerCase()} ${rightName}. Two different weapons in this matchup!`
        : `${a.category.needKo} ${leftName}, ${b.category.needKo} ${rightName}. 서로 다른 무기를 가진 두 선수의 대결이에요!`,
    );
  } else if (leads.length) {
    const winner = a ? leftName : rightName;
    report.verdict.push(
      leads.length >= 2
        ? en
          ? `${winner} gets the pick in this stat battle, leading ${leads.length} of ${shared.length} comparable categories!`
          : `비교한 ${shared.length}개 분야 중 ${leads.length}개에서 앞선 ${winner}, 이번 스탯 대결의 픽이에요!`
        : en
          ? `The clear edge in this matchup is ${winner}'s ${leads[0]!.category.en}.`
          : `이번 대결의 차이는 ${winner}의 ${leads[0]!.category.ko}! 이 분야에서는 한 표를 줄 만해요.`,
    );
  } else if (shared.length) {
    report.verdict.push(
      en
        ? "A close matchup! The shared stats show no clear edge this time."
        : "이번 대결은 박빙! 함께 비교한 스탯에서는 뚜렷하게 앞서는 분야가 없어요.",
    );
  } else {
    report.verdict.push(
      en
        ? "No shared detailed stats yet. Add records for both players to start the battle."
        : "함께 비교할 상세 스탯이 아직 없어요. 두 선수의 기록이 모이면 대결 결과가 나와요.",
    );
  }
  return report;
}
