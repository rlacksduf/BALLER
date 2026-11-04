import { t, locale } from "../i18n";
import CohortPercentiles from "./CohortPercentiles";
import { getCatalog, subscribeCatalog, savePlayer } from "../services/catalog";
import RoleScoreCard from "./RoleScoreCard";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { collectSeason } from "../services/seasonStats";
import type { SeasonCollection } from "../services/seasonStats";
import type { CompetitionStats } from "../services/football";
import { aggregate, metrics, scouting } from "../utils/scouting";
import { quotaUntil, subscribeQuota } from "../services/apiRequest";
import type { Aggregate } from "../utils/scouting";
export default function SeasonStats({
  playerId,
  rows,
  season,
  onCollected,
  compact = false,
}: {
  playerId: number;
  rows: CompetitionStats[];
  season: string;
  compact?: boolean;
  onCollected?: (data: Aggregate | null) => void;
}) {
  const [result, setResult] = useState<SeasonCollection | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [progress, setProgress] = useState(""),
    [unit, setUnit] = useState("per90"),
    [position, setPosition] = useState("auto"),
    [category, setCategory] = useState("all");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function load() {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setBusy(true);
    setError("");
    setResult(null);
    onCollected?.(null);
    setProgress(t("경기 목록 확인 중"));
    try {
      const data = await collectSeason(
        playerId,
        rows,
        season,
        current.signal,
        (done, total) => setProgress(`${done} / ${total}경기 확인`),
      );
      setResult(data);
      const aggregated = aggregate(data.samples);
      savePlayer(playerId, {
        aggregate: {
          season,
          competition: [...new Set(rows.map((row) => row.type))]
            .sort()
            .join("|"),
          data: aggregated,
        },
      });
      onCollected?.(aggregated);
    } catch (error) {
      if (!current.signal.aborted)
        setError(
          error instanceof Error ? error.message : t("집계에 실패했습니다."),
        );
    } finally {
      if (!current.signal.aborted) setBusy(false);
    }
  }
  const catalog = useSyncExternalStore(subscribeCatalog, getCatalog);
  const until = useSyncExternalStore(subscribeQuota, quotaUntil);
  const [now] = useState(Date.now);
  const blocked = until > now;
  const savedEntry = catalog.find((player) => player.id === playerId);
  const scope = [...new Set(rows.map((row) => row.type))].sort().join("|");
  const saved =
    !result &&
    !busy &&
    savedEntry?.aggregate?.season === season &&
    savedEntry.aggregate.competition === scope &&
    savedEntry.aggregate.data.count > 0
      ? savedEntry.aggregate.data
      : null;
  useEffect(() => {
    if (!result && !busy) onCollected?.(saved);
  }, [saved, result, busy, onCollected]);
  const data = result ? aggregate(result.samples) : saved,
    report = data ? scouting(data) : null;
  return (
    <section className="api-search">
      <span className="status-label">SEASON SCOUTING</span>
      <h2>{t("시즌 상세 스탯 · 분석")}</h2>
      <p>
        {t(
          "선택한 시즌·대회의 종료 경기를 수집해 합산합니다. 경기당 API 호출이 발생하며, 동일 요청은 서버에서 캐시합니다. 누락된 지표는 0으로 채우지 않습니다.",
        )}
      </p>
      <button
        disabled={busy || !rows.length || blocked}
        className="explore-btn collect-button"
        type="button"
        onClick={() => void load()}
      >
        {busy
          ? t("수집 중…")
          : blocked
            ? t("추가 수집 제한됨")
            : t("시즌 기록 수집·분석")}
      </button>
      {busy && (
        <>
          <p role="status">{progress}</p>
          <button
            className="reset-button"
            onClick={() => {
              controller.current?.abort();
              setBusy(false);
              setProgress("");
            }}
          >
            {t("수집 취소")}
          </button>
        </>
      )}
      {error && <p role="alert">{error}</p>}
      {blocked && !saved && !result && (
        <p>
          {t(
            "이 조건의 유효한 저장 상세 기록이 없습니다. 이전의 0경기 조회 결과는 분석에서 제외하며, 한도 회복 후 다시 수집해야 합니다.",
          )}
        </p>
      )}
      {data && report && (
        <>
          {result ? (
            <>
              <p role="status">
                팀 종료 경기 {result.fixtures}개 중 {result.checked}개 확인 ·
                출전 기록 {data.count}개 · 미출전/미제공 {result.missing}개 ·
                조회 실패 {result.failed}개
              </p>
              <p>{result.failure}</p>
              <p>
                {result.limited || result.stopped
                  ? t("부분 수집 결과입니다. 전체 시즌 합계로 해석하지 마세요.")
                  : t(
                      "API에서 조회된 경기 범위의 합계입니다. 제공업체의 시즌 누적과 범위가 다를 수 있습니다.",
                    )}
              </p>
            </>
          ) : (
            <p role="status">
              {t(
                "저장된 수집 기록 {count}경기 · 새 API 호출 없이 표시 중입니다. 최신성은 보장되지 않습니다.",
                { count: data.count },
              )}
            </p>
          )}
          <details className="collection-details" open={!compact}>
            <summary>{t("세부 지표 및 스카우팅 보고서")}</summary>
            <div className="detail-filters">
              <label>
                {t("기록 단위")}
                <select
                  aria-label={t("시즌 상세 기록 단위")}
                  value={unit}
                  onChange={(event) => setUnit(event.target.value)}
                >
                  <option value="per90">{t("90분당")}</option>
                  <option value="total">{t("총합")}</option>
                </select>
              </label>
              <label>
                {t("우선 표시 포지션")}
                <select
                  aria-label={t("우선 표시 포지션")}
                  value={position}
                  onChange={(event) => setPosition(event.target.value)}
                >
                  <option value="auto">{t("자동")}</option>
                  <option value="FW">FW</option>
                  <option value="MF">MF</option>
                  <option value="DF">DF</option>
                  <option value="GK">GK</option>
                </select>
              </label>
            </div>
            <div
              className="stat-categories"
              role="group"
              aria-label={t("상세 지표 분류")}
            >
              {[
                ["all", t("전체 기록")],
                ["attack", t("공격")],
                ["passing", t("패스 · 창출")],
                ["defense", t("수비 · 경합")],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={category === value}
                  onClick={() => setCategory(value!)}
                >
                  {typeof label === "string" ? t(label) : label}
                </button>
              ))}
            </div>
            <div className="api-table-wrap">
              <table>
                <caption>
                  {season} ·{" "}
                  {t("수집 경기 기준 · 제공 경기 수는 지표별 데이터 범위")}
                </caption>
                <thead>
                  <tr>
                    <th>{t("지표")}</th>
                    <th>{unit === "total" ? t("합계") : t("90분당")}</th>
                    <th>{t("제공 경기")}</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics
                    .filter(
                      ([key]) =>
                        category === "all" ||
                        (category === "attack"
                          ? [
                              "goalsScored",
                              "shotsTotal",
                              "shotsOnTarget",
                              "dribblesTotal",
                              "dribblesSuccessful",
                              "expectedGoals",
                            ]
                          : category === "passing"
                            ? [
                                "assists",
                                "passesKey",
                                "passesTotal",
                                "passesSuccessful",
                                "expectedAssists",
                              ]
                            : [
                                "duelsTotal",
                                "duelsWon",
                                "tacklesTotal",
                                "interceptionsTotal",
                                "goalsSaved",
                                "goalsConceded",
                              ]
                        ).includes(key),
                    )
                    .filter(
                      ([key]) =>
                        !["goalsSaved", "goalsConceded"].includes(key) ||
                        data.position === "Goalkeeper",
                    )
                    .sort(([a], [b]) => {
                      const role =
                        position === "auto" ? data.position : position;
                      const preferred = /GK|Goalkeeper/.test(role)
                        ? ["goalsSaved", "goalsConceded"]
                        : /DF|Defender/.test(role)
                          ? ["tacklesTotal", "interceptionsTotal", "duelsWon"]
                          : /MF|Midfielder/.test(role)
                            ? ["passesKey", "passesSuccessful", "assists"]
                            : ["goalsScored", "shotsOnTarget", "expectedGoals"];
                      return (
                        Number(preferred.includes(b)) -
                        Number(preferred.includes(a))
                      );
                    })
                    .map(([key, label]) => (
                      <tr key={key}>
                        <th scope="row">
                          {typeof label === "string" ? t(label) : label}
                        </th>
                        <td>
                          {(unit === "total" ? data.totals : data.per90)[
                            key
                          ]?.toLocaleString(locale(), {
                            maximumFractionDigits: 2,
                          }) ?? "—"}
                        </td>
                        <td>
                          {data.coverage[key]} / {data.count}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <p>
              {t("패스 성공률")} {data.rates.passing?.toFixed(1) ?? "—"}% ·{" "}
              {t("드리블 성공률")} {data.rates.dribbling?.toFixed(1) ?? "—"}% ·{" "}
              {t("경합 승률")} {data.rates.duels?.toFixed(1) ?? "—"}%
            </p>
            <RoleScoreCard data={data} />
            <CohortPercentiles
              data={data}
              season={season}
              competition={[...new Set(rows.map((row) => row.type))]
                .sort()
                .join("|")}
            />
            <div className="report scouting-report">
              <h3>{t("강점")}</h3>
              {report.strengths.length ? (
                report.strengths.map((text) => <p key={text}>{t(text)}</p>)
              ) : (
                <p>{t("현재 표본에서 강점 기준을 충족한 지표가 없습니다.")}</p>
              )}
              <h3>{t("약점 · 평가 제한")}</h3>
              {report.limitations.length ? (
                report.limitations.map((text) => <p key={text}>{t(text)}</p>)
              ) : (
                <p>{t("설정한 규칙에서 뚜렷한 약점이 관찰되지 않았습니다.")}</p>
              )}
              <h3>FINAL VERDICT</h3>
              <p>{t(report.verdict)}</p>
            </div>
          </details>
        </>
      )}
    </section>
  );
}
