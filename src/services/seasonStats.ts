import { getMatches, getMatchPlayer } from "./matchStats.ts";
import type { CompetitionStats } from "./football";
import type { Sample } from "../utils/scouting";
export type SeasonCollection = {
  samples: Sample[];
  fixtures: number;
  checked: number;
  missing: number;
  failed: number;
  limited: boolean;
  stopped: boolean;
  failure: string | null;
};
export async function collectSeason(
  playerId: number,
  rows: CompetitionStats[],
  season: string,
  signal: AbortSignal,
  progress: (done: number, total: number) => void,
): Promise<SeasonCollection> {
  const entries = [
    ...new Map(
      rows
        .filter((row) => !(row.gamesPlayed === 0 && row.minutesPlayed === 0))
        .map((row) => [row.club + "|" + row.league, row]),
    ).values(),
  ];
  const matches = new Map<number, import("./matchStats").Match>();
  let limited = false;
  for (const entry of entries) {
    const result = await getMatches(entry.club, entry.league, season, signal);
    limited ||= result.limited;
    for (const match of result.matches) matches.set(match.id, match);
  }
  if (matches.size === 0 && rows.some((row) => (row.gamesPlayed ?? 0) > 0))
    throw new Error(
      "시즌 출전 기록은 있지만 종료 경기를 조회하지 못했습니다. 팀·대회 식별자 또는 API 제공 범위를 확인한 뒤 다시 시도해 주세요.",
    );
  const result: SeasonCollection = {
    samples: [],
    fixtures: matches.size,
    checked: 0,
    missing: 0,
    failed: 0,
    limited,
    stopped: false,
    failure: null,
  };
  const ordered = [...matches.values()].sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  const samples: (Sample | undefined)[] = new Array(ordered.length);
  const requests = new AbortController();
  const cancel = () => requests.abort();
  signal.addEventListener("abort", cancel, { once: true });
  if (signal.aborted) cancel();
  let next = 0;
  async function worker() {
    while (!result.stopped && !requests.signal.aborted) {
      const index = next++;
      const match = ordered[index];
      if (!match) return;
      try {
        const sample = await getMatchPlayer(match.id, playerId, requests.signal);
        if (requests.signal.aborted) return;
        if (sample && sample.minutes !== null && sample.minutes > 0) samples[index] = sample;
        else result.missing++;
      } catch (error) {
        // Cancellation of sibling requests is not another failed match.
        if (requests.signal.aborted) return;
        result.failed++;
        result.stopped = true;
        result.failure = error instanceof Error ? error.message : "경기 조회에 실패했습니다.";
        requests.abort();
      }
      result.checked++;
      progress(result.checked, result.fixtures);
    }
  }
  try {
    // At most three match requests in flight; do not enqueue the whole season.
    await Promise.all(Array.from({ length: Math.min(3, ordered.length) }, () => worker()));
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    result.samples = samples.filter((sample): sample is Sample => sample !== undefined);
    return result;
  } finally {
    signal.removeEventListener("abort", cancel);
    requests.abort();
  }
}
