import { t } from "../i18n";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import type { CompetitionStats } from "../services/football";
import { newestSeasonFirst } from "../utils/seasons";
export default function SeasonTrend({
  stats,
  competition,
}: {
  stats: CompetitionStats[];
  competition: string;
}) {
  const seasons = [...new Set(stats.map((row) => row.season))]
    .sort(newestSeasonFirst)
    .reverse();
  const data = seasons.map((season) => {
    const rows = stats.filter(
      (row) =>
        row.season === season && (!competition || row.type === competition),
    );
    const sum = (key: "goals" | "assists") =>
      rows.length && rows.every((row) => row[key] !== null)
        ? rows.reduce((total, row) => total + row[key]!, 0)
        : null;
    return { season, goals: sum("goals"), assists: sum("assists") };
  });
  return (
    <div
      className="trend-chart"
      role="img"
      aria-label={t(
        "시즌별 득점과 도움 추이. 상세 값은 아래 시즌 기록에서 확인할 수 있습니다.",
      )}
    >
      <ResponsiveContainer width="100%" height={280} minWidth={0}>
        <LineChart
          data={data}
          margin={{ top: 20, right: 16, left: -15, bottom: 0 }}
          accessibilityLayer
        >
          <CartesianGrid stroke="#ffffff20" />
          <XAxis
            dataKey="season"
            tick={{ fill: "#fff", fontSize: 11 }}
            minTickGap={24}
          />
          <YAxis tick={{ fill: "#fff", fontSize: 11 }} />
          <Tooltip
            contentStyle={{
              background: "#00356e",
              border: "1px solid #ffffff50",
              color: "#fff",
            }}
          />
          <Line
            name={t("득점")}
            type="monotone"
            dataKey="goals"
            stroke="#60ff24"
            strokeWidth={2}
            connectNulls={false}
            isAnimationActive={false}
          />
          <Line
            name={t("도움")}
            type="monotone"
            dataKey="assists"
            stroke="#ffd580"
            strokeWidth={2}
            connectNulls={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
      <p>
        {t("초록: 득점 · 노랑: 도움 · 미제공 시즌은 선을 연결하지 않습니다.")}
      </p>
    </div>
  );
}
