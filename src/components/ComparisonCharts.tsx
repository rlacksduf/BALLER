import { t } from "../i18n";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";
import { axisLabels, roleScore } from "../utils/roleScores";
import type { AxisKey } from "../utils/roleScores";
import type { Aggregate } from "../utils/scouting";
import { metrics } from "../utils/scouting";
export default function ComparisonCharts({
  left,
  right,
  leftName,
  rightName,
  unit,
}: {
  left: Aggregate;
  right: Aggregate;
  leftName: string;
  rightName: string;
  unit: string;
}) {
  const a = roleScore(left),
    b = roleScore(right);
  const radar = (Object.keys(axisLabels) as AxisKey[])
    .filter(
      (key) =>
        a.axes[key] !== null &&
        b.axes[key] !== null &&
        (key !== "goalkeeping" || (a.role === "GK" && b.role === "GK")),
    )
    .map((key) => ({
      axis: t(axisLabels[key]),
      a: a.axes[key],
      b: b.axes[key],
    }));
  return (
    <section className="api-search">
      <h2>{t("플레이 스타일 차트")}</h2>
      <p>
        {t("레이더는 공개 규칙의 0~100 역할 지수입니다. 막대는")}{" "}
        {unit === "total" ? t("수집 경기 합계") : t("90분당 기록")}{" "}
        {t(
          "이며 각 행의 최댓값에 맞춰 길이를 표시합니다. 길이가 서로 다른 지표끼리 직접 비교되지 않습니다.",
        )}
      </p>
      <div
        className="radar-wrap"
        role="img"
        aria-label={`${leftName}과 ${rightName}의 역할 지수 레이더. 아래 비교 표에서 동일한 수치를 확인할 수 있습니다.`}
      >
        {radar.length >= 3 ? (
          <ResponsiveContainer width="100%" height={320} minWidth={0}>
            <RadarChart data={radar} outerRadius="65%" accessibilityLayer>
              <PolarGrid stroke="#ffffff40" />
              <PolarAngleAxis
                dataKey="axis"
                tick={{ fill: "#fff", fontSize: 12 }}
              />
              <PolarRadiusAxis
                domain={[0, 100]}
                tick={false}
                axisLine={false}
              />
              <Radar
                name={leftName}
                dataKey="a"
                stroke="#60ff24"
                fill="#60ff24"
                fillOpacity={0.22}
                isAnimationActive={false}
              />
              <Radar
                name={rightName}
                dataKey="b"
                stroke="#ffd580"
                fill="#ffd580"
                fillOpacity={0.16}
                isAnimationActive={false}
              />
              <Legend wrapperStyle={{ color: "#fff", fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  background: "var(--chart-tooltip, #00356e)",
                  border: "1px solid #ffffff50",
                  color: "#fff",
                }}
              />
            </RadarChart>
          </ResponsiveContainer>
        ) : (
          <p>
            {t(
              "표본 또는 공통 역할 지표가 부족하여 레이더 차트를 표시하지 않습니다.",
            )}
          </p>
        )}
      </div>
      <div
        className="mirrored-chart"
        role="list"
        aria-label={t("양방향 상세 스탯 막대그래프")}
      >
        {metrics
          .filter(
            ([key]) =>
              !["goalsSaved", "goalsConceded"].includes(key) ||
              a.role === "GK" ||
              b.role === "GK",
          )
          .map(([key, label]) => {
            const l = (unit === "total" ? left.totals : left.per90)[key],
              r = (unit === "total" ? right.totals : right.per90)[key];
            const max = Math.max(l ?? 0, r ?? 0, 1);
            return (
              <div
                className="mirror-row"
                key={key}
                role="listitem"
                aria-label={`${label}: ${leftName} ${l?.toFixed(2) ?? "데이터 없음"}, ${rightName} ${r?.toFixed(2) ?? "데이터 없음"}`}
              >
                <span>{typeof label === "string" ? t(label) : label}</span>
                <div className="mirror-values">
                  <strong>{l?.toFixed(2) ?? "—"}</strong>
                  <div className="mirror-left">
                    <i style={{ width: `${((l ?? 0) / max) * 100}%` }} />
                  </div>
                  <div className="mirror-right">
                    <i style={{ width: `${((r ?? 0) / max) * 100}%` }} />
                  </div>
                  <strong>{r?.toFixed(2) ?? "—"}</strong>
                </div>
              </div>
            );
          })}
      </div>
    </section>
  );
}
