import type { Aggregate, Sample } from "../utils/scouting";
export type StoredAnalysis = {
  samples: Sample[];
  snapshot: Aggregate | null;
  source: string;
  fetchedAt: string | null;
  limited: boolean;
};
export async function getStoredAnalysis(
  id: number,
  season: string,
  competition: string,
  signal: AbortSignal,
): Promise<StoredAnalysis> {
  const response = await fetch(
    `/api/backend/players/${id}/analysis?` +
      new URLSearchParams({ season, competition }),
    { signal },
  );
  if (!response.ok) throw new Error("저장 상세 기록을 조회하지 못했습니다.");
  const body = await response.json();
  if (!Array.isArray(body.samples))
    throw new Error("저장 상세 기록 형식을 확인해 주세요.");
  return body;
}
