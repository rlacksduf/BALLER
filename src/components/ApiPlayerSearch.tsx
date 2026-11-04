import { t } from "../i18n";
import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { searchApiPlayers } from "../services/football";
import LoadingState from "./LoadingState";
import { AddToCompare } from "./CompareSelection";
import type { ApiPlayer } from "../services/football";

export default function ApiPlayerSearch() {
  const [params, setParams] = useSearchParams();
  const name = params.get("q") ?? "";
  const offset = Math.max(
    0,
    Math.min(10000, Number(params.get("offset")) || 0),
  );
  const [query, setQuery] = useState(name);
  const [players, setPlayers] = useState<ApiPlayer[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    // URL 변경(뒤로 가기 포함)에 검색 입력과 API 요청 상태를 맞춥니다.
    // eslint-disable-next-line react/set-state-in-effect
    setQuery(name);
    if (name.trim().length < 2) {
      setPlayers([]);
      setBusy(false);
      return;
    }
    const controller = new AbortController();
    setBusy(true);
    setError("");
    setPlayers([]);
    searchApiPlayers(name, controller.signal, offset)
      .then(setPlayers)
      .catch((error) => {
        if (!controller.signal.aborted)
          setError(
            error instanceof Error ? error.message : t("검색에 실패했습니다."),
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, [name, retry, offset]);
  return (
    <section
      className="api-search global-player-search"
      aria-labelledby="api-title"
    >
      <span className="status-label">{t("선수 검색")}</span>
      <h2 id="api-title">{t("실제 선수 찾기")}</h2>
      <p>
        {t("저장된 선수를 먼저 검색합니다. 외부 API 제한 중에도 저장된 선수의 시즌 기록을 확인할 수 있습니다.")}
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (query.trim() === name) setRetry((value) => value + 1);
          else setParams({ q: query.trim() });
        }}
        className="api-search-form"
      >
        <label>
          {t("선수 이름")}
          <input
            ref={input}
            type="search"
            placeholder={t("예: Son, Haaland, Mbappe")}
            minLength={2}
            maxLength={80}
            required
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <button
          className="explore-btn"
          disabled={busy || query.trim().length < 2}
          type="submit"
        >
          {busy ? t("검색 중…") : t("선수 검색 →")}
        </button>
      </form>
      {!name && (
        <div className="api-player-list" aria-label={t("추천 검색")}>
          {["Haaland", "Son", "Mbappe", "Salah"].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setParams({ q: value })}
            >
              {value} ↗
            </button>
          ))}
        </div>
      )}
      <div aria-live="polite">
        {busy && <LoadingState label={t("선수 정보를 가져오고 있습니다.")} />}
        {error && (
          <div className="api-error">
            <p role="alert">{error}</p>
            <button
              type="button"
              className="reset-button"
              onClick={() => setRetry((value) => value + 1)}
            >
              {t("다시 시도 ↺")}
            </button>
          </div>
        )}
        {name && !busy && !error && (
          <p>
            검색 결과 {players.length}명 · {Math.floor(offset / 12) + 1}페이지
          </p>
        )}
      </div>
      {name && !busy && !error && players.length === 0 && (
        <p>{t("검색된 선수가 없습니다. 다른 영문 이름을 입력해 보세요.")}</p>
      )}
      <div className="player-grid api-results">
        {players.map((player) => (
          <article className="player-card api-result-card" key={player.id}>
            <Link to={`/players/${player.id}`}>
              <span className="status-label">PLAYER PROFILE</span>
              {player.logo && (
                <img
                  className="player-photo"
                  src={player.logo}
                  alt=""
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  onError={(event) => {
                    event.currentTarget.hidden = true;
                  }}
                />
              )}
              <h3>{player.name}</h3>
              <span className="text-link">{t("시즌 기록 보기 →")}</span>
            </Link>
            <AddToCompare player={player} />
          </article>
        ))}
      </div>
      {name && !busy && (
        <div className="pagination">
          <button
            className="reset-button"
            disabled={offset === 0}
            onClick={() =>
              setParams({ q: name, offset: String(Math.max(0, offset - 12)) })
            }
          >
            {t("← 이전")}
          </button>
          <span>{Math.floor(offset / 12) + 1}페이지</span>
          <button
            className="reset-button"
            disabled={players.length < 12}
            onClick={() => setParams({ q: name, offset: String(offset + 12) })}
          >
            {t("다음 →")}
          </button>
        </div>
      )}
      <a
        className="text-link"
        href="https://highlightly.net/football-api/"
        target="_blank"
        rel="noreferrer"
      >
        {t("데이터 출처: Highlightly ↗")}
      </a>
    </section>
  );
}
