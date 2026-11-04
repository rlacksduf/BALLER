export type Sample = {
  minutes: number | null;
  position: string;
  stats: Record<string, number | string | null>;
};
export const metrics = [
  ["goalsScored", "득점"],
  ["assists", "도움"],
  ["shotsTotal", "슈팅"],
  ["shotsOnTarget", "유효슈팅"],
  ["passesKey", "키패스"],
  ["passesTotal", "전체 패스"],
  ["passesSuccessful", "성공 패스"],
  ["dribblesTotal", "드리블 시도"],
  ["dribblesSuccessful", "드리블 성공"],
  ["duelsTotal", "경합"],
  ["duelsWon", "경합 승리"],
  ["tacklesTotal", "태클"],
  ["interceptionsTotal", "가로채기"],
  ["goalsSaved", "선방"],
  ["goalsConceded", "실점"],
  ["expectedGoals", "xG"],
  ["expectedAssists", "xA"],
] as const;
export type Aggregate = {
  count: number;
  minutes: number | null;
  position: string;
  totals: Record<string, number | null>;
  coverage: Record<string, number>;
  per90: Record<string, number | null>;
  rates: Record<string, number | null>;
};
export function aggregate(samples: Sample[]): Aggregate {
  const minutes =
    samples.length && samples.every((s) => s.minutes !== null)
      ? samples.reduce((sum, s) => sum + s.minutes!, 0)
      : null;
  const totals: Record<string, number | null> = {},
    coverage: Record<string, number> = {},
    per90: Record<string, number | null> = {};
  for (const [key] of metrics) {
    const values = samples
      .map((s) => s.stats[key])
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    coverage[key] = values.length;
    totals[key] =
      values.length === samples.length && samples.length > 0
        ? values.reduce((sum, v) => sum + v, 0)
        : null;
    per90[key] =
      totals[key] !== null && minutes !== null && minutes > 0
        ? (totals[key]! / minutes) * 90
        : null;
  }
  const rate = (a: string, b: string) =>
    totals[a] !== null && totals[b] !== null && totals[b]! > 0
      ? (totals[a]! / totals[b]!) * 100
      : null;
  const positions = samples.map((s) => s.position).filter((s) => s !== "—");
  const position =
    positions.sort(
      (a, b) =>
        positions.filter((p) => p === b).length -
        positions.filter((p) => p === a).length,
    )[0] ?? "—";
  return {
    count: samples.length,
    minutes,
    position,
    totals,
    coverage,
    per90,
    rates: {
      passing: rate("passesSuccessful", "passesTotal"),
      dribbling: rate("dribblesSuccessful", "dribblesTotal"),
      duels: rate("duelsWon", "duelsTotal"),
      shots: rate("shotsOnTarget", "shotsTotal"),
      saving:
        totals.goalsSaved !== null &&
        totals.goalsConceded !== null &&
        totals.goalsSaved! + totals.goalsConceded! > 0
          ? (totals.goalsSaved! /
              (totals.goalsSaved! + totals.goalsConceded!)) *
            100
          : null,
    },
  };
}
export function scouting(data: Aggregate): {
  strengths: string[];
  limitations: string[];
  verdict: string;
} {
  if (data.minutes === null || data.minutes < 270)
    return {
      strengths: [],
      limitations: [
        "분석 가능한 출전시간이 270분 미만이거나 누락되어 스타일 평가를 제한합니다.",
      ],
      verdict: "기록을 더 수집한 뒤 평가할 수 있습니다.",
    };
  const strengths: string[] = [],
    limitations: string[] = [];
  const g = data.per90.goalsScored,
    k = data.per90.passesKey,
    t = data.per90.tacklesTotal,
    d = data.per90.dribblesSuccessful;
  if (g !== null && g !== undefined && g >= 0.5)
    strengths.push(
      "90분당 0.5골 이상으로 수집 범위에서 득점 생산성이 높습니다.",
    );
  if (k !== null && k !== undefined && k >= 1.5)
    strengths.push("90분당 키패스 1.5회 이상으로 기회 창출에 기여합니다.");
  if (d !== null && d !== undefined && d >= 1.5)
    strengths.push(
      "90분당 성공 드리블 1.5회 이상으로 볼 운반 역할을 보여줍니다.",
    );
  if (t !== null && t !== undefined && t >= 2)
    strengths.push("90분당 태클 2회 이상으로 적극적인 수비 개입을 보여줍니다.");
  if (data.rates.passing !== null && data.rates.passing! < 70)
    limitations.push(
      "수집 범위에서 패스 성공률이 70% 미만입니다. 패스 난도와 전술 맥락을 함께 확인해야 합니다.",
    );
  if (
    data.totals.expectedGoals !== null &&
    data.totals.goalsScored !== null &&
    data.totals.goalsScored! < data.totals.expectedGoals! - 2
  )
    limitations.push(
      "득점이 xG보다 2골 이상 적습니다. 제한된 표본에서 결정력 편차가 관찰됩니다.",
    );
  if (metrics.some(([key]) => data.totals[key] === null))
    limitations.push(
      "일부 세부 지표가 누락되어 해당 지표의 평가를 제외합니다.",
    );
  const role =
    data.position === "Goalkeeper"
      ? "골문 방어"
      : g !== null && g !== undefined && g >= 0.5
        ? "마무리"
        : k !== null && k !== undefined && k >= 1.5
          ? "기회 창출"
          : t !== null && t !== undefined && t >= 2
            ? "수비 개입"
            : "균형적인 경기 참여";
  return {
    strengths,
    limitations,
    verdict: `수집한 ${data.count}경기에서는 ${role} 역할의 기록이 관찰됩니다. 규칙 기반 요약이며 포지션별 백분위나 선수 전체 능력 순위는 아닙니다.`,
  };
}
