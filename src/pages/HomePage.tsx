import { t } from "../i18n";
import { Link, useNavigate } from "react-router-dom";
import { useState, useSyncExternalStore } from "react";
import { getCatalog, subscribeCatalog } from "../services/catalog";
import SavedPlayers from "../components/SavedPlayers";
import "./PlayersPage.css";
export default function HomePage() {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const saved = useSyncExternalStore(subscribeCatalog, getCatalog);
  const suggestions =
    query.trim().length >= 2
      ? saved
          .filter((p) =>
            p.name.toLowerCase().includes(query.trim().toLowerCase()),
          )
          .slice(0, 5)
      : [];
  const pair = saved.filter((p) => p.stats.length > 0).slice(0, 2);
  const matchup =
    pair.length === 2
      ? `/compare?a=${pair[0]!.id}&b=${pair[1]!.id}`
      : "/compare";
  return (
    <main id="main-content" className="hero home-page" tabIndex={-1}>
      <div className="home-hero">
        <section className="home-copy">
          <p className="hero-label">{t("축구를 보는 새로운 시선")}</p>
          <h1>
            Know Your
            <br />
            <span>Players.</span>
          </h1>
          <p className="home-lead">
            {t("기록 너머의 플레이를 발견하세요.")}
            <br />
            {t("선수를 탐색하고, 차이를 읽고, 나만의 대결을 만드세요.")}
          </p>
          <form
            className="api-search-form home-search"
            onSubmit={(e) => {
              e.preventDefault();
              navigate("/players?q=" + encodeURIComponent(query.trim()));
            }}
          >
            <label>
              <span className="sr-only">{t("선수 이름 검색")}</span>
              <input
                type="search"
                required
                minLength={2}
                maxLength={80}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("선수 이름을 검색하세요")}
              />
            </label>
            <button
              type="submit"
              className="explore-btn"
              aria-label={t("선수 검색")}
            >
              {t("검색 ↗")}
            </button>
          </form>
          {suggestions.length > 0 && (
            <nav className="home-suggestions" aria-label={t("관련 선수 추천")}>
              {suggestions.map((p) => (
                <Link key={p.id} to={`/players/${p.id}`}>
                  {p.name} ↗
                </Link>
              ))}
            </nav>
          )}
          <div className="hero-shortcuts">
            <span>{t("어디서 시작할까요?")}</span>
            <Link to="/players">{t("선수 둘러보기 ↗")}</Link>
            <Link to="/compare">{t("비교 시작하기 ↗")}</Link>
          </div>
        </section>
        <Link className="featured-matchup" to={matchup}>
          <div className="feature-heading">
            <span className="status-label">{t("추천 대결")}</span>
            <span>{t("선수 비교 ↗")}</span>
          </div>
          <div className="pitch-art" aria-hidden="true">
            <div className="pitch-lines">
              <i />
              <b />
              <em />
            </div>
            <span className="pitch-marker marker-a">A</span>
            <span className="pitch-marker marker-b">B</span>
            <strong>VS</strong>
          </div>
          <div className="featured-names">
            <div>
              <small>PLAYER A</small>
              <h2>{pair[0]?.name ?? t("당신의 첫 번째 선수")}</h2>
            </div>
            <span>×</span>
            <div>
              <small>PLAYER B</small>
              <h2>{pair[1]?.name ?? t("새로운 라이벌")}</h2>
            </div>
          </div>
          <div className="feature-bottom">
            <span>{t("같은 기록, 다른 플레이.")}</span>
            <strong>{t("대결 살펴보기 →")}</strong>
          </div>
        </Link>
      </div>
      <div className="section-divider">
        <span>{t("나의 스카우팅 노트")}</span>
        <span>{t("탐색부터 분석까지")}</span>
      </div>
      <div className="players-content">
        <SavedPlayers home />
        <section className="home-features">
          {[
            ["Explore", t("실제 선수와 시즌 기록 탐색"), "/players"],
            ["Battle", t("포지션과 역할로 읽는 두 선수"), "/compare"],
            [
              "Scout",
              t("상세 지표와 스카우팅 보고서"),
              saved[0] ? `/players/${saved[0].id}` : "/players",
            ],
          ].map(([label, title, url]) => (
            <Link key={label} to={url!} className="player-card">
              <span className="feature-label">
                {typeof label === "string" ? t(label) : label}
              </span>
              <h2>{title}</h2>
              <span className="feature-arrow" aria-hidden="true">
                ↗
              </span>
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}
