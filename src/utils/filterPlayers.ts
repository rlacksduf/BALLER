import type { Player, PlayerFilters } from "../types/player";

const normalize = (value: string) =>
  value.normalize("NFKC").toLocaleLowerCase().replace(/\s+/g, "");

export function filterPlayers(
  players: Player[],
  filters: PlayerFilters,
): Player[] {
  const query = normalize(filters.query);
  return players
    .filter(
      (player) =>
        player.seasons[filters.season] &&
        (!query ||
          normalize(player.name).includes(query) ||
          normalize(player.englishName).includes(query)) &&
        (!filters.league || player.league === filters.league) &&
        (!filters.team || player.team === filters.team) &&
        (!filters.position || player.position === filters.position),
    )
    .sort((a, b) => {
      const byName = a.name.localeCompare(b.name, "ko");
      return filters.sort === "name"
        ? byName
        : b.seasons[filters.season]![filters.sort] -
            a.seasons[filters.season]![filters.sort] || byName;
    });
}
