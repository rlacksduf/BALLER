import type { BattleReport } from "../utils/battleReport";
import { t, localized } from "../i18n";
import CohortPercentiles from "./CohortPercentiles";
import type { Aggregate } from "../utils/scouting";
import { roleScore, axisLabels } from "../utils/roleScores";
import type { AxisKey } from "../utils/roleScores";
export default function RoleComparison({
  left,
  right,
  leftName,
  rightName,
  mode,
  report,
  season,
  competition,
}: {
  left: Aggregate;
  right: Aggregate;
  leftName: string;
  rightName: string;
  mode: string;
  report: BattleReport;
  season: string;
  competition: string;
}) {
  const a = roleScore(left),
    b = roleScore(right);
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
      <p>
        {localized(
          "이번 상대와 비교한 90분당 기록·성공률 기준이에요.",
          "Compared with this opponent using per 90 stats and success rates.",
        )}
      </p>
      <div className="role-pair battle-pros-cons">
        {[
          { name: leftName, playerScore: a, playerSummary: report.left },
          { name: rightName, playerScore: b, playerSummary: report.right },
        ].map(({ name, playerScore, playerSummary }) => {
          return (
            <article key={name} className="battle-player-report">
              <h3>{name}</h3>
              <span className="report-role">
                {playerScore.role ?? t("포지션 미상")}
              </span>
              <h4 className="strength-heading">
                ＋ {localized("강점", "Strengths")}
              </h4>
              <ul>
                {playerSummary.strengths.length ? (
                  playerSummary.strengths.map((text) => (
                    <li key={text}>{text}</li>
                  ))
                ) : (
                  <li>
                    {localized(
                      report.compared
                        ? "상대보다 뚜렷하게 앞서는 분야는 없어요."
                        : "장점을 비교할 공통 기록이 아직 없어요.",
                      report.compared
                        ? "No clear edge over the opponent in shared categories."
                        : "No shared records to compare strengths yet.",
                    )}
                  </li>
                )}
              </ul>
              <h4 className="weakness-heading">
                − {localized("아쉬운 점", "Weaknesses")}
              </h4>
              <ul>
                {playerSummary.weaknesses.length ? (
                  playerSummary.weaknesses.map((text) => (
                    <li key={text}>{text}</li>
                  ))
                ) : (
                  <li>
                    {localized(
                      report.compared
                        ? "이번 비교에서는 뚜렷하게 밀리는 분야가 없어요."
                        : "약점을 비교할 공통 기록이 아직 없어요.",
                      report.compared
                        ? "No clear deficit in this matchup."
                        : "No shared records to compare weaknesses yet.",
                    )}
                  </li>
                )}
              </ul>
            </article>
          );
        })}
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
    </section>
  );
}
