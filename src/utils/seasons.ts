// 제공업체가 26/27, 2025처럼 혼합해서 반환하는 시즌을 시작 연도로 정렬합니다.
export function seasonStart(value: string): number {
  const match = value.match(/^(\d{2,4})(?:\/|$)/);
  if (!match) return -1;
  const year = Number(match[1]);
  return match[1]!.length === 2 ? 2000 + year : year;
}
export function newestSeasonFirst(a: string, b: string): number {
  return seasonStart(b) - seasonStart(a) || b.localeCompare(a);
}
