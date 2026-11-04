import type { Aggregate } from "./scouting";
export type Role = "FW" | "MF" | "DF" | "GK";
export type AxisKey =
  | "finishing"
  | "creation"
  | "carrying"
  | "passing"
  | "defending"
  | "goalkeeping";
export type RoleScore = {
  role: Role | null;
  axes: Record<AxisKey, number | null>;
  overall: number | null;
  eligible: boolean;
  coverage: number;
};
type Rule = {
  axis: AxisKey;
  label: string;
  source: "per90" | "rates";
  key: string;
  min: number;
  target: number;
  weight: number;
};
// 포트폴리오용 공개 규칙입니다. 리그 모집단의 평균/백분위가 아닙니다.
export const scoreRules: Rule[] = [
  {
    axis: "finishing",
    label: "90분당 득점",
    source: "per90",
    key: "goalsScored",
    min: 0,
    target: 0.8,
    weight: 0.6,
  },
  {
    axis: "finishing",
    label: "90분당 유효슈팅",
    source: "per90",
    key: "shotsOnTarget",
    min: 0,
    target: 2,
    weight: 0.4,
  },
  {
    axis: "creation",
    label: "90분당 키패스",
    source: "per90",
    key: "passesKey",
    min: 0,
    target: 2.5,
    weight: 0.7,
  },
  {
    axis: "creation",
    label: "90분당 도움",
    source: "per90",
    key: "assists",
    min: 0,
    target: 0.4,
    weight: 0.3,
  },
  {
    axis: "carrying",
    label: "90분당 성공 드리블",
    source: "per90",
    key: "dribblesSuccessful",
    min: 0,
    target: 3,
    weight: 0.65,
  },
  {
    axis: "carrying",
    label: "드리블 성공률(%)",
    source: "rates",
    key: "dribbling",
    min: 20,
    target: 75,
    weight: 0.35,
  },
  {
    axis: "passing",
    label: "패스 성공률(%)",
    source: "rates",
    key: "passing",
    min: 55,
    target: 95,
    weight: 1,
  },
  {
    axis: "defending",
    label: "90분당 태클",
    source: "per90",
    key: "tacklesTotal",
    min: 0,
    target: 3,
    weight: 0.4,
  },
  {
    axis: "defending",
    label: "90분당 가로채기",
    source: "per90",
    key: "interceptionsTotal",
    min: 0,
    target: 2,
    weight: 0.35,
  },
  {
    axis: "defending",
    label: "경합 승률(%)",
    source: "rates",
    key: "duels",
    min: 30,
    target: 75,
    weight: 0.25,
  },
  {
    axis: "goalkeeping",
    label: "선방률(%)",
    source: "rates",
    key: "saving",
    min: 40,
    target: 85,
    weight: 0.75,
  },
  {
    axis: "goalkeeping",
    label: "90분당 선방",
    source: "per90",
    key: "goalsSaved",
    min: 0,
    target: 4,
    weight: 0.25,
  },
];
export const axisLabels: Record<AxisKey, string> = {
  finishing: "마무리",
  creation: "기회 창출",
  carrying: "볼 운반",
  passing: "패스 안정성",
  defending: "수비 개입",
  goalkeeping: "골문 방어",
};
export const roleWeights: Record<Role, Partial<Record<AxisKey, number>>> = {
  FW: { finishing: 0.45, creation: 0.2, carrying: 0.2, passing: 0.15 },
  MF: { creation: 0.3, passing: 0.3, carrying: 0.2, defending: 0.2 },
  DF: { defending: 0.55, passing: 0.3, carrying: 0.15 },
  GK: { goalkeeping: 0.85, passing: 0.15 },
};
export function getRole(position: string): Role | null {
  if (/goalkeeper|^GK$/i.test(position)) return "GK";
  if (/defender|back|^DF$/i.test(position)) return "DF";
  if (/midfield|^MF$/i.test(position)) return "MF";
  if (/forward|striker|winger|^FW$/i.test(position)) return "FW";
  return null;
}
export function roleScore(data: Aggregate): RoleScore {
  const role = getRole(data.position),
    eligible = data.minutes !== null && data.minutes >= 270 && data.count >= 3;
  const axes = {} as Record<AxisKey, number | null>;
  for (const axis of Object.keys(axisLabels) as AxisKey[]) {
    const rules = scoreRules.filter((rule) => rule.axis === axis);
    let weighted = 0,
      weight = 0;
    for (const rule of rules) {
      const value = data[rule.source][rule.key];
      if (typeof value !== "number" || !Number.isFinite(value)) continue;
      weighted +=
        Math.max(
          0,
          Math.min(100, ((value - rule.min) / (rule.target - rule.min)) * 100),
        ) * rule.weight;
      weight += rule.weight;
    }
    axes[axis] =
      eligible && weight >= 0.7 ? Math.round(weighted / weight) : null;
  }
  if (!role) return { role: null, axes, overall: null, eligible, coverage: 0 };
  const entries = Object.entries(roleWeights[role]) as [AxisKey, number][];
  let sum = 0,
    coverage = 0;
  for (const [axis, weight] of entries)
    if (axes[axis] !== null) {
      sum += axes[axis]! * weight;
      coverage += weight;
    }
  return {
    role,
    axes,
    overall: eligible && coverage >= 0.8 ? Math.round(sum / coverage) : null,
    eligible,
    coverage,
  };
}
export function roleVerdict(data: Aggregate): string {
  const score = roleScore(data);
  if (!score.eligible)
    return "최소 3경기·270분을 충족하지 않아 포지션 점수와 전술 적합성 판단을 보류합니다.";
  if (!score.role)
    return "포지션 정보가 부족해 역할 가중 종합 점수를 계산하지 않습니다.";
  const axes = Object.keys(roleWeights[score.role]) as AxisKey[];
  const sorted = axes
    .filter((axis) => score.axes[axis] !== null)
    .sort((a, b) => score.axes[b]! - score.axes[a]!);
  if (!sorted.length) return "역할 분석에 필요한 상세 지표가 부족합니다.";
  const best = sorted[0]!,
    weak = sorted.at(-1)!;
  return `${score.role} 기준으로 ${axisLabels[best]} 지표가 가장 두드러집니다(${score.axes[best]}/100). ${score.axes[weak]! < 40 ? `${axisLabels[weak]} 지표는 낮게 계산되어 전술과 경기 상황을 함께 확인해야 합니다.` : "여러 역할의 기여를 함께 확인할 수 있습니다."} 포지션별로 가중치가 달라 종합 점수를 다른 포지션의 우열 판단에 사용하지 않습니다.`;
}
export function roleBattle(a: Aggregate, b: Aggregate): string {
  const left = roleScore(a),
    right = roleScore(b);
  if (!left.eligible || !right.eligible)
    return "한쪽 이상의 표본이 3경기·270분에 미달해 역할 대결 결론을 보류합니다.";
  if (!left.role || !right.role)
    return "두 선수의 포지션을 확인할 수 없어 역할 대결을 보류합니다.";
  const roles = [left.role, right.role];
  if (roles.includes("FW") && roles.includes("DF"))
    return "공격 돌파 VS 수비 저지: 공격수의 마무리·볼 운반과 수비수의 수비 개입·패스 안정성을 각각 확인하세요. 서로 직접 맞붙은 경기 결과를 예측하는 점수는 아닙니다.";
  if (roles.includes("FW") && roles.includes("GK"))
    return "마무리 VS 골문 방어: 공격수의 유효슈팅·득점과 골키퍼의 선방률·선방 기록을 각각 평가합니다. 상대 슈팅 난도와 실제 맞대결 여부는 반영하지 않습니다.";
  if (roles.includes("FW") && roles.includes("MF"))
    return "득점 생산 VS 기회 창출: 공격수의 마무리와 미드필더의 키패스·패스 안정성을 확인하세요.";
  if (roles.includes("MF") && roles.includes("GK"))
    return "기회 창출 VS 골문 보호: 미드필더의 찬스 생산과 골키퍼의 선방률을 각자의 역할로 평가합니다.";
  if (roles.includes("DF") && roles.includes("GK"))
    return "수비 저지 VS 골문 보호: 수비수의 태클·가로채기와 골키퍼의 선방 기록을 별도로 확인하세요.";
  if (roles.includes("MF") && roles.includes("DF"))
    return "빌드업 VS 수비 개입: 미드필더의 기회 창출·패스와 수비수의 가로채기·경합 기여를 확인하세요.";
  if (left.role === right.role)
    return `같은 ${left.role} 역할의 지표를 비교합니다. 동일 포지션이어도 전술과 리그 환경의 차이가 있습니다.`;
  return `${left.role} VS ${right.role}: 각 포지션에 맞는 역할 가중치를 적용합니다. 다른 역할의 종합 점수로 승패를 매기지 않습니다.`;
}
