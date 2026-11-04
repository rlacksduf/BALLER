import { t } from "../i18n";
import { useEffect, useState, useSyncExternalStore } from "react";
import { getPlayerProfile } from "../services/football";
import { getCatalog, subscribeCatalog } from "../services/catalog";
import type { PlayerProfile as Profile } from "../services/football";
export default function PlayerProfile({ id }: { id: number }) {
  const saved = useSyncExternalStore(subscribeCatalog, getCatalog).find(
    (player) => player.id === id,
  );
  const [profile, setProfile] = useState<Profile | null>(null),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0),
    [busy, setBusy] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    // 외부 프로필 요청을 시작하면서 이전 응답 상태를 초기화합니다.
    // eslint-disable-next-line react/set-state-in-effect
    setBusy(true);
    setError("");
    setProfile(null);
    getPlayerProfile(id, controller.signal)
      .then(setProfile)
      .catch((error) => {
        if (!controller.signal.aborted)
          setError(
            error instanceof Error
              ? error.message
              : t("프로필을 가져오지 못했습니다."),
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, [id, retry]);
  const birthday = profile?.birthDate?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const [now] = useState(() =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .format(new Date())
      .split("-")
      .map(Number),
  );
  const age = birthday
    ? now[0]! -
      Number(birthday[3]) -
      (now[1]! < Number(birthday[2]) ||
      (now[1] === Number(birthday[2]) && now[2]! < Number(birthday[1]))
        ? 1
        : 0)
    : null;
  return (
    <section
      className="api-search profile-panel"
      aria-labelledby="profile-heading"
    >
      <span className="status-label">PLAYER IDENTITY</span>
      <h2 id="profile-heading">{t("선수 프로필")}</h2>
      {busy && <p role="status">{t("프로필 조회 중…")}</p>}
      {error && (
        <div>
          <p role="alert">
            {error} 시즌 기록은 아래에서 계속 확인할 수 있습니다.
          </p>
          <button
            type="button"
            className="reset-button"
            onClick={() => setRetry((v) => v + 1)}
          >
            {t("프로필 다시 불러오기 ↺")}
          </button>
        </div>
      )}
      {profile && (
        <>
          <>
            {saved?.logo && (
              <img
                className="player-photo"
                src={saved.logo}
                alt={`${profile.name} 프로필`}
                referrerPolicy="no-referrer"
                onError={(event) => {
                  event.currentTarget.hidden = true;
                }}
              />
            )}
          </>
          <p>
            {profile.name} ·{" "}
            {t(
              "저장된 프로필과 시즌 기록 기준입니다. 일부 항목이 없거나 최신 소속과 다를 수 있습니다.",
            )}
          </p>
          <dl className="profile-grid">
            {[
              [
                t("나이"),
                age !== null && age >= 0 && age < 100
                  ? `${age}세`
                  : t("정보 없음"),
              ],
              [t("등번호"), t("경기별 기록에서 확인")],
              [t("현재 소속"), profile.club],
              [t("주 포지션"), profile.position],
              [t("보조 포지션"), profile.secondary],
              [t("국적"), profile.citizenship],
              [t("생년월일"), profile.birthDate],
              [t("키"), profile.height],
              [t("주발"), profile.foot],
              [t("입단일"), profile.joined],
              [t("계약 만료"), profile.contract],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{typeof label === "string" ? t(label) : label}</dt>
                <dd>{value ?? t("정보 없음")}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </section>
  );
}
