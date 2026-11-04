import { t, locale } from "../i18n";
import { lazy, Suspense, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AddToCompare } from "../components/CompareSelection";
import LoadingState from "../components/LoadingState";
import PlayerProfile from "../components/PlayerProfile";
import SeasonStats from "../components/SeasonStats";
import MatchStats from "../components/MatchStats";
import PageIntro from "../components/PageIntro";
import { getApiPlayerDetails } from "../services/football";
import type { CompetitionStats } from "../services/football";
import "./PlayersPage.css";
import { newestSeasonFirst } from "../utils/seasons";

const SeasonTrend = lazy(() => import("../components/SeasonTrend"));
type Details = { name: string; stats: CompetitionStats[] };
const display = (value: number | null) =>
  value === null ? "—" : value.toLocaleString(locale());

export default function PlayerDetailPage() {
  const { id = "" } = useParams();
  const [data, setData] = useState<Details | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const [retry, setRetry] = useState(0);
  const [season, setSeason] = useState("");
  const [competition, setCompetition] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    // API 요청을 시작할 때 이전 선수의 응답과 로딩 상태를 초기화합니다.
    // eslint-disable-next-line react/set-state-in-effect
    setData(null);
    setError("");
    setBusy(true);
    setCompetition("");
    setSeason("");
    if (!/^\d{1,12}$/.test(id)) {
      setError(t("올바르지 않은 선수 주소입니다."));
      setBusy(false);
      return;
    }
    getApiPlayerDetails(Number(id), controller.signal)
      .then((data) => {
        setData(data);
        const latest =
          [...new Set(data.stats.map((row) => row.season))].sort(
            newestSeasonFirst,
          )[0] ?? "";
        setSeason(latest);
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setError(
            error instanceof Error
              ? error.message
              : t("선수 정보를 가져오지 못했습니다."),
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, [id, retry]);
  const seasons = [...new Set(data?.stats.map((row) => row.season) ?? [])].sort(
    newestSeasonFirst,
  );
  const rows =
    data?.stats.filter(
      (row) =>
        row.season === season && (!competition || row.type === competition),
    ) ?? [];
  const total = (
    field: "goals" | "assists" | "gamesPlayed" | "minutesPlayed",
  ) =>
    !rows.length || rows.some((row) => row[field] === null)
      ? null
      : rows.reduce((sum, row) => sum + row[field]!, 0);
  const goals = total("goals"),
    minutes = total("minutesPlayed");
  return (
    <PageIntro
      label="PLAYER PROFILE"
      title={data?.name ?? t("선수 상세")}
      description={t("시즌별 기록으로 선수의 활약을 확인하세요.")}
    >
      <div className="players-content">
        <Link className="text-link detail-back" to="/players">
          {t("← 선수 검색으로")}
        </Link>
        {busy && (
          <LoadingState label={t("선수의 시즌 기록을 가져오고 있습니다.")} />
        )}
        {error && (
          <section className="info-panel">
            <h2>{t("선수 정보를 불러오지 못했어요.")}</h2>
            <p role="alert">{error}</p>
            <button
              className="reset-button"
              onClick={() => setRetry((value) => value + 1)}
            >
              {t("다시 시도 ↺")}
            </button>
          </section>
        )}
        {data && !busy && (
          <>
            <AddToCompare player={{ id: Number(id), name: data.name }} />
            <PlayerProfile key={id} id={Number(id)} />
            <div className="detail-filters">
              <label>
                {t("시즌")}
                <select
                  aria-label={t("시즌")}
                  value={season}
                  onChange={(event) => setSeason(event.target.value)}
                >
                  {seasons.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
              <label>
                {t("대회 유형")}
                <select
                  aria-label={t("대회 유형")}
                  value={competition}
                  onChange={(event) => setCompetition(event.target.value)}
                >
                  <option value="">{t("전체 대회")}</option>
                  <option value="national league">{t("국내 리그")}</option>
                  <option value="national cup">{t("국내 컵")}</option>
                  <option value="international cup">{t("국제 컵")}</option>
                </select>
              </label>
            </div>
            <dl className="detail-summary">
              {[
                [t("득점"), display(goals)],
                [t("도움"), display(total("assists"))],
                [t("출전 경기"), display(total("gamesPlayed"))],
                [t("출전 시간(분)"), display(minutes)],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{typeof label === "string" ? t(label) : label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <p className="detail-note">
              {t("선택한 시즌·대회의 기록 합계 · 90분당 득점")}{" "}
              {goals !== null && minutes !== null && minutes > 0
                ? ((goals / minutes) * 90).toFixed(2)
                : "—"}{" "}
              {t("· 누락된 수치는 — 표시")}
            </p>
            <section className="api-search">
              <h2>{t("시즌별 득점·도움 추이")}</h2>
              <Suspense
                fallback={<p role="status">{t("추이 차트 준비 중…")}</p>}
              >
                <SeasonTrend stats={data.stats} competition={competition} />
              </Suspense>
              <p>
                {t("선택한 대회 유형 기준 · 각 막대의 수치는 시즌 합계입니다.")}
              </p>
              <div className="season-chart">
                {seasons.map((value) => {
                  const selected = data.stats.filter(
                    (row) =>
                      row.season === value &&
                      (!competition || row.type === competition),
                  );
                  const count =
                    !selected.length ||
                    selected.some((row) => row.goals === null)
                      ? null
                      : selected.reduce((sum, row) => sum + row.goals!, 0);
                  const max = Math.max(
                    1,
                    ...seasons.map((s) =>
                      data.stats
                        .filter(
                          (row) =>
                            row.season === s &&
                            (!competition || row.type === competition),
                        )
                        .reduce((sum, row) => sum + (row.goals ?? 0), 0),
                    ),
                  );
                  return (
                    <div className="season-bar" key={value}>
                      <span>{value}</span>
                      <div className="bar-track">
                        <div
                          style={{
                            width: `${count === null ? 0 : (count / max) * 100}%`,
                          }}
                        />
                      </div>
                      <strong>{display(count)}</strong>
                    </div>
                  );
                })}
              </div>
            </section>
            <section className="api-search">
              <h2>{t("대회별 시즌 기록")}</h2>
              {rows.length ? (
                <div className="api-table-wrap">
                  <table>
                    <caption>
                      {season} · {t("대회별 시즌 기록")}
                    </caption>
                    <thead>
                      <tr>
                        {[
                          t("팀"),
                          t("대회"),
                          t("득점"),
                          t("도움"),
                          t("출전"),
                          t("시간(분)"),
                        ].map((label) => (
                          <th scope="col" key={label}>
                            {typeof label === "string" ? t(label) : label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, index) => (
                        <tr key={index}>
                          <td>{row.club}</td>
                          <td>{row.league}</td>
                          <td>{display(row.goals)}</td>
                          <td>{display(row.assists)}</td>
                          <td>{display(row.gamesPlayed)}</td>
                          <td>{display(row.minutesPlayed)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p>{t("선택한 조건에 해당하는 기록이 없습니다.")}</p>
              )}
            </section>
            <SeasonStats
              key={`season-${id}-${season}-${competition}`}
              playerId={Number(id)}
              rows={rows}
              season={season}
            />
            <Link
              className="explore-btn collect-button"
              to={`/compare?a=${id}`}
            >
              {t("이 선수 비교하기 →")}
            </Link>
            <MatchStats
              key={`${id}-${season}-${competition}`}
              playerId={Number(id)}
              rows={rows}
              season={season}
            />
          </>
        )}
        <a
          className="text-link"
          href="https://highlightly.net/football-api/"
          target="_blank"
          rel="noreferrer"
        >
          {t("데이터 출처: Highlightly ↗")}
        </a>
      </div>
    </PageIntro>
  );
}
