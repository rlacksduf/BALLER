const cacheKey = "baller-api-cache-v1";
const quotaKey = "baller-quota-until";
const event = "baller-quota-change";
type Saved = { at: number; body: unknown };
function readCache(): Record<string, Saved> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(cacheKey) ?? "{}");
  } catch {
    return {};
  }
}
export function quotaUntil(): number {
  if (typeof window === "undefined") return 0;
  try {
    return Number(localStorage.getItem(quotaKey)) || 0;
  } catch {
    return 0;
  }
}
export function markQuota(until = Date.now() + 24 * 60 * 60 * 1000) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(quotaKey, String(until));
    window.dispatchEvent(new Event(event));
  } catch {
    /* 저장 제한 시 오류 메시지는 그대로 표시합니다. */
  }
}
export function subscribeQuota(listener: () => void) {
  window.addEventListener(event, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(event, listener);
    window.removeEventListener("storage", listener);
  };
}
export async function apiRequest(
  params: URLSearchParams,
  signal?: AbortSignal,
): Promise<unknown> {
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  params.sort();
  const path = params.toString(),
    saved = readCache()[path];
  const blocked = quotaUntil() > Date.now();
  if (
    !params.has("id") &&
    !params.has("name") &&
    saved &&
    (blocked ||
      Date.now() - saved.at <
        (params.get("action") === "matches"
          ? 10 * 60 * 1000
          : 24 * 60 * 60 * 1000))
  )
    return saved.body;
  // 한도 차단은 서버가 집행합니다. 로컬 백엔드의 DB 조회는 계속 허용합니다.
  const response = await fetch("/api/football?" + path, { signal });
  const body: unknown = await response.json().catch(() => {
    throw new Error("서버 응답을 읽지 못했습니다.");
  });
  if (response.status === 429) {
    const until = Number(response.headers.get("X-Baller-Quota-Until"));
    markQuota(until > Date.now() ? until : undefined);
    if (saved) return saved.body;
  }
  if (!response.ok && saved && [429, 502, 503, 504].includes(response.status))
    return saved.body;
  if (!response.ok)
    throw new Error(
      body &&
        typeof body === "object" &&
        "error" in body &&
        typeof body.error === "string"
        ? body.error
        : "데이터를 가져오지 못했습니다.",
    );
  if (typeof window !== "undefined")
    try {
      const cache = readCache();
      cache[path] = { at: Date.now(), body };
      const entries = Object.entries(cache)
        .sort((a, b) => b[1].at - a[1].at)
        .slice(0, 40);
      localStorage.setItem(
        cacheKey,
        JSON.stringify(Object.fromEntries(entries)),
      );
    } catch {
      /* 저장 공간 부족 시 응답은 계속 사용합니다. */
    }
  return body;
}
