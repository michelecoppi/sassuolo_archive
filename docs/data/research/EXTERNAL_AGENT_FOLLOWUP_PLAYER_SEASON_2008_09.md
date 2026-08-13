# Integrazione obbligatoria — PlayerSeason Sassuolo Serie B 2008/09

## Non ricostruire il pacchetto completo

Il pacchetto ricevuto è stato verificato. StatsCrew è completo rispetto alla propria pagina e la tabella WorldFootball è stata recuperata manualmente selezionando `Serie B - 2008/2009`.

WorldFootball contiene 24 giocatori; StatsCrew ne contiene 25 perché aggiunge Alberto Pomini con 1 presenza, 0 titolarità e 90 minuti.

Le due fonti concordano sui problemi fondamentali:

```text
partite Sassuolo nella regular season: 42
titolarità attese: 42 × 11 = 462
titolarità pubblicate: 440 = 40 × 11
gol squadra: 57
gol attribuiti ai giocatori Sassuolo: 55
differenza gol: 2
```

Il pacchetto resta `conflict_review_required` e non è importabile. Non modificare `data.csv` senza evidenze puntuali.

## Obiettivo unico del follow-up

Risolvere con tabellini e referti puntuali:

1. quali sono le **due partite di Serie B 2008/09 non coperte** dalle statistiche individuali WorldFootball/StatsCrew;
2. quali furono le formazioni titolari del Sassuolo in quelle due partite;
3. quali sono i **due gol squadra non attribuiti** ai giocatori Sassuolo.

È possibile che i due problemi siano collegati, ma non va assunto per deduzione.

## Parte A — individuare le due partite mancanti

Esaminare tutte le 42 gare della regular season e costruire una matrice di copertura. Per ogni partita verificare se esiste un tabellino con gli undici titolari del Sassuolo.

Consegna `match-coverage.csv`:

```csv
date,season,competition,home_team,away_team,home_score,away_score,sassuolo_lineup_found,lineup_players_count,source_provider,source_url,confirmation_url,last_verified_at,note
```

Requisiti:

- esattamente 42 righe;
- `season=2008/09`, `competition=Serie B`;
- indicare `sassuolo_lineup_found=yes/no`;
- contare i titolari realmente elencati;
- evidenziare le due gare presumibilmente escluse dalle tabelle aggregate;
- non includere Coppa Italia.

Per le due gare mancanti, consegnare anche `missing-lineups.csv`:

```csv
date,home_team,away_team,player_name,lineup_status,shirt_number,source_provider,source_url,confirmation_url,last_verified_at,note
```

`lineup_status` deve essere `starter`. Servono 11 righe per partita, quindi 22 righe totali, salvo impossibilità documentata.

## Parte B — riconciliare i 57 gol

Costruire l’elenco completo dei gol del Sassuolo nelle 42 partite oppure, come minimo, individuare con certezza i due gol mancanti.

Consegna `goal-resolution.csv`:

```csv
date,season,competition,home_team,away_team,home_score,away_score,scoring_team,player_name,player_team,event_type,minute,source_provider,source_url,confirmation_url,last_verified_at,note
```

Valori ammessi per `event_type`:

- `opponent_own_goal`;
- `player_goal_correction`;
- `source_error`.

Per ciascuno dei due gol servono:

- partita e data;
- risultato;
- autore;
- squadra dell’autore;
- minuto, se pubblicato;
- URL puntuale del referto o tabellino;
- preferibilmente una seconda fonte indipendente.

Non dichiarare due autogol solo perché `57 - 55 = 2`. Ogni evento deve essere provato.

## Parte C — Alberto Pomini

StatsCrew registra:

```text
Alberto Pomini — 1 presenza, 0 titolarità, 90 minuti
```

WorldFootball non lo include nella tabella Serie B 2008/09. Verificare:

1. in quale partita avrebbe giocato;
2. se fu titolare o subentrato;
3. come può avere 90 minuti con 0 titolarità;
4. se la presenza appartiene davvero alla Serie B o a un’altra competizione;
5. quale portiere o giocatore sostituì.

Consegna `pomini-resolution.csv`:

```csv
player_name,date,competition,home_team,away_team,appearance,starter,minutes,source_provider,source_url,confirmation_url,last_verified_at,resolution,note
```

Se non si trova una fonte puntuale, mantenere lo stato `unverified` e non correggere per supposizione.

## Fonti prioritarie

1. Lega Serie B/FIGC o copie su Internet Archive;
2. archivio ufficiale Sassuolo o avversario;
3. La Gazzetta dello Sport/Repubblica/quotidiani contemporanei con tabellino;
4. Transfermarkt match report;
5. ESPN, Soccerway, BeSoccer, WorldFootball;
6. archivi statistici come RSSSF solo come controllo di risultati.

Wikipedia non è sufficiente come unica fonte per formazione, autore di un gol o autogol.

## Controllo aggiuntivo sui nomi

Verificare le grafie esatte e segnalare alias. In particolare non creare nuovi giocatori soltanto per differenze di accenti, iniziali o ordine nome/cognome.

## Struttura ZIP richiesta

```text
player-season-2008-09-followup/
  match-coverage.csv
  missing-lineups.csv
  goal-resolution.csv
  pomini-resolution.csv
  SOURCES.md
  manifest.json
  source-files/
    README.md
```

## Manifest minimo

```json
{
  "area": "player_seasons_followup",
  "season": "2008/09",
  "competition": "Serie B",
  "validation": {
    "status": "conflict_review_required",
    "checks": [
      {"name":"42_match_coverage_reviewed","status":"failed","note":""},
      {"name":"two_missing_lineups_identified","status":"failed","note":""},
      {"name":"starts_gap_explained","status":"failed","note":""},
      {"name":"two_missing_goals_identified","status":"failed","note":""},
      {"name":"pomini_appearance_resolved","status":"failed","note":""}
    ],
    "unresolved_conflicts": []
  }
}
```

Impostare `validation.status=reconciled` solamente se le due partite, le 22 titolarità mancanti, i due gol e il caso Pomini sono tutti risolti con fonti puntuali. Se uno di questi punti resta aperto, mantenere `conflict_review_required` e descriverlo chiaramente.

## Risposta finale richiesta

Insieme allo ZIP indicare:

- nomi e date delle due partite mancanti;
- 11 titolari Sassuolo per ciascuna;
- spiegazione numerica di `440 + 22 = 462`;
- identità dei due gol mancanti con URL;
- esito del caso Alberto Pomini;
- eventuali altri errori scoperti nelle tabelle aggregate;
- conflitti ancora aperti.

Non procedere ad altri workstream.
