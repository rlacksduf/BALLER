export type Position = "FW" | "MF" | "DF" | "GK";
export type PlayerStats = {
  appearances: number;
  minutes: number;
  goals: number;
  assists: number;
};
export type Player = {
  id: string;
  name: string;
  englishName: string;
  nationality: string;
  team: string;
  league: string;
  position: Position;
  number: number;
  seasons: Record<string, PlayerStats>;
};
export type PlayerSort = "goals" | "assists" | "minutes" | "name";
export type PlayerFilters = {
  query: string;
  league: string;
  team: string;
  position: string;
  season: string;
  sort: PlayerSort;
};
