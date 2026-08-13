# Mandato esterno — PlayerSeason Sassuolo Serie B 2008/09

## Obiettivo unico

Costruire e riconciliare le statistiche dei giocatori dell’U.S. Sassuolo Calcio nella **sola regular season di Serie B 2008/09**.

Non analizzare altre stagioni. Non includere Coppa Italia, playoff, playout o amichevoli. Non modificare database. Non inventare valori e non trasformare campi sconosciuti in zero.

## Stato locale comunicato all’agente

L’agente non vede il progetto. Nel database risultano:

- 42 partite di Serie B 2008/09, tutte concluse;
- 38 nominativi censiti nella rosa;
- 0 nominativi con presenze o statistiche individuali valorizzate;
- nessun candidato statistico 2008/09 già pronto.

I 38 nomi non implicano 38 giocatori impiegati. `data.csv` deve contenere soltanto i calciatori con almeno una presenza documentata. Gli eventuali componenti della rosa a zero presenze vanno in un file separato.

## Perimetro e controlli attesi

- Club: U.S. Sassuolo Calcio
- Stagione: `2008/09`
- Competizione: `Serie B`
- Regular season: 42 partite
- Titolarità attese: `42 × 11 = 462`
- Escludere Coppa Italia e ogni altra competizione
- Verificare esplicitamente se furono disputati playoff o playout e, in ogni caso, escluderli

## Fonti obbligatorie

Estrarre almeno due tabelle indipendenti.

1. **WorldFootball.net** — pagina Player statistics/Appearances del Sassuolo. Selezionare materialmente `Serie B - 2008/2009`; non fidarsi della competizione mostrata dal collegamento iniziale.
2. **StatsCrew** — cercare e aprire la pagina Sassuolo 2008/09. L’URL probabile termina con `/y-2008`, ma deve essere verificato e non assunto.

Fonti supplementari ammesse:

- Lega Serie B, FIGC o archivi ufficiali;
- StatBunker e Soccerway;
- Transfermarkt per identità, rosa e tabellini;
- ESPN, BeSoccer e cronache contemporanee per singoli gol o autogol.

Wikipedia è soltanto un controllo secondario di risultati e totale gol, mai l’unica fonte delle statistiche individuali.

## Consegna obbligatoria

Produrre uno ZIP con questa struttura esatta:

```text
player-season-2008-09-resolution/
  data.csv
  worldfootball.csv
  statscrew.csv
  roster-zero-appearances.csv
  discrepancies.csv
  goal-resolution.csv
  manifest.json
  SOURCES.md
  source-files/
    README.md
    ...eventuali snapshot o export consentiti...
```

Tutti i file devono essere UTF-8 senza BOM. Non consegnare soltanto una relazione: servono i CSV completi.

## `worldfootball.csv`

```csv
player_name,season,competition,appearances,minutes,starts,substitutes_in,substitutes_out,goals,yellow_cards,yellow_red_cards,red_cards,position,source_provider,source_url,last_verified_at
```

Estrarre tutte le righe della tabella `Serie B - 2008/2009`. Separare `yellow_red_cards` e `red_cards`.

## `statscrew.csv`

```csv
player_name,season,competition,appearances,starts,minutes,goals,assists,yellow_cards,red_cards,position,source_provider,source_url,last_verified_at
```

Non compilare campi che StatsCrew non pubblica.

## `data.csv` riconciliato

```csv
player_name,season,competition,appearances,starts,minutes,goals,assists,yellow_cards,yellow_red_cards,red_cards,position,source_provider,source_url,last_verified_at
```

Policy predefinita:

- WorldFootball per presenze, titolarità, minuti, gol, cartellini e posizione;
- StatsCrew per gli assist, quando pubblicati;
- referto ufficiale o fonte puntuale per correggere un singolo evento documentato.

Ogni scelta diversa deve essere spiegata in `discrepancies.csv`. Gli autogol avversari non devono essere attribuiti ai giocatori Sassuolo.

## `roster-zero-appearances.csv`

```csv
player_name,season,competition,roster_status,source_provider,source_url,last_verified_at,note
```

Inserire soltanto giocatori della rosa con zero presenze dimostrate. Un dato non reperito non equivale a zero.

## `discrepancies.csv`

```csv
player_name,field,statscrew_value,worldfootball_value,selected_value,resolution,status,evidence_url,note
```

Confrontare per ogni giocatore:

- identità e grafia del nome;
- presenze e titolarità;
- minuti;
- gol e assist;
- ammonizioni;
- giallo-rossi e rossi diretti;
- posizione.

Stati ammessi: `resolved`, `source_conflict`, `identity_ambiguous`, `unverified`, `source_rejected`.

Aggiungere righe `TEAM` per partite, gol squadra, somma gol giocatori, autogol avversari, titolarità totali ed esclusione delle altre competizioni.

## `goal-resolution.csv`

```csv
date,season,competition,home_team,away_team,home_score,away_score,scoring_team,player_name,event_type,minute,source_provider,source_url,confirmation_url,last_verified_at,note
```

Valori ammessi per `event_type`: `opponent_own_goal`, `player_goal_correction`, `source_error`.

Per ogni differenza fra gol squadra e somma gol giocatori individuare puntualmente partita, data, risultato, autore, squadra dell’autore, minuto se disponibile e URL del tabellino. Preferire due fonti indipendenti. Non risolvere una differenza per semplice deduzione.

## Controlli obbligatori

1. Ogni riga deve avere `season=2008/09` e `competition=Serie B`.
2. Una sola riga per giocatore.
3. `starts <= appearances`.
4. Nessun numero negativo.
5. Somma titolarità pari a 462 oppure conflitto documentato.
6. Somma gol giocatori confrontata con i gol squadra delle 42 gare.
7. Ogni scarto sui gol spiegato con evidenza puntuale.
8. Giallo-rossi e rossi diretti separati.
9. Assist importati soltanto da una fonte che li pubblica.
10. Controllare accenti, alias, omonimi e trasferimenti di gennaio.
11. Campi non verificabili lasciati vuoti.
12. Ogni riga con provider, URL esatto e data verifica.
13. Coppa Italia, playoff, playout e amichevoli esclusi.
14. Tutti i checksum SHA-256 ricalcolati sui file finali.

## Questioni da risolvere nella risposta

1. Quanti giocatori disputarono almeno una gara di Serie B 2008/09?
2. Quale fu il totale dei gol squadra?
3. Quanti gol sono attribuiti ai giocatori Sassuolo?
4. Quali autogol avversari risultano a favore del Sassuolo?
5. WorldFootball e StatsCrew concordano su presenze, titolarità e gol?
6. Quali differenze esistono su minuti e disciplina?
7. Quali dei 38 nominativi locali risultano a zero presenze?
8. Il Sassuolo disputò playoff o playout?
9. Quali identità restano ambigue?
10. Quali campi devono restare vuoti?

## `manifest.json`

```json
{
  "area": "player_seasons",
  "season": "2008/09",
  "competition": "Serie B",
  "source_provider": "WorldFootball.net + StatsCrew",
  "source_url": "URL WorldFootball verificato",
  "verified_at": "YYYY-MM-DD",
  "file": "data.csv",
  "sha256": "SHA-256 esatto di data.csv",
  "records_total": 0,
  "records_discarded": 0,
  "discard_reasons": [],
  "fields_covered": [],
  "validation": {
    "status": "candidate",
    "checks": [
      {"name":"worldfootball_complete_extract","status":"passed","note":""},
      {"name":"statscrew_complete_extract","status":"passed","note":""},
      {"name":"field_by_field_comparison","status":"passed","note":""},
      {"name":"player_goals_sum","status":"passed","note":""},
      {"name":"team_goals_cross_check","status":"passed","note":""},
      {"name":"own_goals_reconciled","status":"passed","note":""},
      {"name":"starts_total","status":"passed","note":""},
      {"name":"identities_reviewed","status":"passed","note":""}
    ],
    "unresolved_conflicts": []
  },
  "field_source_policy": {
    "worldfootball": [],
    "statscrew": [],
    "official_match_reports": []
  },
  "related_files": {
    "worldfootball_csv_sha256": "",
    "statscrew_csv_sha256": "",
    "roster_zero_appearances_csv_sha256": "",
    "discrepancies_csv_sha256": "",
    "goal_resolution_csv_sha256": ""
  },
  "notes": []
}
```

Usare `validation.status=reconciled` soltanto se entrambe le tabelle sono complete, tutte le differenze sono documentate, i gol sono riconciliati, le identità sono controllate e non rimangono conflitti critici. Altrimenti usare `candidate` o `conflict_review_required`.

## Riepilogo da allegare allo ZIP

Indicare:

- URL esatti delle fonti;
- numero di righe per ciascun CSV;
- totali per fonte di presenze, titolarità, minuti, gol e cartellini;
- totale gol squadra;
- autogol e correzioni documentati;
- giocatori a zero presenze;
- discrepanze risolte e ancora aperte;
- identità ambigue;
- checksum SHA-256 di tutti i CSV;
- stato finale del manifest;
- campi rimasti vuoti e relativa motivazione.

Non procedere ad altri workstream prima della revisione di questo pacchetto.
