import AnimatedNumber from "./AnimatedNumber";
import { t } from "../i18n";
import {
  axisLabels,
  roleScore,
  roleVerdict,
  scoreRules,
  roleWeights,
} from "../utils/roleScores";
import type { AxisKey } from "../utils/roleScores";
import type { Aggregate } from "../utils/scouting";
export default function RoleScoreCard({ data }: { data: Aggregate }) {
  const score = roleScore(data);
  const axes = (Object.keys(axisLabels) as AxisKey[]).filter(
    (axis) => axis !== "goalkeeping" || score.role === "GK",
  );
  return (
    <section className="role-score-card">
      <div className="score-heading">
        <div>
          <span className="status-label">
            ROLE INDEX · {score.role ?? "UNKNOWN"}
          </span>
          <h3>{t("포지션별 역할 점수")}</h3>
        </div>
        <div
          className="score-number"
          aria-label={`역할 종합 점수 ${score.overall ?? "평가 보류"}`}
        >
          <AnimatedNumber value={score.overall} />
          <small>/ 100</small>
        </div>
      </div>
      <p>
        {t(
          "선택한 수집 범위의 기록을 공개 규칙으로 정규화한 지수입니다. 리그 백분위나 경기력 순위가 아닙니다.",
        )}
      </p>
      <div className="role-axis-list">
        {axes.map((axis) => (
          <div key={axis}>
            <div className="axis-label">
              <span>{t(axisLabels[axis])}</span>
              <strong>{score.axes[axis] ?? "—"}</strong>
            </div>
            <div
              className="role-track"
              role="meter"
              aria-label={t(axisLabels[axis])}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={score.axes[axis] ?? undefined}
              aria-valuetext={
                score.axes[axis] === null
                  ? t("표본 또는 지표 부족")
                  : `${score.axes[axis]}점`
              }
            >
              <span style={{ width: `${score.axes[axis] ?? 0}%` }} />
            </div>
          </div>
        ))}
      </div>
      <p className="role-verdict">{t(roleVerdict(data))}</p>
      <details className="score-method">
        <summary>{t("계산 기준과 가중치 보기")}</summary>
        <p>
          {t(
            "각 지표는 (값 − 하한) ÷ (목표 − 하한) × 100으로 계산하고 0~100으로 제한합니다. 한 축의 지표 가중치가 70% 이상, 종합의 역할 가중치가 80% 이상 확보되어야 계산합니다. 최소 표본은 3경기·270분입니다. 선방 횟수에는 상대 슈팅량의 영향이 있습니다.",
          )}
        </p>
        {score.role && (
          <p>
            {Object.entries(roleWeights[score.role])
              .map(
                ([axis, weight]) =>
                  `${t(axisLabels[axis as AxisKey])} ${Math.round(weight! * 100)}%`,
              )
              .join(" · ")}
          </p>
        )}
        <div className="api-table-wrap">
          <table>
            <caption>
              {t("학습용 규칙 · 실제 리그 분포로 학습한 기준이 아닙니다.")}
            </caption>
            <thead>
              <tr>
                <th>{t("역할")}</th>
                <th>{t("지표")}</th>
                <th>{t("하한")}</th>
                <th>{t("목표")}</th>
                <th>{t("축 내 가중치")}</th>
              </tr>
            </thead>
            <tbody>
              {scoreRules.map((rule) => (
                <tr key={rule.axis + rule.key}>
                  <td>{t(axisLabels[rule.axis])}</td>
                  <td>{t(rule.label)}</td>
                  <td>{rule.min}</td>
                  <td>{rule.target}</td>
                  <td>{Math.round(rule.weight * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
