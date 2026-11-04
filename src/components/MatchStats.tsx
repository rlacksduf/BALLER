import { t } from "../i18n";
import { useEffect, useRef, useState } from "react";
import { getMatches, getMatchPlayer } from "../services/matchStats";
import type { Match, MatchPlayer } from "../services/matchStats";
import type { CompetitionStats } from "../services/football";
const groups = [
  {
    title: t("공격"),
    fields: [
      ["goalsScored", t("득점")],
      ["assists", t("도움")],
      ["shotsTotal", t("슈팅")],
      ["shotsOnTarget", t("유효슈팅")],
      ["shotsOffTarget", t("빗나간 슈팅")],
      ["shotsAccuracy", t("슈팅 정확도")],
      ["expectedGoals", t("xG · 기대 득점")],
      ["expectedAssists", t("xA · 기대 도움")],
      ["expectedGoalsOnTarget", "xGOT"],
    ],
  },
  {
    title: t("패스"),
    fields: [
      ["passesTotal", t("전체 패스")],
      ["passesSuccessful", t("성공 패스")],
      ["passesFailed", t("실패 패스")],
      ["passesAccuracy", t("패스 성공률")],
      ["passesKey", t("키패스")],
    ],
  },
  {
    title: t("드리블 · 경합"),
    fields: [
      ["dribblesTotal", t("드리블 시도")],
      ["dribblesSuccessful", t("드리블 성공")],
      ["dribbleSuccessRate", t("드리블 성공률")],
      ["duelsTotal", t("전체 경합")],
      ["duelsWon", t("경합 승리")],
      ["duelsLost", t("경합 패배")],
      ["duelSuccessRate", t("경합 승률")],
    ],
  },
  {
    title: t("수비 · 반칙"),
    fields: [
      ["tacklesTotal", t("태클")],
      ["interceptionsTotal", t("가로채기")],
      ["fouledOthers", t("범한 반칙")],
      ["fouledByOthers", t("당한 반칙")],
      ["cardsYellow", t("경고")],
      ["cardsRed", t("퇴장")],
    ],
  },
  {
    title: t("골키퍼"),
    fields: [
      ["goalsSaved", t("선방")],
      ["goalsConceded", t("실점")],
      ["expectedGoalsOnTargetConceded", t("기대 유효슈팅 실점")],
      ["expectedGoalsPrevented", t("기대 실점 방어")],
    ],
  },
];
export default function MatchStats({
  playerId,
  rows,
  season,
}: {
  playerId: number;
  rows: CompetitionStats[];
  season: string;
}) {
  const [entry, setEntry] = useState("0");
  const [matches, setMatches] = useState<Match[]>([]);
  const [limited, setLimited] = useState(false);
  const [selected, setSelected] = useState("");
  const [player, setPlayer] = useState<MatchPlayer | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const options = [
    ...new Map(rows.map((row) => [row.club + "|" + row.league, row])).values(),
  ];
  function clear() {
    controller.current?.abort();
    setBusy(false);
    setError("");
    setMatches([]);
    setPlayer(null);
    setSelected("");
    setLoaded(false);
    setChecked(false);
  }
  async function load(matchId?: string) {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setBusy(true);
    setError("");
    setPlayer(null);
    setChecked(false);
    try {
      if (matchId) {
        setSelected(matchId);
        setPlayer(
          await getMatchPlayer(Number(matchId), playerId, current.signal),
        );
        setChecked(true);
      } else {
        const option = options[Number(entry)];
        if (!option) return;
        const result = await getMatches(
          option.club,
          option.league,
          season,
          current.signal,
        );
        setMatches(result.matches);
        setLimited(result.limited);
        setLoaded(true);
        setSelected("");
      }
    } catch (error) {
      if (!current.signal.aborted)
        setError(
          error instanceof Error
            ? error.message
            : t("상세 기록을 가져오지 못했습니다."),
        );
    } finally {
      if (!current.signal.aborted) setBusy(false);
    }
  }
  const match = matches.find((match) => String(match.id) === selected);
  return (
    <section
      className="api-search match-details"
      aria-labelledby="match-stats-title"
    >
      <span className="status-label">MATCH PERFORMANCE</span>
      <h2 id="match-stats-title">{t("경기별 상세 스탯")}</h2>
      <p>
        {t(
          "선택한 시즌의 종료된 팀 경기에서 선수를 조회합니다. 아래 수치는 선택한 한 경기의 기록이며 시즌 누적이 아닙니다.",
        )}
      </p>
      {options.length > 0 ? (
        <div className="api-search-form">
          <label>
            {t("팀 · 대회")}
            <select
              aria-label={t("상세 기록 팀·대회")}
              value={entry}
              onChange={(event) => {
                clear();
                setEntry(event.target.value);
              }}
            >
              {options.map((row, index) => (
                <option value={index} key={row.club + row.league}>
                  {row.club} · {row.league}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="explore-btn"
            disabled={busy}
            onClick={() => void load()}
          >
            {t("경기 목록 불러오기")}
          </button>
        </div>
      ) : (
        <p>{t("선택한 조건에 해당하는 팀·대회 정보가 없습니다.")}</p>
      )}
      {busy && <p role="status">{t("경기 기록을 가져오는 중…")}</p>}
      {error && (
        <p role="alert" className="api-error">
          {error} 다시 불러오거나 다른 경기를 선택해 주세요.
        </p>
      )}
      {loaded && !matches.length && <p>{t("제공된 종료 경기가 없습니다.")}</p>}
      {limited && (
        <p>{t("API 목록 제한으로 일부 경기가 표시되지 않을 수 있습니다.")}</p>
      )}
      {matches.length > 0 && (
        <label className="match-select">
          {t("경기 선택")}
          <select
            aria-label={t("상세 기록 경기")}
            value={selected}
            disabled={busy}
            onChange={(event) => {
              if (event.target.value) void load(event.target.value);
            }}
          >
            <option value="">{t("경기를 선택하세요")}</option>
            {matches.map((match) => (
              <option key={match.id} value={match.id}>
                {new Date(match.date).toLocaleDateString("ko-KR", {
                  timeZone: "Asia/Seoul",
                })}{" "}
                · {match.home} {match.score} {match.away}
              </option>
            ))}
          </select>
        </label>
      )}
      {checked && !player && !error && (
        <p>
          {t(
            "이 경기에서 해당 선수의 기록을 찾지 못했습니다. 미출전 또는 데이터 미제공일 수 있습니다.",
          )}
        </p>
      )}
      {player && match && (
        <>
          <h3>
            {match.home} {match.score} {match.away}
          </h3>
          <p>
            {player.name} · {player.position} · {player.minutes ?? "—"}분 · 평점{" "}
            {player.rating}
          </p>
          <p>{t("—는 미제공 기록입니다. 0은 API가 반환한 실제 값입니다.")}</p>
          <div className="match-stat-groups">
            {groups
              .filter(
                (group) =>
                  group.title !== t("골키퍼") ||
                  player.position === "Goalkeeper",
              )
              .map((group) => (
                <section key={group.title}>
                  <h4>{group.title}</h4>
                  <dl>
                    {group.fields.map(([key, label]) => (
                      <div key={key}>
                        <dt>{typeof label === "string" ? t(label) : label}</dt>
                        <dd>{player.stats[key!] ?? "—"}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              ))}
          </div>
        </>
      )}
    </section>
  );
}
