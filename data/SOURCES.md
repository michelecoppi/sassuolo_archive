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

## UEFA Europa League 2016/17

La scheda della competizione usa le pagine ufficiali UEFA per risultati corretti, classifica finale del Gruppo F, fase raggiunta e quadro delle eliminazioni fino alla finale. Le dieci partite del Sassuolo restano divise tra quattro gare di qualificazione (Luzern e Crvena zvezda) e sei gare della fase a gironi; il riepilogo aggregato è 3 vittorie, 4 pareggi, 3 sconfitte e 17-13 reti.

- Club per fase e tabellone: <https://www.uefa.com/uefaeuropaleague/history/seasons/2017/clubs/>
- Luzern-Sassuolo: <https://www.uefa.com/uefaeuropaleague/match/2020373--luzern-vs-sassuolo/>
- Gruppo F e Sassuolo-Genk: <https://www.uefa.com/uefaeuropaleague/news/0233-0e95c1c35e88-f3edf7b19d01-1000--sassuolo-v-genk-background/>

## StatsBomb Open Data — Serie A 2015/16

Il candidato `match-details-statsbomb-serie-a-2015-16-poc` usa StatsBomb Open Data per Sassuolo–Milan del 6 marzo 2016 (match ID `3879771`). Il pacchetto conserva metadata, eventi e formazioni raw con checksum, oltre a una vista normalizzata limitata a stadio, arbitro, formazioni, gol, cartellini e sostituzioni.

- Repository e condizioni di attribuzione: <https://github.com/hudl/open-data>
- Metadata Serie A 2015/16: <https://raw.githubusercontent.com/hudl/open-data/master/data/matches/12/27.json>
- Eventi partita: <https://raw.githubusercontent.com/hudl/open-data/master/data/events/3879771.json>
- Formazioni partita: <https://raw.githubusercontent.com/hudl/open-data/master/data/lineups/3879771.json>

La POC serve a validare il modello rich-data prima di estenderlo alle altre gare della stagione. I valori non presenti restano `NULL`; l'intero event stream viene archiviato per riproducibilità ma non pubblicato integralmente nella timeline della partita.

### Estensione completa 2015/16

Il candidato `match-details-statsbomb-serie-a-2015-16` estende la POC a tutte le 38 gare: 77 JSON originali indicizzati, 76 distinte, 484 eventi editoriali e 978 tiri con xG. StatsBomb richiede l'attribuzione nelle analisi pubblicate; credito e link sono conservati nel pacchetto, nella provenienza SQLite e nella scheda partita.

## Wyscout / Figshare — Serie A 2017/18

Le 38 partite 2017/18 derivano dal **Soccer match event dataset** di Luca Pappalardo et al., distribuito su Figshare con licenza **CC BY 4.0**. Il pacchetto conserva archivi originali, checksum, citazione e DOI. Sono importati 76 distinte, 484 eventi e 908 tiri; gli xG restano `NULL` perché assenti dalla fonte.

- Dataset: <https://figshare.com/collections/Soccer_match_event_dataset/4415000>
- Articolo: <https://doi.org/10.1038/s41597-019-0247-7>
- Adattamento di riferimento: <https://github.com/koenvo/wyscout-soccer-match-event-dataset>

## Reep, OpenFootball e SofaScore

- **Reep — The football entity register**, release v0 2026.25, CC0: <https://github.com/withqwerty/reep>. Sono stati importati soltanto i 56 collegamenti locali univoci, pari a 204 identificativi; gli ID v0 non sono trattati come ID Reep v1.
- **OpenFootball Italy**, CC0: <https://github.com/openfootball/italy>. È la baseline indipendente che ha confermato 38/38 risultati 2015/16 e 38/38 risultati 2017/18; dossier in `data/reconciliation/baselines/openfootball/`.
- **SofaScore Scraper di Tuncay Eşsiz**, MIT: <https://github.com/tunjayoff/sofascore_scraper>. Il probe pubblico ha restituito HTTP 403; non sono stati effettuati aggiramenti o scraping massivo e nessun dato SofaScore è stato importato. Evidenza in `data/reconciliation/probes/sofascore/`.

## Pre-Serie A: Serie B 2008/09-2012/13

Lo storico di campionato viene ora esteso a cinque stagioni prima del debutto in Serie A:

- 2008/09, 2009/10, 2010/11, 2011/12, 2012/13: risultati e statistiche aggregate da Football-Data (`I2`); import ripetibile con `npm.cmd run history:bootstrap`.
- riepiloghi di stagione e capocannonieri: pagine storiche Sassuolo di FBref;
- rose: pagine *Detailed squad* di Transfermarkt; import ripetibile con `npm.cmd run history:pre-serie-a`.

La rosa Transfermarkt attesta l'appartenenza al club e può popolare nome, ruolo, nazionalità, numero e foto. Non viene usata per inferire presenze, minuti, gol o assist: questi campi restano `NULL` / `N/D` finché non esiste una fonte statistica verificata.

Eseguire `npm.cmd run data:audit` dopo un import. Il report deve avere zero `duplicateFixtures`, zero `seasonsWithoutLeagueMatches` per le stagioni concluse e segnalerà separatamente le righe di rosa prive di statistiche.

## Storia del club e staff tecnico

I record editoriali condivisi da pagina Club e Timeline sono in `club-history.json`; gli incarichi di allenatori e staff sono in `technical-staff.json`. Ogni voce conserva un `sourceUrl` puntuale. Le fonti primarie principali sono le sezioni ufficiali **La nostra storia**, **Mapei Stadium**, **Organigramma** e i comunicati ufficiali sugli staff 2025/26 e 2026/27 del Sassuolo Calcio. Per lo staff 2024/25 si usa una fonte secondaria che trascrive la comunicazione del club non più indicizzata; il limite è documentato nel pacchetto `season-context-serie-b-2024-25`. Date o termini non dichiarati restano `N/D` e non vengono inferiti dal campo `seasons.manager`.
