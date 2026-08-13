# Compito autonomo — classifica Serie A 2020/21

## Consegna

Genera:

`standings-serie-a-2020-21-resolution.zip`

e salvalo in:

`C:\Users\Coppi\Downloads\standings-serie-a-2020-21-resolution.zip`

Non modificare il progetto o il database.

## Obiettivo

Preparare la classifica finale ufficiale della Serie A 2020/21:

- 20 squadre, 38 partite ciascuna;
- rank sportivo 1–20;
- punti, record e reti;
- campione, Champions League, Europa League, Conference League e retrocessioni;
- penalizzazioni o decisioni amministrative annotate senza alterare il rank.

## Casi obbligatori

1. Posizione e statistiche finali del Sassuolo.
2. **Roma–Sassuolo a pari punti:** criterio dell’ordine ufficiale e conseguenza sul posto in Conference League.
3. **Atalanta–Juventus a pari punti:** ordine ufficiale e criterio.
4. **Torino–Benevento** nella zona salvezza: punti, ordine e criterio se a pari punti.
5. Tutti gli altri gruppi a pari punti.
6. Introduzione/assegnazione del posto italiano nella UEFA Europa Conference League 2021/22.
7. Effetto della Coppa Italia vinta dalla Juventus sui posti UEFA.
8. Retrocessioni ed eventuali provvedimenti amministrativi.

## Fonti

Usare almeno:

- una fonte primaria/autorevole: Lega Serie A, FIGC, UEFA o comunicati ufficiali;
- una fonte statistica completa: RSSSF, WorldFootball, Soccerway o equivalente;
- una fonte probatoria per criteri di pari punti e assegnazione della Conference League.

Wikipedia solo come supporto. Usare URL diretti.

## Struttura ZIP

```text
standings-serie-a-2020-21-resolution/
  data.csv
  discrepancies.csv
  aliases.csv
  manifest.json
  SOURCES.md
  source-files/
    README.md
```

## `data.csv`

CSV UTF-8, separatore virgola:

```csv
season,competition,team_name,rank,points,played,wins,draws,losses,goals_for,goals_against,goals_diff,status,description,source_provider,source_url,last_verified_at
```

Regole:

- `season` sempre `2020/21`, `competition` sempre `Serie A`;
- esattamente 20 righe;
- rank unico 1–20;
- punti ufficiali finali;
- statistiche numeriche intere e complete;
- `status`: valori applicabili separati da `|` tra `champion`, `champions_league`, `europa_league`, `europa_league_qualifying`, `conference_league`, `conference_league_qualifying`, `relegated`, `excluded`, `not_admitted`, `points_deduction`, `none`;
- `description`: titolo, pari punti, posti UEFA, Coppa Italia, penalizzazioni o retrocessioni;
- `source_provider`: fonte principale più controllo incrociato;
- `source_url`: URL diretto;
- `last_verified_at`: data reale `YYYY-MM-DD`.

Non cambiare il rank in base alla successiva partecipazione UEFA.

## `discrepancies.csv`

```csv
team_name,field,source_a_value,source_b_value,source_a_url,source_b_url,resolution,status,notes
```

Registrare conflitti su rank, pari punti, record, reti, penalizzazioni o posti UEFA. Stato `resolved`/`unresolved`; solo intestazione se nessun conflitto.

## `aliases.csv`

```csv
source_name,selected_team_name,source_provider,notes
```

Documentare abbreviazioni e denominazioni differenti.

## Controlli obbligatori

1. 20 righe e rank completi 1–20.
2. 38 partite per squadra.
3. `wins + draws + losses = played`.
4. `goals_for - goals_against = goals_diff`.
5. Somma vittorie = somma sconfitte.
6. Somma gol fatti = somma gol subiti.
7. Somma pareggi pari.
8. `3 × wins + draws = points`, salvo penalizzazioni documentate.
9. Classifica verificata su almeno due fonti.
10. Tutti i pari punti verificati, soprattutto Roma/Sassuolo, Atalanta/Juventus e Torino/Benevento.
11. Posti Champions, Europa e Conference League verificati.
12. Effetto Coppa Italia verificato.
13. Retrocessioni verificate.

## `manifest.json`

```json
{
  "package_type": "season_standings_resolution",
  "area": "season_standings",
  "season": "2020/21",
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
      "tie_breaks_verified": "passed",
      "uefa_qualification_verified": "passed",
      "conference_league_verified": "passed",
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

Usare `conflict_review_required` se resta un conflitto sostanziale e registrarlo in `discrepancies.csv` e `unresolved_conflicts`.

## Documentazione e verifica finale

`SOURCES.md` deve separare classifica, pari punti, Sassuolo, posti UEFA/Conference League, Coppa Italia e retrocessioni. Per ogni fonte: titolo, provider, URL, data e dati verificati.

Se non si includono copie, compilare `source-files/README.md` con URL, titolo, data, dati estratti e motivo.

Prima della consegna: nomi corretti, tutti i file, 20 righe, checksum reale, nessun `TODO`/`UNKNOWN`, quadrature superate e nessun dato alterato artificialmente.
