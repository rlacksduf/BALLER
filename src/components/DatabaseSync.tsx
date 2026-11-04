import { t } from "../i18n";
import { useEffect, useState, useSyncExternalStore } from "react";
import { getCatalog, subscribeCatalog } from "../services/catalog";
export default function DatabaseSync() {
  const players = useSyncExternalStore(subscribeCatalog, getCatalog);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [status, setStatus] = useState(t("서버 DB 연결 확인 중…"));
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/backend/health", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Unavailable");
        return response.json();
      })
      .then((body) =>
        setStatus(
          `${body.database === "supabase" ? "Supabase 클라우드" : "로컬"} DB 연결됨 · 선수 ${body.counts.baller_players}명 · 시즌 기록 ${body.counts.baller_player_seasons}개`,
        ),
      )
      .catch(() => {
        if (!controller.signal.aborted)
          setStatus(
            t(
              "서버 DB 연결을 확인해 주세요. 브라우저의 저장 기록은 유지됩니다.",
            ),
          );
      });
    return () => controller.abort();
  }, []);
  return (
    <section className="api-search">
      <span className="status-label">SERVER DATABASE</span>
      <h2>{t("저장한 기록을 서버 DB로")}</h2>
      <p role="status">{status}</p>
      <p>
        {t(
          "이 브라우저의 선수·프로필·시즌 기록을 서버 DB에 저장합니다. 같은 선수·시즌은 갱신하며 외부 축구 API는 호출하지 않습니다. 경기별 원본이 없는 합산 결과를 개별 경기 기록으로 만들지는 않습니다.",
        )}
      </p>
      <button
        type="button"
        className="explore-btn collect-button"
        disabled={busy || !players.length}
        onClick={async () => {
          setBusy(true);
          setMessage("");
          try {
            const response = await fetch("/api/backend/library", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ players }),
            });
            const result = await response.json();
            if (!response.ok)
              throw new Error(result.error ?? t("DB 저장에 실패했습니다."));
            setMessage(
              `선수 ${result.importedPlayers}명 · 시즌 기록 ${result.importedSeasons}개 · 분석 요약 ${result.importedAnalyses ?? 0}개를 DB에 저장했습니다.`,
            );
          } catch (error) {
            setMessage(
              error instanceof Error
                ? error.message
                : t("DB 연결을 확인해 주세요."),
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? t("DB에 저장 중…") : t("기존 기록 DB에 저장")}
      </button>
      <p role="status">{message}</p>
    </section>
  );
}
