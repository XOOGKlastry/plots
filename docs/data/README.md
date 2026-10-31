# Municipality snapshot

Sources: GUS Bank Danych Lokalnych (https://bdl.stat.gov.pl/), PRG administrative identifiers and a reference dataset inspected on 2026-10-31.

- `baza.json`: `zbudowano=2026-10-03`, 2479 municipalities, GUS BDL statistics, Wikidata descriptions and coordinates, PRG administrative identifiers.
- `karty-dane.json`: `pobrano=2026-10-05T05:00:16.939084+00:00`, per-field observation years and GUS variable metadata.
- `gminy.json` preserves those source values and years. The UI selects the dated supplementary measurement first; it never substitutes the snapshot date for an unknown observation year or turns missing data into zero.
- TERYT is a seven-character string. Urban, rural and urban-rural municipalities remain distinct even when their names match. No geometry is bundled or inferred from a municipal seat point.
- The school-per-population ratio is not exposed: the source does not fully record the denominator year. Debt is not exposed because the source marks it as suspended.

Service POIs, existing walking-distance codes and RCN grids are integrated as map layers using the local surroundings catalog. They are not presented as aggregated municipality statistics. Direct GUS catalogs and refresh procedures are described in EXPANSION.md.

Refresh by rebuilding this snapshot from reviewed source files. Retain source metadata, check unique TERYT codes and observation years, then run `node --test tests/gminy-model.test.cjs` and the browser checks.
