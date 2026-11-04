import { t } from "../i18n";
import CohortPercentiles from "./CohortPercentiles";
import type { Aggregate } from "../utils/scouting";
import {
  roleBattle,
  roleScore,
  roleVerdict,
  axisLabels,
} from "../utils/roleScores";
import type { AxisKey } from "../utils/roleScores";
export default function RoleComparison({
  left,
  right,
  leftName,
  rightName,
  mode,
  season,
  competition,
}: {
  left: Aggregate;
  right: Aggregate;
  leftName: string;
  rightName: string;
  mode: string;
  season: string;
  competition: string;
}) {
  const a = roleScore(left),
    b = roleScore(right);
  const comparable =
    a.eligible &&
    b.eligible &&
    a.role !== null &&
    a.role === b.role &&
    a.overall !== null &&
    b.overall !== null;
  const diff = comparable ? a.overall! - b.overall! : 0;
  return (
    <section className="api-search role-battle-panel">
      <span className="status-label">
        {mode === "role"
          ? "ROLE BATTLE"
          : mode === "overall"
            ? "ROLE INDEX COMPARISON"
            : "SCOUTING COMPARISON"}
      </span>
      <h2>
        {mode === "role"
          ? t("포지션 대결")
          : mode === "overall"
            ? t("종합 비교")
            : t("플레이 스타일 비교")}
      </h2>
      <p>{t(roleBattle(left, right))}</p>
      <div className="role-pair">
        <div>
          <h3>{leftName}</h3>
          <strong>
            {a.role ?? t("포지션 미상")} · {a.overall ?? "—"} / 100
          </strong>
          <p>{t(roleVerdict(left))}</p>
        </div>
        <div>
          <h3>{rightName}</h3>
          <strong>
            {b.role ?? t("포지션 미상")} · {b.overall ?? "—"} / 100
          </strong>
          <p>{t(roleVerdict(right))}</p>
        </div>
      </div>
      {mode !== "basic" && (
        <div className="api-table-wrap">
          <table>
            <caption>{t("역할별 규칙 점수 · 0~100")}</caption>
            <thead>
              <tr>
                <th>{t("역할 지표")}</th>
                <th>{leftName}</th>
                <th>{rightName}</th>
              </tr>
            </thead>
            <tbody>
              {(Object.keys(axisLabels) as AxisKey[])
                .filter(
                  (axis) =>
                    axis !== "goalkeeping" ||
                    a.role === "GK" ||
                    b.role === "GK",
                )
                .map((axis) => (
                  <tr key={axis}>
                    <th scope="row">{t(axisLabels[axis])}</th>
                    <td>{a.axes[axis] ?? "—"}</td>
                    <td>{b.axes[axis] ?? "—"}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
      {mode === "overall" && (
        <div className="role-pair">
          <div>
            <h3>{leftName}</h3>
            <CohortPercentiles
              data={left}
              season={season}
              competition={competition}
            />
          </div>
          <div>
            <h3>{rightName}</h3>
            <CohortPercentiles
              data={right}
              season={season}
              competition={competition}
            />
          </div>
        </div>
      )}
      <h3>{t("전술적 역할 결론")}</h3>
      <p>
        {comparable
          ? Math.abs(diff) < 5
            ? t(
                "두 선수의 역할 지수가 비슷합니다. 세부 강점과 전술적 필요에 따라 선택하세요.",
              )
            : `${diff > 0 ? leftName : rightName}의 같은 포지션 역할 지수가 ${Math.abs(diff)}점 높습니다. 수집 범위가 다른 규칙 지수의 차이이며 선수 능력의 우열을 확정하지 않습니다.`
          : t(
              "서로 다른 포지션이거나 표본·지표가 부족하므로 종합 점수로 우열을 정하지 않습니다. 각자의 역할 강점으로 판단하세요.",
            )}
      </p>
    </section>
  );
}
