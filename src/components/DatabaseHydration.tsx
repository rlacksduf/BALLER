import { useEffect } from "react";
import { savePlayer } from "../services/catalog";
export default function DatabaseHydration() {
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/backend/library?limit=100", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Database unavailable");
        return response.json();
      })
      .then((body) => {
        if (!Array.isArray(body.data)) return;
        for (const player of body.data) {
          if (
            !controller.signal.aborted &&
            Number.isSafeInteger(player.id) &&
            typeof player.name === "string" &&
            Array.isArray(player.stats)
          )
            savePlayer(player.id, player);
        }
      })
      .catch(() => {
        /* DB가 일시 중단되어도 브라우저의 기존 저장 기록은 계속 표시합니다. */
      });
    return () => controller.abort();
  }, []);
  return null;
}
