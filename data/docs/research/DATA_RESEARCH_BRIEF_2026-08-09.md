# Brief di ricerca dati — Sassuolo History

Data di riferimento: 9 agosto 2026, 15:21 CEST. Questo documento è il mandato da consegnare a un agente di ricerca. L'agente deve produrre soltanto candidati verificabili e manifest; non deve modificare SQLite, eseguire sincronizzazioni provider, dedurre valori o sostituire `NULL` con zero.

## Stato valido da preservare

- 26 stagioni, 726 partite: risultati/core storico completi nel perimetro dichiarato. Non ricercare né reimportare risultati già presenti senza una discrepanza documentata.
- 2026/27 è una stagione predisposta: zero partite/statistiche è corretto, non è un buco.
- Evento `match_events.id=134`: Verona–Sassuolo, 3 ottobre 2025, Walid Cheddira, ammonizione al **47'**, fonte ESPN e nota curatoriale. Il conflitto provider `-5` è risolto; non proporre un valore alternativo senza una fonte più autorevole.
- Integrità al controllo: zero chiavi esterne non valide, fixture duplicate, giocatori quasi duplicati, minuti evento impossibili, statistiche negative e trasferimenti duplicati.

## Priorità P0 — statistiche giocatore/stagione

Obiettivo: completare dati solo quando esiste un export o una pagina fonte riproducibile. Il record è identificato da `player_name + season + competition`; includere anche ID provider quando disponibile.

| Perimetro | Stato attuale | Richiesta di ricerca |
| --- | --- | --- |
| Serie B 2008/09–2012/13 | 189 righe di rosa, nessuna presenza/minuto/gol/assist | Trovare export Standard FBref archiviato o dataset equivalente verificabile. Priorità: 2012/13, poi a ritroso. Non stimare statistiche da presenze nella rosa. |
| Serie A 2013/14–2021/22 | zero `PlayerSeason` | Ricostruire una stagione alla volta da export aggregato per squadra/competizione. |
| Serie A 2022/23–2024/25 | 159 righe, copertura statistica parziale | Completare soltanto i campi restituiti dalla stessa fonte, mantenendo `NULL` per assist o metriche non pubblicate. |
| Serie A 2025/26 | zero `PlayerSeason` | Cercare un export a fine stagione o verificare la coverage API prima di proporre import. |
| Coppe/Europa | righe assenti o non omogenee | Tenere il perimetro separato dal campionato; non sommare coppe alle metriche di lega. |

Campi candidati `player_seasons`: `player_name`, `season`, `competition`, `appearances`, `starts`, `minutes`, `goals`, `assists`, `yellow_cards`, `red_cards`, `clean_sheets`, `rating`, `shirt_number`, `position`, `shots_total`, `shots_on`, `passes_key`, `tackles_total`, `source_url`, `source_provider`, `last_verified_at`.

## Priorità P1 — classifiche e statistiche squadra

| Entità | Copertura attuale | Perimetro mancante |
| --- | --- | --- |
| `season_standings` | complete: Serie A 2022/23, Serie A 2023/24, Serie B 2024/25 | tutte le altre stagioni di lega nell'archivio; una classifica deve contenere tutte le squadre, non le sole gare Sassuolo |
| `team_season_stats` | Serie A 2022/23, Serie A 2023/24, Coppa Italia 2023/24, Serie B 2024/25 | tutte le altre 22 combinazioni stagione/competizione, quando il provider offre valori espliciti |

Campi classifica: `season`, `competition`, `team_name`, `rank`, `points`, `played`, `wins`, `draws`, `losses`, `goals_for`, `goals_against`, `goals_diff`, `form`, `status`, `description`, più breakdown casa/trasferta se presente.

Campi statistiche squadra: `season`, `competition`, `played`, `wins`, `draws`, `losses`, `goals_for`, `goals_against`, medie gol, clean sheet, failed to score, risultati massimi, streak e rigori. Non calcolare né stimare xG o metriche non esposte.

## Priorità P2 — dettaglio partita e metadati

| Dato | Stato attuale | Lacuna esatta |
| --- | --- | --- |
| Dettagli partita | 43/726 match | 683 partite senza `match_details` |
| Eventi, formazioni, statistiche squadra e giocatore | completi solo su 13 match dettagliati | tutte le partite storiche e 30/38 della Serie A 2025/26 senza blocchi avanzati |
| `scorers` / `assists` / `cards` testuali | 714 / 715 / 49 match null | importare solo da match report con URL puntuale |
| xG | 718 match null | lasciare null salvo provider esplicito e compatibile |
| Stadio / presenza / arbitro | 713 / 726 / 726 match null | ricercare da fonti ufficiali o match report; non dedurre |

Per ogni evento candidato: `match_id` o chiave fixture (data + casa + trasferta), `minute`, `extra_minute`, `team_name`, `player_name`, `assist_name`, `type`, `detail`, `comments`, punteggio dopo l'evento, `source_url`, nota e data verifica. I minuti devono essere `0–130`; recupero `0–30`.

## Priorità P3 — anagrafiche, trasferimenti, news

- Giocatori: 166 senza nazionalità, 288 senza data nascita, 145 senza ruolo, 266 senza foto, 107 senza ID API-Football, 258 senza URL fonte. Dare priorità a identità e URL fonte, non alle foto.
- Trasferimenti: 837 record senza URL fonte puntuale. Produrre mapping `transfer_id` o identità logica + `source_url`, data verifica e nota; non creare movimenti duplicati.
- RSS: rimane un gruppo di 3 titoli duplicati. Il Data Manager ora offre anteprima e conferma della deduplica; non serve ricerca esterna per questo punto.

## Fonti consentite e regole

1. **Football-Data**: risultati e aggregati disponibili; non usarlo per xG, eventi, rose o valori assenti.
2. **FBref**: export Standard archiviati localmente, URL fonte, data verifica e checksum obbligatori. Niente scraping non riproducibile.
3. **UEFA**: match report/export per Europa League 2016/17.
4. **Lega Serie A / FIGC**: match report e Coppa Italia quando esiste una pagina ufficiale.
5. **Transfermarkt**: anagrafica e appartenenza rosa; mai dedurre rendimento.
6. **API-Football / Kickoff**: solo dopo controllo coverage e quota; gli ultimi tentativi API-Football hanno ricevuto HTTP 429. Non avviare loop o richieste massive.
7. Fonti manuali: URL, nota curatoriale, autore e data di verifica sono obbligatori per un valore contrassegnato come verificato.

## Formato di consegna obbligatorio

Consegnare una cartella candidata, senza scrivere nel DB:

```text
data/research-candidates/<area>-<season>/
  data.csv o data.json
  manifest.json
  SOURCES.md
```

`manifest.json` deve contenere: area, stagione, competizione, fonte, URL, data verifica, file, SHA-256, record totali, record scartati, ragione di ogni scarto e campi coperti.

Ogni riga deve avere `source_url`; campi sconosciuti devono essere assenti/null. Non accettare `0`, stringhe vuote o valori inventati come sostituti di dato mancante.

## Controlli prima della consegna

1. Non proporre fixture duplicate per giorno + casa + trasferta.
2. Non unire automaticamente giocatori solo per nome se è disponibile un ID provider.
3. Non mischiare campionato, coppa ed Europa.
4. Non proporre eventi con minuto non valido o gol incompatibili con il punteggio.
5. Per classifiche, verificare che la tabella sia completa per competizione.
6. Consegnare un riepilogo di coverage prima/dopo previsto, ma non effettuare import.
7. Il maintainer applicherà l'import in staging, controllerà il diff e lancerà `npm.cmd run data:audit:full`.

## Prompt pronto per l'agente di ricerca

> Ricerca esclusivamente dati riproducibili per Sassuolo History seguendo `data/docs/research/DATA_RESEARCH_BRIEF_2026-08-09.md`. Parti da PlayerSeason Serie B 2012/13 e consegna un pacchetto candidato con export, manifest SHA-256 e fonti puntuali. Non modificare SQLite, non effettuare sync provider, non stimare dati e non convertire valori sconosciuti in zero. Segnala coverage, record scartati, ambiguità di identità e qualunque campo senza fonte.
