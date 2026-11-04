import { t } from "../i18n";
import { useSyncExternalStore } from "react";
import { getCatalog, subscribeCatalog } from "../services/catalog";
import { metricPercentile } from "../utils/percentiles";
import type { Aggregate } from "../utils/scouting";
import { metrics } from "../utils/scouting";
export default function CohortPercentiles({
  data,
  season,
  competition,
}: {
  data: Aggregate;
  season: string;
  competition: string;
}) {
  const players = useSyncExternalStore(subscribeCatalog, getCatalog);
  const entries = metrics
    .filter(
      ([key]) =>
        !["goalsSaved", "goalsConceded"].includes(key) ||
        data.position === "Goalkeeper",
    )
    .map(([key, label]) => ({
      key,
      label,
      ...metricPercentile(data, key, players, season, competition),
    }));
  return (
    <section className="cohort-panel">
      <h3>{t("같은 포지션 표본 내 백분위")}</h3>
      <p>
        {t(
          "이 브라우저에서 수집한 같은 시즌·대회 유형·포지션 선수 기준입니다. 같은 리그 전체의 백분위가 아니며 지표별로 최소 5명·선수별 3경기·270분이 필요합니다.",
        )}
      </p>
      <div className="api-table-wrap">
        <table>
          <caption>
            {season} ·{" "}
            {t("90분당 기록의 표본 백분위 · 동률은 중간 순위로 계산")}
          </caption>
          <thead>
            <tr>
              <th>{t("지표")}</th>
              <th>{t("백분위")}</th>
              <th>{t("유효 표본")}</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.key}>
                <th scope="row">{t(e.label)}</th>
                <td>
                  {e.value === null
                    ? t("표본 부족")
                    : `${e.value} ${t("백분위")}`}
                </td>
                <td>
                  {e.size} {t("명")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
