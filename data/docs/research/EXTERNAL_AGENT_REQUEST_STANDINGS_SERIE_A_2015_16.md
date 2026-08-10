# Compito autonomo — classifica Serie A 2015/16

## Consegna richiesta

Genera lo ZIP:

`standings-serie-a-2015-16-resolution.zip`

e salvalo in:

`C:\Users\Coppi\Downloads\standings-serie-a-2015-16-resolution.zip`

Non modificare il progetto o il database. Lo ZIP sarà revisionato prima dell’importazione.

## Obiettivo

Produrre la classifica finale ufficiale della Serie A 2015/16:

- 20 squadre;
- 38 partite per squadra;
- posizioni sportive 1–20;
- punti, record e reti completi;
- titolo, qualificazioni UEFA e retrocessioni;
- penalizzazioni o decisioni amministrative, se presenti.

## Caso Sassuolo da documentare

Verificare con fonti affidabili:

1. posizione e statistiche finali del Sassuolo;
2. prima qualificazione europea della sua storia;
3. turno/competizione UEFA ottenuto;
4. perché il posto europeo arrivò al Sassuolo, includendo il rapporto tra classifica e finale di Coppa Italia Juventus–Milan;
5. mantenere il rank sportivo invariato e descrivere il meccanismo in `description`.

## Fonti minime

Usare almeno:

- una fonte primaria/autorevole: Lega Serie A, FIGC, UEFA o comunicati ufficiali;
- una fonte statistica completa: RSSSF, WorldFootball, Soccerway, calcio-seriea.net o equivalente;
- una fonte probatoria specifica per la qualificazione europea del Sassuolo.

Wikipedia può essere solo una fonte supplementare. Fornire URL diretti, non homepage o risultati di ricerca.

## Struttura interna dello ZIP

```text
standings-serie-a-2015-16-resolution/
  data.csv
  discrepancies.csv
  aliases.csv
  manifest.json
  SOURCES.md
  source-files/
    README.md
```

## `data.csv`

CSV UTF-8, virgola come separatore, intestazione esatta:

```csv
season,competition,team_name,rank,points,played,wins,draws,losses,goals_for,goals_against,goals_diff,status,description,source_provider,source_url,last_verified_at
```

Regole:

- `season` sempre `2015/16`;
- `competition` sempre `Serie A`;
- esattamente 20 righe;
- `rank` intero unico 1–20;
- `points` sono i punti ufficiali finali;
- statistiche numeriche intere e non vuote;
- `status`: valori applicabili separati da `|` tra `champion`, `champions_league`, `champions_league_qualifying`, `europa_league`, `europa_league_qualifying`, `relegated`, `excluded`, `not_admitted`, `points_deduction`, `none`;
- `description`: titolo, qualificazione UEFA, meccanismo Coppa Italia/Sassuolo, penalizzazioni e retrocessioni;
- `source_provider`: fonte principale più controllo incrociato;
- `source_url`: URL diretto;
- `last_verified_at`: data reale `YYYY-MM-DD`.

## `discrepancies.csv`

```csv
team_name,field,source_a_value,source_b_value,source_a_url,source_b_url,resolution,status,notes
```

Registrare ogni divergenza su rank, punti, record, reti, qualificazioni o penalizzazioni. Usare `resolved` o `unresolved`. Se non ci sono conflitti, lasciare solo l’intestazione.

## `aliases.csv`

```csv
source_name,selected_team_name,source_provider,notes
```

Documentare abbreviazioni e denominazioni diverse senza confondere club distinti.

## Controlli obbligatori

1. 20 righe.
2. Rank completi e unici 1–20.
3. 38 partite per squadra.
4. `wins + draws + losses = played`.
5. `goals_for - goals_against = goals_diff`.
6. Somma vittorie = somma sconfitte.
7. Somma gol fatti = somma gol subiti.
8. Somma pareggi pari.
9. `3 × wins + draws = points`, salvo penalizzazioni documentate.
10. Classifica verificata su almeno due fonti.
11. Qualificazioni UEFA verificate.
12. Qualificazione Sassuolo e ruolo della Coppa Italia verificati con fonte probatoria.
13. Retrocessioni verificate.

## `manifest.json`

```json
{
  "package_type": "season_standings_resolution",
  "area": "season_standings",
  "season": "2015/16",
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
      "sassuolo_europe_verified": "passed",
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

`SOURCES.md` deve indicare titolo, provider, URL diretto, data di accesso e dati verificati. Creare sezioni per classifica, titolo, posti UEFA, qualificazione Sassuolo/Coppa Italia, penalizzazioni e retrocessioni.

Se non si includono copie delle pagine, `source-files/README.md` deve elencare URL, titolo, data, dati estratti e motivo della mancata inclusione.

## Verifica finale

- ZIP e cartella interna con nomi corretti;
- tutti i file presenti;
- 20 righe dati;
- checksum SHA-256 reale;
- nessun `TODO`, `UNKNOWN` o URL generico;
- quadrature realmente superate;
- nessun dato alterato artificialmente.
