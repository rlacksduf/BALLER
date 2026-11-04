import { t } from "../i18n";
import { useEffect, useState, useSyncExternalStore } from "react";
import { markQuota, quotaUntil, subscribeQuota } from "../services/apiRequest";
export default function QuotaNotice() {
  const until = useSyncExternalStore(subscribeQuota, quotaUntil);
  const [now] = useState(Date.now);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/football?action=status", { signal: controller.signal })
      .then((response) => response.json())
      .then((body) => {
        if (
          typeof body.blockedUntil === "number"
        )
          markQuota(body.blockedUntil > Date.now() ? body.blockedUntil : 0);
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  if (until <= now) return null;
  return (
    <aside className="quota-notice" role="status">
      <details>
        <summary>
          <span className="connection-dot" />
          {t("저장 데이터 모드")}
          <span className="quota-summary-note">
            {t("· 외부 API 한도 소진")}
          </span>
          <span className="quota-expand">{t("자세히 ＋")}</span>
        </summary>
        <p>
          {t(
            "저장된 선수·프로필·수집 기록은 계속 볼 수 있습니다. 저장 기록은 최신 데이터가 아닐 수 있으며, 새 데이터 수집은 제한됩니다. 반복 새로고침으로 재요청하지 않습니다.",
          )}
        </p>
        <button
          type="button"
          className="reset-button"
          onClick={async () => {
            try {
              const response = await fetch("/api/football?action=resume", {
                method: "POST",
              });
              if (response.ok) markQuota(0);
            } catch {
              /* 연결 오류 시 기존 차단 상태 유지 */
            }
          }}
        >
          {t("제공업체 한도 회복 후 연결 재개")}
        </button>
        <p>
          {t(
            "이 버튼은 앱의 조회 차단만 해제합니다. 제공업체의 요청 한도는 초기화하지 않습니다.",
          )}
        </p>
      </details>
    </aside>
  );
}
