import { t, locale, localized } from "../i18n";
import { lazy, Suspense, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import PageIntro from "../components/PageIntro";
import LoadingState from "../components/LoadingState";
import { setSelection } from "../services/selection";
import RoleComparison from "../components/RoleComparison";
import SeasonStats from "../components/SeasonStats";
import { getApiPlayerDetails, searchApiPlayers } from "../services/football";
import type { ApiPlayer, CompetitionStats } from "../services/football";
import type { Aggregate } from "../utils/scouting";
import { metrics } from "../utils/scouting";
import { newestSeasonFirst } from "../utils/seasons";
import "./PlayersPage.css";
const ComparisonCharts = lazy(() => import("../components/ComparisonCharts"));
type Detail = { name: string; stats: CompetitionStats[] };
function Picker({
  label,
  onSelect,
}: {
  label: string;
  onSelect: (player: ApiPlayer) => void;
}) {
  const [query, setQuery] = useState(""),
    [results, setResults] = useState<ApiPlayer[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <form
      className="battle-picker"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError("");
        try {
          setResults(await searchApiPlayers(query));
        } catch (error) {
          setError(error instanceof Error ? error.message : t("검색 실패"));
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        {label}
        <input
          required
          minLength={2}
          maxLength={80}
          placeholder={t("영문 이름 검색")}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <button className="reset-button" disabled={busy}>
        {busy ? t("검색 중…") : t("검색 →")}
      </button>
      {error && <p role="alert">{error}</p>}
      <div className="api-player-list">
        {results.map((player) => (
          <button
            type="button"
            key={player.id}
            onClick={() => {
              onSelect(player);
              setResults([]);
              setQuery(player.name);
            }}
          >
            {player.name}
          </button>
        ))}
      </div>
    </form>
  );
}
export default function ComparePage() {
  const [params, setParams] = useSearchParams();
  const a = params.get("a") ?? "",
    b = params.get("b") ?? "";
  const [left, setLeft] = useState<Detail | null>(null),
    [right, setRight] = useState<Detail | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [retry, setRetry] = useState(0);
  const [season, setSeason] = useState(""),
    [competition, setCompetition] = useState("national league"),
    [mode, setMode] = useState("basic"),
    [unit, setUnit] = useState("per90");
  const [leftDetail, setLeftDetail] = useState<Aggregate | null>(null),
    [rightDetail, setRightDetail] = useState<Aggregate | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    // 선택한 선수에 맞춰 외부 API 데이터를 다시 동기화합니다.
    // eslint-disable-next-line react/set-state-in-effect
    setLeft(null);
    setRight(null);
    setError("");
    setLeftDetail(null);
    setRightDetail(null);
    setSeason("");
    setBusy(true);
    const ids = [a, b];
    if (ids.some((id) => id && !/^\d{1,12}$/.test(id))) {
      setError(t("선수 주소가 올바르지 않습니다."));
      setBusy(false);
      return;
    }
    Promise.all(
      ids.map((id) =>
        id
          ? getApiPlayerDetails(Number(id), controller.signal)
          : Promise.resolve(null),
      ),
    )
      .then(([l, r]) => {
        setLeft(l ?? null);
        setRight(r ?? null);
        setSelection([
          ...(l ? [{ id: Number(a), name: l.name }] : []),
          ...(r ? [{ id: Number(b), name: r.name }] : []),
        ]);
        const seasons = [
          ...new Set(
            l?.stats.map((row) => row.season) ??
              r?.stats.map((row) => row.season) ??
              [],
          ),
        ]
          .filter((s) => !l || !r || r.stats.some((row) => row.season === s))
          .sort(newestSeasonFirst);
        setSeason(seasons[0] ?? "");
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setError(
            error instanceof Error ? error.message : t("선수 조회 실패"),
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, [a, b, retry]);
  const seasons = [
    ...new Set(
      left?.stats.map((row) => row.season) ??
        right?.stats.map((row) => row.season) ??
        [],
    ),
  ]
    .filter(
      (s) => !left || !right || right.stats.some((row) => row.season === s),
    )
    .sort(newestSeasonFirst);
  const rows = (player: Detail | null) =>
    player?.stats.filter(
      (row) =>
        row.season === season && (!competition || row.type === competition),
    ) ?? [];
  const sum = (
    player: Detail | null,
    key: "goals" | "assists" | "minutesPlayed" | "gamesPlayed",
  ) => {
    const items = rows(player);
    return items.length && items.every((row) => row[key] !== null)
      ? items.reduce((sum, row) => sum + row[key]!, 0)
      : null;
  };
  const p90 = (player: Detail | null, key: "goals" | "assists") => {
    const value = sum(player, key),
      minutes = sum(player, "minutesPlayed");
    return value !== null && minutes !== null && minutes > 0
      ? (value / minutes) * 90
      : null;
  };
  function select(slot: string, player: ApiPlayer) {
    const next = new URLSearchParams(params);
    next.set(slot, String(player.id));
    setParams(next);
  }
  const basic = [
    [t("득점"), sum(left, "goals"), sum(right, "goals")],
    [t("도움"), sum(left, "assists"), sum(right, "assists")],
    [t("출전 경기"), sum(left, "gamesPlayed"), sum(right, "gamesPlayed")],
    [t("출전 시간"), sum(left, "minutesPlayed"), sum(right, "minutesPlayed")],
    [t("90분당 득점"), p90(left, "goals"), p90(right, "goals")],
    [t("90분당 도움"), p90(left, "assists"), p90(right, "assists")],
  ] as const;
  const largest =
    leftDetail && rightDetail
      ? metrics
          .filter(
            ([key]) =>
              leftDetail.per90[key] != null && rightDetail.per90[key] != null,
          )
          .map(([key, label]) => ({
            label,
            diff: leftDetail.per90[key]! - rightDetail.per90[key]!,
          }))
          .sort((x, y) => Math.abs(y.diff) - Math.abs(x.diff))[0]
      : null;
  return (
    <PageIntro
      label={t("선수 비교")}
      title={t("당신의 선택은?")}
      description={t(
        "같은 시즌, 같은 대회 기준으로 두 선수의 기록을 비교하세요.",
      )}
    >
      <div className="players-content">
        <div className="compare-toolbar">
          <button
            type="button"
            className="reset-button"
            onClick={() => {
              setSelection([]);
              setParams({});
            }}
          >
            {t("비교 초기화 ↺")}
          </button>
          <button
            type="button"
            className="reset-button"
            disabled={!a || !b}
            onClick={() => {
              setParams({ a: b, b: a });
            }}
          >
            {t("A ↔ B 교체")}
          </button>
        </div>
        <div className="battle-grid">
          <Picker label="PLAYER A" onSelect={(player) => select("a", player)} />
          <Picker label="PLAYER B" onSelect={(player) => select("b", player)} />
        </div>
        <div className="battle-grid battle-cards">
          <article className="player-card">
            <span className="status-label">PLAYER A</span>
            <h2>{left?.name ?? t("선수를 선택하세요")}</h2>
            {a && (
              <Link className="text-link" to={`/players/${a}`}>
                {t("선수 상세 →")}
              </Link>
            )}
          </article>
          <span className="versus" aria-hidden="true">
            VS
          </span>
          <article className="player-card">
            <span className="status-label">PLAYER B</span>
            <h2>{right?.name ?? t("선수를 선택하세요")}</h2>
            {b && (
              <Link className="text-link" to={`/players/${b}`}>
                {t("선수 상세 →")}
              </Link>
            )}
          </article>
        </div>
        {busy && <LoadingState label={t("선수 기록 조회 중…")} />}
        {error && (
          <p role="alert">
            {error}
            <button
              onClick={() => setRetry((value) => value + 1)}
              className="reset-button"
            >
              {t("다시 시도")}
            </button>
          </p>
        )}
        {a && a === b && (
          <p role="alert">{t("서로 다른 선수를 선택해 주세요.")}</p>
        )}
        {left && right && a !== b && (
          <>
            {!seasons.length ? (
              <p>{t("공통 시즌 기록이 없습니다.")}</p>
            ) : (
              <>
                <div className="detail-filters">
                  <label>
                    {t("비교 시즌")}
                    <select
                      aria-label={t("비교 시즌")}
                      value={season}
                      onChange={(event) => {
                        setSeason(event.target.value);
                        setLeftDetail(null);
                        setRightDetail(null);
                      }}
                    >
                      {seasons.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {t("비교 대회")}
                    <select
                      aria-label={t("비교 대회")}
                      value={competition}
                      onChange={(event) => {
                        setCompetition(event.target.value);
                        setLeftDetail(null);
                        setRightDetail(null);
                      }}
                    >
                      <option value="national league">{t("국내 리그")}</option>
                      <option value="national cup">{t("국내 컵")}</option>
                      <option value="international cup">{t("국제 컵")}</option>
                      <option value="">{t("전체 대회")}</option>
                    </select>
                  </label>
                  <label>
                    {t("비교 모드")}
                    <select
                      aria-label={t("비교 모드")}
                      value={mode}
                      onChange={(event) => setMode(event.target.value)}
                    >
                      <option value="basic">{t("일반 비교")}</option>
                      <option value="role">{t("포지션 대결")}</option>
                      <option value="overall">
                        {t("종합 비교 · 백분위/역할 점수")}
                      </option>
                    </select>
                  </label>
                </div>
                <p className="detail-note">
                  {mode === "role"
                    ? t(
                        "역할별 기여를 확인하세요. 다른 포지션에 단일 승패나 종합 점수를 매기지 않습니다.",
                      )
                    : t(
                        "서로 다른 리그는 경기 환경이 다릅니다. 수치 차이가 선수 능력 차이를 뜻하지 않습니다.",
                      )}
                </p>
                <div className="api-table-wrap">
                  <table>
                    <caption>
                      {season} ·{" "}
                      {t(
                        "시즌 기본 기록 · 강조는 큰 수치를 뜻하며 경기력 우열이 아닙니다.",
                      )}
                    </caption>
                    <thead>
                      <tr>
                        <th>{t("지표")}</th>
                        <th>{left.name}</th>
                        <th>{right.name}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {basic.map(([label, l, r]) => (
                        <tr key={label}>
                          <th scope="row">
                            {typeof label === "string" ? t(label) : label}
                          </th>
                          <td
                            className={
                              l !== null && r !== null && l > r
                                ? "numeric-higher"
                                : undefined
                            }
                          >
                            {l?.toLocaleString(locale(), {
                              maximumFractionDigits: 2,
                            }) ?? "—"}
                          </td>
                          <td
                            className={
                              l !== null && r !== null && r > l
                                ? "numeric-higher"
                                : undefined
                            }
                          >
                            {r?.toLocaleString(locale(), {
                              maximumFractionDigits: 2,
                            }) ?? "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="battle-grid season-comparison">
                  <div>
                    <h2>{left.name}</h2>
                    <SeasonStats
                      compact
                      key={`a-${a}-${season}-${competition}`}
                      playerId={Number(a)}
                      rows={rows(left)}
                      season={season}
                      onCollected={setLeftDetail}
                    />
                  </div>
                  <div>
                    <h2>{right.name}</h2>
                    <SeasonStats
                      compact
                      key={`b-${b}-${season}-${competition}`}
                      playerId={Number(b)}
                      rows={rows(right)}
                      season={season}
                      onCollected={setRightDetail}
                    />
                  </div>
                </div>
                {leftDetail && rightDetail && (
                  <>
                    <div className="detail-filters">
                      <label>
                        {t("상세 비교 기록 단위")}
                        <select
                          aria-label={t("상세 비교 기록 단위")}
                          value={unit}
                          onChange={(event) => setUnit(event.target.value)}
                        >
                          <option value="per90">{t("90분당")}</option>
                          <option value="total">{t("총합")}</option>
                        </select>
                      </label>
                    </div>
                    <Suspense
                      fallback={<p role="status">{t("차트 준비 중…")}</p>}
                    >
                      <ComparisonCharts
                        left={leftDetail}
                        right={rightDetail}
                        leftName={left.name}
                        rightName={right.name}
                        unit={unit}
                      />
                    </Suspense>
                  </>
                )}
                {leftDetail && rightDetail && (
                  <section className="api-search">
                    <h2>{t("상세 지표 나란히 비교")}</h2>
                    <p>
                      {t(
                        "각자 수집한 경기 범위의 90분당 기록입니다. 제공 범위가 다르면 직접적인 우열 판단을 제한합니다.",
                      )}
                    </p>
                    <div className="api-table-wrap">
                      <table>
                        <caption>
                          {unit === "total" ? t("총합") : t("90분당")}{" "}
                          {t("상세 기록")}
                        </caption>
                        <thead>
                          <tr>
                            <th>{t("지표")}</th>
                            <th>{left.name}</th>
                            <th>{right.name}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {metrics
                            .filter(
                              ([key]) =>
                                !["goalsSaved", "goalsConceded"].includes(
                                  key,
                                ) ||
                                leftDetail.position === "Goalkeeper" ||
                                rightDetail.position === "Goalkeeper",
                            )
                            .map(([key, label]) => (
                              <tr key={key}>
                                <th scope="row">
                                  {typeof label === "string" ? t(label) : label}
                                </th>
                                <td>
                                  {(unit === "total"
                                    ? leftDetail.totals
                                    : leftDetail.per90)[key]?.toFixed(2) ?? "—"}
                                </td>
                                <td>
                                  {(unit === "total"
                                    ? rightDetail.totals
                                    : rightDetail.per90)[key]?.toFixed(2) ??
                                    "—"}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                )}
                {leftDetail && rightDetail && (
                  <RoleComparison
                    left={leftDetail}
                    right={rightDetail}
                    leftName={left.name}
                    rightName={right.name}
                    mode={mode}
                    season={season}
                    competition={[
                      ...new Set(
                        [...rows(left), ...rows(right)].map((row) => row.type),
                      ),
                    ]
                      .sort()
                      .join("|")}
                  />
                )}
                {leftDetail && rightDetail && (
                  <section className="api-search final-verdict">
                    <span className="verdict-kicker">THE FINAL WORD</span>
                    <h2>{t("FINAL VERDICT · 역할 비교")}</h2>
                    <p>
                      {leftDetail.position} VS {rightDetail.position} ·{" "}
                      {t("수집 범위")} {leftDetail.count} / {rightDetail.count}{" "}
                      {t("경기")}
                    </p>
                    <p>
                      {largest
                        ? localized(
                            `비교 가능한 지표 중 90분당 수치 차이가 가장 큰 항목은 ${largest.label}입니다. ${largest.diff >= 0 ? left.name : right.name}의 수치가 ${Math.abs(largest.diff).toFixed(2)} 높습니다. 단위가 다른 지표를 종합 점수로 합산하지 않습니다.`,
                            `The largest per 90 difference among comparable metrics is ${t(largest.label)}. ${largest.diff >= 0 ? left.name : right.name} is ${Math.abs(largest.diff).toFixed(2)} higher. Metrics with different units are not combined into one score.`,
                          )
                        : t("비교 가능한 상세 지표가 부족합니다.")}
                    </p>
                    <p>
                      {leftDetail.minutes === null ||
                      rightDetail.minutes === null ||
                      leftDetail.minutes < 270 ||
                      rightDetail.minutes < 270
                        ? t(
                            "출전시간이 적거나 누락되어 전술 적합성 결론을 제한합니다.",
                          )
                        : t(
                            "각 선수의 강점과 약점은 위 스카우팅 보고서에서 확인하세요. 서로 다른 수집 범위와 리그 환경 때문에 우열을 단정할 수 없습니다.",
                          )}
                    </p>
                  </section>
                )}
              </>
            )}
          </>
        )}
      </div>
    </PageIntro>
  );
}
