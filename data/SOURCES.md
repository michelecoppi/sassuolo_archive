# Fonti dati

## Riepilogo stagioni

`data/seasons/sassuolo-verified-seasons.json` contiene il riepilogo verificato delle stagioni dal 2013/14 al 2025/26.

Fonte principale: FBref — US Sassuolo Calcio season/history pages.

Campi inclusi quando verificati:

- posizione finale
- partite
- vittorie / pareggi / sconfitte
- gol fatti / subiti
- punti
- record casa / trasferta
- alcuni capocannonieri quando chiaramente disponibili

## Partite di campionato

`npm run history:bootstrap` usa i CSV Football-Data:

`https://www.football-data.co.uk/mmz4281/<season-code>/<league>.csv`

Serie A = `I1`, Serie B = `I2`.

Sono importate solamente le righe in cui compare Sassuolo. I dati vengono normalizzati e salvati in SQLite e in `data/matches/sassuolo-league-history.json`.

## Giocatori

I dati giocatore completi non vengono inventati né ricostruiti da fonti non affidabili. La cartella `player-seasons/` accetta export verificati e supporta le colonne Standard più comuni di FBref (`Player`, `MP`, `Starts`, `Min`, `Gls`, `Ast`, `CrdY`, `CrdR`).

Per correzioni o inserimenti puntuali usa Data Manager → Modifica dati.

## API-Football / API-Sports (v3 integration)

Optional live/enrichment provider configured through `API_FOOTBALL_KEY`.

Used for:

- team and league ID discovery
- current squad
- player profiles and player-season statistics
- standings
- team-season statistics
- transfers
- current coach

API responses are normalized and persisted in SQLite. The React frontend does not call API-Football directly.

Historical availability depends on the subscription plan and the coverage reported by the API for each competition/season. Missing or unavailable API data must remain `NULL` / `N/D` and must not overwrite manual corrections.

## Pre-Serie A: Serie B 2008/09-2012/13

Lo storico di campionato viene ora esteso a cinque stagioni prima del debutto in Serie A:

- 2008/09, 2009/10, 2010/11, 2011/12, 2012/13: risultati e statistiche aggregate da Football-Data (`I2`); import ripetibile con `npm.cmd run history:bootstrap`.
- riepiloghi di stagione e capocannonieri: pagine storiche Sassuolo di FBref;
- rose: pagine *Detailed squad* di Transfermarkt; import ripetibile con `npm.cmd run history:pre-serie-a`.

La rosa Transfermarkt attesta l'appartenenza al club e può popolare nome, ruolo, nazionalità, numero e foto. Non viene usata per inferire presenze, minuti, gol o assist: questi campi restano `NULL` / `N/D` finché non esiste una fonte statistica verificata.

Eseguire `npm.cmd run data:audit` dopo un import. Il report deve avere zero `duplicateFixtures`, zero `seasonsWithoutLeagueMatches` per le stagioni concluse e segnalerà separatamente le righe di rosa prive di statistiche.
