# Mandato esterno — PlayerSeason Sassuolo Serie B 2009/10

## Obiettivo unico

Costruire un pacchetto completo e verificabile delle statistiche dei giocatori dell’U.S. Sassuolo Calcio nella **sola regular season di Serie B 2009/10**.

Non analizzare altre stagioni. Non includere Coppa Italia, playoff, playout o amichevoli. Non modificare alcun database. Non inventare valori e non trasformare dati mancanti in zero.

## Contesto del progetto

L’agente non ha accesso al codice. Deve sapere soltanto che nel database locale risultano:

- 42 partite di Serie B 2009/10, tutte concluse;
- 36 nominativi associati alla rosa;
- 0 nominativi con presenze o statistiche individuali valorizzate;
- nessun candidato PlayerSeason 2009/10 già pronto.

I 36 nominativi rappresentano un censimento della rosa, non la prova che tutti abbiano giocato. `data.csv` deve contenere esclusivamente giocatori con almeno una presenza documentata. Gli eventuali componenti della rosa con zero presenze vanno separati.

## Perimetro

- Club: U.S. Sassuolo Calcio
- Stagione: `2009/10`
- Competizione: `Serie B`
- Partite attese: `42`
- Titolarità totali attese: `42 × 11 = 462`
- Escludere ogni altra competizione e le eventuali fasi successive alla regular season.

## Fonti da consultare

Acquisire almeno due fonti indipendenti e aprire materialmente ogni pagina citata.

1. **WorldFootball.net**: pagina “Sassuolo Calcio — Player statistics/Appearances — Serie B 2009/2010”. Usare il selettore e verificare che la competizione visualizzata sia esattamente `Serie B - 2009/2010`; il link diretto può aprire una stagione o competizione diversa.
2. **StatsCrew**: cercare e verificare la pagina Sassuolo 2009/10. L’URL probabile termina con `/y-2009`, ma non va assunto corretto senza aprirlo.

Fonti aggiuntive consigliate:

- Lega Serie B o FIGC e archivi ufficiali;
- StatBunker;
- Soccerway;
- Transfermarkt per identità, rosa e tabellini puntuali;
- ESPN, BeSoccer e cronache giornalistiche contemporanee per gol o autogol controversi.

Wikipedia può servire soltanto come controllo secondario di risultati e totale gol squadra, mai come unica fonte delle statistiche individuali.

## Requisito fondamentale

Non consegnare una semplice relazione. Estrarre le tabelle complete delle fonti e produrre i CSV richiesti. Se una fonte non è accessibile, dichiararlo e usare `validation.status=conflict_review_required`; non dichiarare il pacchetto `reconciled`.

## Struttura dello ZIP da consegnare

```text
player-season-2009-10-resolution/
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
    ...eventuali snapshot, PDF o export consentiti...
```

Non inserire cartelle annidate inutili. Tutti i file devono essere UTF-8 senza BOM.

## `worldfootball.csv`

```csv
player_name,season,competition,appearances,minutes,starts,substitutes_in,substitutes_out,goals,yellow_cards,yellow_red_cards,red_cards,position,source_provider,source_url,last_verified_at
```

Includere tutte le righe della tabella Serie B 2009/2010. Conservare separatamente espulsioni per doppia ammonizione (`yellow_red_cards`) ed espulsioni dirette (`red_cards`).

## `statscrew.csv`

```csv
player_name,season,competition,appearances,starts,minutes,goals,assists,yellow_cards,red_cards,position,source_provider,source_url,last_verified_at
```

Lasciare vuoti i campi non pubblicati da StatsCrew. Non dedurre minuti, assist o cartellini.

## `data.csv` riconciliato

```csv
player_name,season,competition,appearances,starts,minutes,goals,assists,yellow_cards,yellow_red_cards,red_cards,position,source_provider,source_url,last_verified_at
```

Policy predefinita:

- WorldFootball per presenze, titolarità, minuti, gol, cartellini e posizione;
- StatsCrew per gli assist, se disponibili e non pubblicati da WorldFootball;
- un referto ufficiale o puntuale può correggere un singolo evento, purché la decisione sia documentata.

Ogni eccezione deve comparire in `discrepancies.csv`. Una riga che combina fonti può usare `source_provider=WorldFootball.net + StatsCrew`; `SOURCES.md` deve precisare la provenienza di ogni campo.

## `roster-zero-appearances.csv`

```csv
player_name,season,competition,roster_status,source_provider,source_url,last_verified_at,note
```

Inserire soltanto giocatori appartenenti alla rosa 2009/10 per i quali una fonte dimostri zero presenze in Serie B. Non inserirli in `data.csv`. “Dato statistico non trovato” non equivale a zero presenze.

## `discrepancies.csv`

```csv
player_name,field,statscrew_value,worldfootball_value,selected_value,resolution,status,evidence_url,note
```

Confrontare sistematicamente:

- nome e identità;
- presenze;
- titolarità;
- minuti;
- gol;
- ammonizioni;
- espulsioni per doppia ammonizione;
- espulsioni dirette;
- posizione.

Stati ammessi: `resolved`, `source_conflict`, `identity_ambiguous`, `unverified`, `source_rejected`.

Aggiungere righe `TEAM` per partite, gol squadra, somma gol giocatori, autogol avversari, totale titolarità ed esclusione delle altre competizioni.

## `goal-resolution.csv`

Serve per qualsiasi gol di squadra non attribuito ai giocatori Sassuolo o per correzioni tra fonti.

```csv
date,season,competition,home_team,away_team,home_score,away_score,scoring_team,player_name,event_type,minute,source_provider,source_url,confirmation_url,last_verified_at,note
```

Valori ammessi per `event_type`: `opponent_own_goal`, `player_goal_correction`, `source_error`.

Per ogni autogol servono obbligatoriamente partita, data, risultato, autore, squadra dell’autore, minuto se disponibile e almeno un URL puntuale. È preferibile una seconda fonte indipendente. Gli autogol avversari non devono essere attribuiti ai giocatori Sassuolo in `data.csv`.

## Controlli obbligatori

1. Tutte le righe: `season=2009/10`, `competition=Serie B`.
2. Una sola riga per giocatore in ciascun CSV.
3. `starts <= appearances`.
4. Nessun numero negativo.
5. Somma titolarità pari a 462, oppure conflitto esplicitamente documentato.
6. Somma gol dei giocatori confrontata con il totale dei gol squadra nelle 42 partite.
7. Ogni differenza tra gol squadra e gol giocatori deve essere spiegata con eventi puntuali, non per deduzione.
8. Separare giallo-rossi e rossi diretti.
9. Non importare assist da fonti che non li pubblicano.
10. Controllare accenti, grafie alternative, omonimie e giocatori trasferiti a stagione in corso.
11. I campi sconosciuti restano vuoti, mai `0` per comodità.
12. Ogni riga deve riportare provider, URL effettivo e data di verifica.
13. Il totale giocatori finali deve corrispondere ai giocatori con almeno una presenza, non ai 36 nomi locali.
14. Verificare ed escludere Coppa Italia, playoff e playout.

## Domande da risolvere esplicitamente

1. Quanti giocatori disputarono almeno una partita di Serie B 2009/10?
2. Qual è il totale corretto dei gol segnati dal Sassuolo nelle 42 gare?
3. Quanti gol sono attribuiti ai giocatori Sassuolo?
4. Esistono autogol avversari a favore del Sassuolo? Quali?
5. WorldFootball e StatsCrew concordano su presenze, titolarità e gol?
6. Quali differenze esistono su minuti, cartellini e posizione?
7. Quali dei 36 nominativi della rosa risultano a zero presenze?
8. Il Sassuolo disputò playoff o playout? Se sì, confermare che siano esclusi.
9. Quali identità restano ambigue?
10. Quali campi restano non verificabili e quindi vuoti?

## `manifest.json`

```json
{
  "area": "player_seasons",
  "season": "2009/10",
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

Usare `validation.status=reconciled` soltanto se entrambe le tabelle sono complete, tutte le differenze sono elencate, i gol squadra sono riconciliati, le identità sono controllate e non restano conflitti critici. Negli altri casi usare `candidate` o `conflict_review_required`.

## Risposta finale da allegare allo ZIP

Indicare chiaramente:

- URL esatti di tutte le fonti;
- numero righe WorldFootball, StatsCrew e finali;
- giocatori a zero presenze;
- totali di presenze, titolarità, minuti, gol e cartellini per fonte;
- totale gol squadra e relativa fonte;
- autogol o correzioni documentati;
- numero delle discrepanze rilevate, risolte e ancora aperte;
- checksum SHA-256 di tutti i CSV;
- stato finale del manifest;
- elenco sintetico dei campi rimasti vuoti e perché.

Non procedere alla stagione 2008/09: attendere prima la revisione di questo pacchetto.
