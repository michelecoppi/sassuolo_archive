# Mandato esterno — PlayerSeason Sassuolo Serie B 2010/11

## Obiettivo unico

Costruire e riconciliare le statistiche dei giocatori dell'U.S. Sassuolo Calcio nella sola regular season di `Serie B 2010/11`.

Non procedere ad altre stagioni. Non includere Coppa Italia, playoff o amichevoli. Non modificare database, non inventare valori e non convertire dati sconosciuti in zero.

## Stato attuale del progetto

- 42 partite di campionato già presenti e concluse;
- 41 nominativi PlayerSeason provenienti da un censimento rosa;
- 0/41 con presenze valorizzate;
- nessuna statistica individuale verificata;
- nessun URL fonte puntuale sulle 41 righe;
- nessun candidato statistico 2010/11 già registrato.

Il numero 41 descrive una rosa censita, non implica che tutti abbiano giocato. Il nuovo `data.csv` deve contenere i giocatori per i quali una fonte statistica pubblica almeno una presenza. I giocatori a zero presenze vanno in un file separato, se verificabili.

## Fonti da acquisire

Ricercare almeno due fonti indipendenti:

1. **WorldFootball.net**, pagina “Sassuolo Calcio — Player statistics/Appearances — Serie B 2010/2011”. La competizione selezionata deve essere esattamente `Serie B - 2010/2011`, non Coppa Italia o playoff.
2. **StatsCrew**, probabile pagina Sassuolo 2010/11: verificare l'URL e non assumerlo senza aprirlo.

Fonti aggiuntive consigliate:

- Lega Serie B/FIGC o archivio ufficiale;
- StatBunker;
- Soccerway;
- Transfermarkt solo per identità e rosa;
- referti partita puntuali per gol/autogol controversi.

Wikipedia può essere usata per controllare la matrice dei 42 risultati e il totale gol squadra, ma non come unica fonte delle statistiche individuali.

## Requisito fondamentale

Non limitarsi a descrivere le pagine. Estrarre entrambe le tabelle complete disponibili e consegnarle come file distinti. Se una fonte è bloccata, dichiararlo e consegnare il pacchetto come `conflict_review_required`, non `reconciled`.

## File da consegnare

```text
player-season-2010-11-resolution/
  data.csv
  worldfootball.csv
  statscrew.csv
  roster-zero-appearances.csv
  discrepancies.csv
  manifest.json
  SOURCES.md
  source-files/
    README.md
    ...eventuali export, PDF o snapshot consentiti...
```

## `worldfootball.csv`

```csv
player_name,season,competition,appearances,minutes,starts,substitutes_in,substitutes_out,goals,yellow_cards,yellow_red_cards,red_cards,position,source_provider,source_url,last_verified_at
```

Tutte le righe visibili nella tabella WorldFootball devono essere incluse. Conservare separatamente `yellow_red_cards` e `red_cards`.

## `statscrew.csv`

```csv
player_name,season,competition,appearances,starts,minutes,goals,assists,yellow_cards,red_cards,position,source_provider,source_url,last_verified_at
```

Non riempire campi che StatsCrew non pubblica.

## `data.csv` riconciliato

```csv
player_name,season,competition,appearances,starts,minutes,goals,assists,yellow_cards,yellow_red_cards,red_cards,position,source_provider,source_url,last_verified_at
```

Policy consigliata, salvo prova contraria documentata:

- WorldFootball per presenze, titolarità, minuti, gol, cartellini e posizione;
- StatsCrew per gli assist, se WorldFootball non li pubblica;
- fonte ufficiale/referto puntuale prevale su entrambe per una correzione specifica.

Ogni scelta diversa deve essere motivata in `discrepancies.csv`.

`source_provider` può essere `WorldFootball.net + StatsCrew` quando la riga combina i due dataset. In `SOURCES.md` indicare chiaramente quali campi provengono da quale fonte.

## `roster-zero-appearances.csv`

```csv
player_name,season,competition,roster_status,source_provider,source_url,last_verified_at,note
```

Inserire soltanto giocatori appartenenti alla rosa 2010/11 ma con zero presenze documentate. Non inserirli in `data.csv`, perché zero presenze di rosa e dato statistico mancante non sono equivalenti.

## `discrepancies.csv`

```csv
player_name,field,statscrew_value,worldfootball_value,selected_value,resolution,status,evidence_url,note
```

Confrontare per tutti i giocatori:

- identità/nome;
- presenze;
- titolarità;
- minuti;
- gol;
- gialli;
- giallo-rossi;
- rossi;
- posizione.

Stati ammessi:

- `resolved`;
- `source_conflict`;
- `identity_ambiguous`;
- `unverified`;
- `source_rejected`.

Inserire inoltre righe `TEAM` per:

- partite regular season;
- gol squadra;
- somma gol giocatori;
- autogol avversari;
- titolarità totali;
- esclusione Coppa Italia;
- esclusione playoff, se il Sassuolo li disputò.

## Controlli obbligatori

1. Tutte le righe devono avere `season=2010/11` e `competition=Serie B`.
2. Una sola riga per giocatore.
3. `starts <= appearances`.
4. Nessun valore negativo.
5. Somma titolarità attesa: `42 × 11 = 462`, salvo differenza documentata della fonte.
6. Somma gol giocatori confrontata con il totale gol squadra.
7. Ogni autogol avversario identificato con partita, data, minuto e URL puntuale.
8. Gli autogol avversari non vanno attribuiti a giocatori Sassuolo.
9. Separare giallo-rossi e rossi diretti.
10. Non importare assist da una fonte che non li pubblica.
11. Verificare grafie alternative e omonimie.
12. I campi sconosciuti restano vuoti.
13. Tutti i CSV devono essere UTF-8 e correttamente quotati.
14. Ogni riga deve avere fonte e URL.

## Domande da risolvere

1. Quanti giocatori disputarono almeno una partita di Serie B 2010/11?
2. Qual è il totale corretto dei gol squadra?
3. Quanti gol sono attribuiti ai giocatori Sassuolo?
4. Esistono autogol avversari a favore del Sassuolo?
5. WorldFootball e StatsCrew concordano su presenze e gol?
6. Quali differenze esistono su minuti e cartellini?
7. Quali dei 41 nominativi della rosa non disputarono alcuna partita?
8. Il Sassuolo disputò playoff? Se sì, confermare che siano esclusi.
9. Quali campi restano non verificabili?

## `manifest.json`

```json
{
  "area": "player_seasons",
  "season": "2010/11",
  "competition": "Serie B",
  "source_provider": "WorldFootball.net + StatsCrew",
  "source_url": "URL WorldFootball",
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
    "discrepancies_csv_sha256": "",
    "roster_zero_appearances_csv_sha256": ""
  },
  "notes": []
}
```

Usare `validation.status=reconciled` solamente se entrambe le tabelle sono complete, tutte le differenze sono elencate, le identità sono controllate e non restano conflitti critici. Altrimenti usare `candidate` o `conflict_review_required`.

## Risposta finale richiesta

Insieme allo ZIP indicare:

- URL esatti delle fonti;
- righe WorldFootball, StatsCrew e finali;
- giocatori a zero presenze;
- totali di presenze, titolarità, minuti, gol e cartellini per fonte;
- autogol documentati;
- numero di differenze rilevate e risolte;
- conflitti ancora aperti;
- checksum di tutti i CSV;
- stato finale del manifest.

Non passare al 2009/10 prima della revisione di questo pacchetto.
