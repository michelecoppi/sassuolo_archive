# Player-season imports

Put JSON or CSV files here. Supported columns include:

`player_name,season,competition,appearances,starts,minutes,goals,assists,yellow_cards,red_cards,clean_sheets`

The importer also accepts common FBref Standard-table abbreviations:
`name/Player`, `MP`, `Starts`, `Min`, `Gls`, `Ast`, `CrdY`, `CrdR`.

Example:

```csv
player_name,season,competition,appearances,starts,minutes,goals,assists,yellow_cards,red_cards
Domenico Berardi,2013/14,Serie A,29,26,2170,16,6,10,1
```

Run `npm run import:all` after placing files here.

## Archivio StatBunker verificato

`statbunker-high-priority-2013-2026.csv` contiene 265 righe per le nove
stagioni di Serie A 2013/14–2021/22. Include solo presenze, titolarità e gol,
gli unici campi pubblicati dalla tabella `SeasonAppearances`; le altre metriche
restano intenzionalmente vuote. Ogni riga conserva l'URL della tabella fonte.

Il file è generabile e importabile con:

```bash
npm.cmd run history:statbunker-player-seasons -- --apply
```
### Tabellini verificati (Europa League e Coppa Italia)

`verified-match-reports-2020-2023.csv` copre integralmente: Europa League 2016/17 (10 partite: 4 qualificazioni/play-off e 6 del girone), Coppa Italia 2020/21, 2021/22 e 2022/23. Registra solo presenze, titolarità e gol quando risultano nei tabellini; minuti, assist e cartellini non vengono stimati.

```bash
npm run history:verified-match-player-seasons -- --apply
```

### Serie A 2025/26: copertura parziale esplicita

La fonte locale contiene statistiche giocatore complete per 8 delle 38 partite. Il comando seguente importa solo quelle righe, con provider `kickoff-derived (partial 8/38)` e riferimenti alle partite sorgente: non rappresenta la stagione completa.

```bash
npm run history:derive-partial-2025-serie-a -- --apply
```
