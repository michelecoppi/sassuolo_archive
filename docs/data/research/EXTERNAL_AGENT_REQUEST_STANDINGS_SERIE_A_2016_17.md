# Compito autonomo — classifica Serie A 2016/17

## Consegna

Genera:

`standings-serie-a-2016-17-resolution.zip`

e salvalo in:

`C:\Users\Coppi\Downloads\standings-serie-a-2016-17-resolution.zip`

Non modificare il database o il progetto. Il pacchetto sarà revisionato prima dell’importazione.

## Obiettivo

Ricostruire la classifica finale ufficiale di Serie A 2016/17:

- 20 squadre;
- 38 partite ciascuna;
- rank sportivo 1–20;
- punti, vittorie, pareggi, sconfitte e reti;
- campione, qualificazioni UEFA e retrocessioni;
- eventuali penalizzazioni o provvedimenti amministrativi.

## Verifiche specifiche

1. Posizione e statistiche finali del Sassuolo nella stagione in cui disputò anche l’Europa League.
2. Quali squadre ottennero Champions League diretta e preliminari/qualificazioni.
3. Quali squadre ottennero Europa League diretta o turni preliminari.
4. Effetto della Coppa Italia sull’assegnazione dei posti europei, senza cambiare il rank sportivo.
5. Ordine ufficiale delle squadre a pari punti.
6. Retrocessioni ed eventuali decisioni amministrative successive.

## Fonti minime

Usare almeno:

- una fonte primaria/autorevole: Lega Serie A, FIGC, UEFA o comunicati ufficiali;
- una fonte statistica completa: RSSSF, WorldFootball, Soccerway, calcio-seriea.net o equivalente;
- una fonte probatoria per l’assegnazione dei posti UEFA quando non deriva semplicemente dal rank.

Wikipedia può essere usata solo come controllo supplementare. Riportare URL diretti.

## Struttura dello ZIP

```text
standings-serie-a-2016-17-resolution/
  data.csv
  discrepancies.csv
  aliases.csv
  manifest.json
  SOURCES.md
  source-files/
    README.md
```

## `data.csv`

CSV UTF-8 con separatore virgola e intestazione esatta:

```csv
season,competition,team_name,rank,points,played,wins,draws,losses,goals_for,goals_against,goals_diff,status,description,source_provider,source_url,last_verified_at
```

Regole:

- `season` sempre `2016/17`;
- `competition` sempre `Serie A`;
- esattamente 20 righe;
- `rank` unico da 1 a 20;
- punti ufficiali dopo eventuali penalizzazioni;
- statistiche numeriche intere e non vuote;
- `status`: valori applicabili separati da `|` tra `champion`, `champions_league`, `champions_league_qualifying`, `europa_league`, `europa_league_qualifying`, `relegated`, `excluded`, `not_admitted`, `points_deduction`, `none`;
- `description`: titolo, qualificazioni UEFA, effetto Coppa Italia, penalizzazioni o retrocessioni;
- `source_provider`: fonte principale e controllo incrociato;
- `source_url`: URL diretto;
- `last_verified_at`: data reale `YYYY-MM-DD`.

Non riordinare la classifica in base alla successiva partecipazione europea.

## `discrepancies.csv`

```csv
team_name,field,source_a_value,source_b_value,source_a_url,source_b_url,resolution,status,notes
```

Registrare ogni conflitto su rank, punti, record, reti, qualificazioni o penalizzazioni. Stato `resolved` o `unresolved`. Se non ci sono conflitti, lasciare solo l’intestazione.

## `aliases.csv`

```csv
source_name,selected_team_name,source_provider,notes
```

Documentare abbreviazioni e denominazioni differenti senza confondere club distinti.

## Controlli obbligatori

1. 20 righe.
2. Rank unici e completi 1–20.
3. 38 partite per squadra.
4. `wins + draws + losses = played`.
5. `goals_for - goals_against = goals_diff`.
6. Somma vittorie = somma sconfitte.
7. Somma gol fatti = somma gol subiti.
8. Somma pareggi pari.
9. `3 × wins + draws = points`, salvo penalizzazioni documentate.
10. Classifica verificata su almeno due fonti.
11. Posti UEFA e relativi turni verificati.
12. Effetto della Coppa Italia verificato.
13. Retrocessioni verificate.

## `manifest.json`

```json
{
  "package_type": "season_standings_resolution",
  "area": "season_standings",
  "season": "2016/17",
  "competition": "Serie A",
  "source_provider": "FONTE PRINCIPALE + CONTROLLO INCROCIATO",
  "source_url": "URL DIRETTO",
  "row_count": 20,
  "records_total": 20,
  "records_discarded": 0,
  "validation": {
    "status": "reconciled",
    "checks": {
      "row_count": "passed",
      "rank_sequence": "passed",
      "played_per_team": "passed",
      "record_identity": "passed",
      "goal_difference_identity": "passed",
      "league_win_loss_balance": "passed",
      "league_goal_balance": "passed",
      "draw_balance": "passed",
      "points_reconciliation": "passed",
      "source_crosscheck": "passed",
      "uefa_qualification_verified": "passed",
      "coppa_italia_effect_verified": "passed",
      "administrative_outcomes": "passed"
    },
    "unresolved_conflicts": []
  },
  "files": {
    "data.csv": { "sha256": "SHA256_REALE" }
  }
}
```

Se resta un conflitto sostanziale, usare `conflict_review_required` e registrarlo in `discrepancies.csv` e `unresolved_conflicts`.

## Documentazione

`SOURCES.md` deve riportare titolo, provider, URL, data di accesso e campi verificati. Separare classifica, qualificazioni UEFA, Coppa Italia, Sassuolo, penalizzazioni e retrocessioni.

Se non si includono copie delle fonti, `source-files/README.md` deve elencare URL, titolo, data, dati estratti e motivo della mancata inclusione.

## Controllo finale

- nomi ZIP e cartella corretti;
- tutti i file presenti;
- 20 righe;
- checksum reale;
- nessun `TODO`, `UNKNOWN` o URL generico;
- quadrature realmente superate;
- nessun valore alterato artificialmente.
