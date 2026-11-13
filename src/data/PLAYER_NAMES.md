# Korean football-name search index

`player-names.ko.json` is an offline name dictionary, not a source of player IDs, current squad membership, or match statistics.

Sources:
- [Wikidata](https://www.wikidata.org/): Korean and English labels of entities with occupation `association football player` (Q937857). Structured data is CC0. Records retain their Wikidata Q-ID for provenance.
- [Korean Wikipedia](https://ko.wikipedia.org/): supplemental article titles and English language links. These derived entries retain their article paths and are attributed to Wikipedia contributors under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).

`scripts/player-name-leagues.ko.json` records the Korean Wikipedia category snapshot for the Premier League, Bundesliga, Serie A, La Liga, and Ligue 1. Those categories include former players. `scripts/player-name-unresolved.ko.json` lists category entries without a verified name mapping. The index's `coverage` reports matched category names, **not** verified current squad coverage. Players missing Korean labels or linked articles may be absent.

Regenerate with `python3 scripts/update-player-names.py`, or supply downloaded SPARQL JSON result files using `--input file.json ...`. Failed downloads leave the previous index intact. Common spelling variants in `playerSearch.ts` supplement the sourced names. English labels can differ from provider names, so a known alias does not guarantee a provider result or available statistics.

## Five-league supplement

`scripts/player-name-five-leagues.json` uses only name labels from the public [NEXON FC Online metadata](https://open.api.nexon.com/static/fconline/meta/spid.json) and the English names/league grouping in the [FC26 snapshot by Basche14](https://github.com/Basche14/EAFC26/blob/main/ea_fc26_players.csv). It covers 2,543 source players across the five leagues with no missing Korean labels. The shared EA name identifier is used only while building this supplement; it is never treated as a Highlightly player ID. No game abilities or game statistics are imported. This snapshot is **not** a verified 2026/27 registration list.

The [NEXON API notice](https://openapi.nexon.com/ko/game/fconline/) requires refreshing crawled API data within 30 days. To refresh these public name labels and rebuild the index, run:

```sh
python3 scripts/refresh-five-league-names.py
python3 scripts/update-player-names.py
```

A normal rebuild preserves the existing verified Wikidata labels. Use `--input` with complete or explicitly recovered SPARQL result files to extend them. Partial source results are not represented as complete roster coverage. `fiveLeagueSnapshotCounts` describes the FC26 supplement; `coverage` describes matching historical Wikipedia category names, which is a different scope.

## Stars and legends

The explicit aliases in `src/utils/playerSearch.ts` include familiar short names and spelling variants for transferred stars and former players, independent of their current league. They only produce search terms; neither a legacy profile nor historical statistics are fabricated when Highlightly has no matching record. `호날두` resolves to Cristiano Ronaldo; `호나우두` resolves to the Brazilian Ronaldo. Ambiguous surnames such as `마르티네스` are not silently assigned to one player.
