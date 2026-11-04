import {t} from '../i18n';
import { useState } from "react";
import PageIntro from "../components/PageIntro";
import ApiPlayerSearch from "../components/ApiPlayerSearch";
import DatabaseSync from "../components/DatabaseSync";
import SavedPlayers from "../components/SavedPlayers";
import PlayerCard from "../components/PlayerCard";
import { players, seasons } from "../data/players";
import { filterPlayers } from "../utils/filterPlayers";
import type { PlayerFilters, PlayerSort } from "../types/player";
import "./PlayersPage.css";

const initialFilters: PlayerFilters = { query: "", league: "", team: "", position: "", season: seasons[0]!, sort: "goals" };
const leagues = [...new Set(players.map(player => player.league))];

export default function PlayersPage() {
  const [filters, setFilters] = useState<PlayerFilters>(initialFilters);
  const teams = [...new Set(players.filter(player => !filters.league || player.league === filters.league).map(player => player.team))];
  const results = filterPlayers(players, filters);
  const update = (field: keyof PlayerFilters, value: string) => setFilters(current => ({ ...current, [field]: value }));
  function changeLeague(league: string) {
    setFilters(current => ({ ...current, league, team: "" }));
  }
  return (
    <PageIntro label={t("선수 탐색")} title={t("어떤 선수를 찾고 있나요?")} description={t("나만의 기준으로 선수를 찾아보세요.")}>
      <div className="players-content">
        <ApiPlayerSearch />
        <SavedPlayers />
        <details className="utility-drawer"><summary>{t("데이터 보관 및 DB 동기화")}<span>＋</span></summary><DatabaseSync /></details>
        <details className="demo-section"><summary>{t("학습용 데모 선수 · 검색·필터 연습")}</summary>
        <p className="demo-notice"><span>DEMO DATA</span>{t("가상 선수 12명의 학습용 데이터입니다. 소속팀과 시즌 기록은 실제 정보가 아닙니다.")}</p>
        <form className="player-filters" onSubmit={event => event.preventDefault()} aria-label={t("선수 검색 및 필터")}>
          <label className="search-field">{t("선수 이름")}<input type="search" placeholder={t("한글 또는 영문 이름 검색")} value={filters.query} onChange={event => update("query", event.target.value)} /></label>
          <label>{t("시즌")}<select aria-label={t("시즌")} value={filters.season} onChange={event => update("season", event.target.value)}>{seasons.map(season => <option key={season}>{season}</option>)}</select></label>
          <label>{t("리그")}<select aria-label={t("리그")} value={filters.league} onChange={event => changeLeague(event.target.value)}><option value="">{t("전체 리그")}</option>{leagues.map(league => <option key={league}>{league}</option>)}</select></label>
          <label>{t("팀")}<select aria-label={t("팀")} value={filters.team} onChange={event => update("team", event.target.value)}><option value="">{t("전체 팀")}</option>{teams.map(team => <option key={team}>{team}</option>)}</select></label>
          <label>{t("포지션")}<select aria-label={t("포지션")} value={filters.position} onChange={event => update("position", event.target.value)}><option value="">{t("전체 포지션")}</option><option value="FW">{t("FW · 공격수")}</option><option value="MF">{t("MF · 미드필더")}</option><option value="DF">{t("DF · 수비수")}</option><option value="GK">{t("GK · 골키퍼")}</option></select></label>
          <label>{t("정렬")}<select aria-label={t("정렬")} value={filters.sort} onChange={event => update("sort", event.target.value as PlayerSort)}><option value="goals">{t("득점 높은 순")}</option><option value="assists">{t("도움 높은 순")}</option><option value="minutes">{t("출전시간 높은 순")}</option><option value="name">{t("이름 가나다순")}</option></select></label>
        </form>
        <div className="results-toolbar"><p role="status" aria-live="polite">{t("검색 결과")}<strong>{results.length}</strong>{t("명")}<span>/ {players.length}명</span></p><button className="reset-button" type="button" onClick={() => setFilters({ ...initialFilters })}>{t("조건 초기화")}<span aria-hidden="true">↺</span></button></div>
        {results.length ? <div className="player-grid">{results.map(player => <PlayerCard key={player.id} player={player} season={filters.season} />)}</div> : <section className="empty-results"><h2>{t("조건에 맞는 선수가 없어요.")}</h2><p>{t("이름이나 필터를 바꾸거나, 조건을 초기화해 보세요.")}</p><button type="button" className="explore-btn" onClick={() => setFilters({ ...initialFilters })}>{t("전체 선수 보기")}</button></section>}
        </details>
      </div>
    </PageIntro>
  );
}
