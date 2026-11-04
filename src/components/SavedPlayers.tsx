import { t, locale } from "../i18n";
import { useState, useSyncExternalStore } from "react";
import { Link } from "react-router-dom";
import { getCatalog, subscribeCatalog } from "../services/catalog";
import { getRole } from "../utils/roleScores";
import { newestSeasonFirst } from "../utils/seasons";
import { AddToCompare } from "./CompareSelection";
export default function SavedPlayers({ home = false }: { home?: boolean }) {
  const players = useSyncExternalStore(subscribeCatalog, getCatalog);
  const seasons = [
    ...new Set(players.flatMap((p) => p.stats.map((row) => row.season))),
  ].sort(newestSeasonFirst);
  const [chosenSeason, setSeason] = useState(""),
    [league, setLeague] = useState(""),
    [team, setTeam] = useState(""),
    [role, setRole] = useState(""),
    [sort, setSort] = useState("goals"),
    [query, setQuery] = useState(""),
    [page, setPage] = useState(1);
  const season = seasons.includes(chosenSeason)
    ? chosenSeason
    : (seasons[0] ?? "");
  const entries = players.map((player) => {
    const rows = player.stats.filter(
      (row) =>
        row.season === season &&
        row.type === "national league" &&
        (!league || row.league === league) &&
        (!team || row.club === team),
    );
    const sum = (key: "goals" | "assists" | "minutesPlayed") =>
      rows.length && rows.every((row) => row[key] !== null)
        ? rows.reduce((sum, row) => sum + row[key]!, 0)
        : null;
    return {
      player,
      rows,
      goals: sum("goals"),
      assists: sum("assists"),
      minutes: sum("minutesPlayed"),
      role: getRole(
        player.profile?.position ?? player.aggregate?.data.position ?? "",
      ),
    };
  });
  const leagues = [
    ...new Set(
      players.flatMap((p) =>
        p.stats
          .filter(
            (row) => row.season === season && row.type === "national league",
          )
          .map((row) => row.league),
      ),
    ),
  ];
  const teams = [
    ...new Set(
      players.flatMap((p) =>
        p.stats
          .filter(
            (row) =>
              row.season === season &&
              row.type === "national league" &&
              (!league || row.league === league),
          )
          .map((row) => row.club),
      ),
    ),
  ];
  const filtered = entries
    .filter(
      (entry) =>
        entry.rows.length &&
        (!role || entry.role === role) &&
        entry.player.name
          .toLocaleLowerCase()
          .includes(query.trim().toLocaleLowerCase()),
    )
    .sort((a, b) =>
      sort === "name"
        ? a.player.name.localeCompare(b.player.name)
        : (b[
            sort === "assists"
              ? "assists"
              : sort === "minutes"
                ? "minutes"
                : "goals"
          ] ?? -1) -
            (a[
              sort === "assists"
                ? "assists"
                : sort === "minutes"
                  ? "minutes"
                  : "goals"
            ] ?? -1) || a.player.name.localeCompare(b.player.name),
    );
  function reset() {
    setLeague("");
    setTeam("");
    setRole("");
    setSort("goals");
    setQuery("");
    setPage(1);
  }
  if (!players.length)
    return (
      <section className="api-search">
        <h2>{home ? t("나의 선수 대시보드") : t("저장된 실제 선수")}</h2>
        <p>
          {t(
            "검색 후 선수 상세 페이지를 열면 실제 선수와 시즌 기록이 여기에 모입니다. 선수 전체 리그 랭킹을 제공하는 목록은 아닙니다.",
          )}
        </p>
        <Link className="text-link" to="/players?q=Haaland">
          {t("첫 선수 찾아보기 →")}
        </Link>
      </section>
    );
  const currentPage = Math.min(
    page,
    Math.max(1, Math.ceil(filtered.length / 6)),
  );
  const renderRank = (field: "goals" | "assists", title: string) => (
    <section>
      <h3>{title} TOP 5</h3>
      <ol className="ranking-list">
        {entries
          .filter((e) => e.rows.length && e[field] !== null)
          .sort((a, b) => b[field]! - a[field]!)
          .slice(0, 5)
          .map((e) => (
            <li key={e.player.id}>
              <Link to={`/players/${e.player.id}`}>{e.player.name}</Link>
              <strong>{e[field]}</strong>
            </li>
          ))}
      </ol>
    </section>
  );
  return (
    <section
      className={`api-search scouting-library ${home ? "library-home" : "library-explorer"}`}
    >
      <span className="status-label">{t("나의 선수 라이브러리")}</span>
      <h2>{home ? t("시즌 대시보드") : t("저장된 실제 선수 탐색")}</h2>
      <p>
        {t(
          "저장된 실제 선수 {count}명 · 리그 전체 순위가 아닌 나의 스카우팅 라이브러리입니다.",
          { count: players.length },
        )}
      </p>
      <div className="library-layout">
        <div className="player-filters library-filters">
          <label>
            {t("시즌")}
            <select
              aria-label={t("라이브러리 시즌")}
              value={season}
              onChange={(e) => {
                setSeason(e.target.value);
                reset();
              }}
            >
              {seasons.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          {!home && (
            <>
              <label>
                {t("이름")}
                <input
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(1);
                  }}
                  placeholder={t("저장한 선수 이름")}
                />
              </label>
              <label>
                {t("리그")}
                <select
                  aria-label={t("라이브러리 리그")}
                  value={league}
                  onChange={(e) => {
                    setLeague(e.target.value);
                    setTeam("");
                    setPage(1);
                  }}
                >
                  <option value="">{t("전체")}</option>
                  {leagues.map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </select>
              </label>
              <label>
                {t("팀")}
                <select
                  aria-label={t("라이브러리 팀")}
                  value={team}
                  onChange={(e) => {
                    setTeam(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">{t("전체")}</option>
                  {teams.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>
              <label>
                {t("포지션")}
                <select
                  aria-label={t("라이브러리 포지션")}
                  value={role}
                  onChange={(e) => {
                    setRole(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">{t("전체")}</option>
                  {["FW", "MF", "DF", "GK"].map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </label>
              <label>
                {t("정렬")}
                <select
                  aria-label={t("라이브러리 정렬")}
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                >
                  <option value="goals">{t("득점")}</option>
                  <option value="assists">{t("도움")}</option>
                  <option value="minutes">{t("출전시간")}</option>
                  <option value="name">{t("이름")}</option>
                </select>
              </label>
            </>
          )}
        </div>
        <div className="library-results">
          {home ? (
            <>
              <div className="detail-summary">
                {[
                  [t("확인한 선수"), players.length],
                  [
                    t("국내 리그 기록 보유"),
                    entries.filter((e) => e.rows.length).length,
                  ],
                  [t("시즌"), season],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt>{typeof label === "string" ? t(label) : label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </div>
              <div className="role-pair rankings">
                {renderRank("goals", t("득점"))}
                {renderRank("assists", t("도움"))}
              </div>
            </>
          ) : (
            <>
              <div className="results-toolbar">
                <p role="status">
                  {t("검색 결과 {count}명", { count: filtered.length })}
                </p>
                <button className="reset-button" type="button" onClick={reset}>
                  {t("필터 초기화 ↺")}
                </button>
              </div>
              {!filtered.length && (
                <p>
                  {t(
                    "조건에 맞는 저장 선수가 없습니다. 필터를 바꾸거나 실제 선수를 더 찾아보세요.",
                  )}
                </p>
              )}
              <div className="player-grid">
                {filtered
                  .slice((currentPage - 1) * 6, currentPage * 6)
                  .map((e) => (
                    <article className="player-card" key={e.player.id}>
                      <Link
                        className="saved-profile-link"
                        to={`/players/${e.player.id}`}
                      >
                        {e.player.logo && (
                          <img
                            className="player-photo"
                            src={e.player.logo}
                            alt=""
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            onError={(event) => {
                              event.currentTarget.hidden = true;
                            }}
                          />
                        )}
                        <span className="status-label">
                          {e.role ?? t("포지션 미확인")} · {season}
                        </span>
                        <h3>{e.player.name}</h3>
                        <p>
                          {[...new Set(e.rows.map((row) => row.club))].join(
                            " · ",
                          )}
                        </p>
                        <dl className="player-stats">
                          <div>
                            <dt>{t("득점")}</dt>
                            <dd>{e.goals ?? "—"}</dd>
                          </div>
                          <div>
                            <dt>{t("도움")}</dt>
                            <dd>{e.assists ?? "—"}</dd>
                          </div>
                          <div>
                            <dt>{t("출전시간")}</dt>
                            <dd>
                              {e.minutes?.toLocaleString(locale()) ?? "—"}
                            </dd>
                          </div>
                        </dl>
                        <span className="profile-card-action">
                          {t("선수 프로필 ↗")}
                        </span>
                      </Link>
                      <AddToCompare player={e.player} />
                      <p className="updated-at">
                        {t("확인")}{" "}
                        {new Date(e.player.updatedAt).toLocaleString(locale(), {
                          timeZone: "Asia/Seoul",
                        })}
                      </p>
                    </article>
                  ))}
              </div>
              {filtered.length > 6 && (
                <div className="pagination">
                  <button
                    type="button"
                    className="reset-button"
                    disabled={currentPage === 1}
                    onClick={() => setPage(currentPage - 1)}
                  >
                    {t("← 이전")}
                  </button>
                  <span>
                    {currentPage} / {Math.ceil(filtered.length / 6)}
                  </span>
                  <button
                    type="button"
                    className="reset-button"
                    disabled={currentPage * 6 >= filtered.length}
                    onClick={() => setPage(currentPage + 1)}
                  >
                    {t("다음 →")}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
