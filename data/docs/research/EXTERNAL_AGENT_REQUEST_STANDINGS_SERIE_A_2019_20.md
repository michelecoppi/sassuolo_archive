# Compito autonomo — classifica Serie A 2019/20

## Consegna

Genera:

`standings-serie-a-2019-20-resolution.zip`

e salvalo in:

`C:\Users\Coppi\Downloads\standings-serie-a-2019-20-resolution.zip`

Non modificare il progetto o il database.

## Obiettivo

Preparare la classifica finale ufficiale della Serie A 2019/20:

- 20 squadre e 38 partite ciascuna;
- rank sportivo 1–20;
- punti, record e reti;
- titolo, qualificazioni UEFA, retrocessioni e penalizzazioni;
- annotazione del contesto COVID-19 senza confondere sospensione/ripresa con il risultato finale.

## Verifiche specifiche

1. Posizione e statistiche del Sassuolo.
2. Pari punti **Atalanta–Lazio** e criterio dell’ordine ufficiale.
3. Tutti gli altri gruppi a pari punti, soprattutto nella parte centrale.
4. Prime quattro qualificate in Champions League.
5. Posti Europa League diretti e preliminari.
6. Effetto della vittoria del Napoli in Coppa Italia sui posti europei, mantenendo il rank sportivo.
7. Sospensione e completamento della stagione per COVID-19: breve nota documentata in `SOURCES.md`, senza modificare statistiche o rank.
8. Retrocessioni ed eventuali decisioni amministrative.

## Fonti

Usare almeno:

- una fonte primaria/autorevole: Lega Serie A, FIGC, UEFA o comunicati ufficiali;
- una fonte statistica completa: RSSSF, WorldFootball, Soccerway o equivalente;
- una fonte probatoria per posti UEFA/Coppa Italia e una per sospensione-ripresa COVID-19.

Wikipedia solo come supporto. Usare URL diretti.

## Struttura ZIP

```text
standings-serie-a-2019-20-resolution/
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

- `season` sempre `2019/20`, `competition` sempre `Serie A`;
- 20 righe;
- rank unico 1–20;
- punti ufficiali finali;
- statistiche numeriche intere e complete;
- `status`: valori applicabili separati da `|` tra `champion`, `champions_league`, `europa_league`, `europa_league_qualifying`, `relegated`, `excluded`, `not_admitted`, `points_deduction`, `none`;
- `description`: titolo, pari punti, posti UEFA, Coppa Italia, penalizzazioni o retrocessioni;
- `source_provider`: fonte principale più controllo incrociato;
- `source_url`: URL diretto;
- `last_verified_at`: data reale `YYYY-MM-DD`.

Il contesto COVID generale va soprattutto in `SOURCES.md`, non ripetuto su tutte le righe.

## `discrepancies.csv`

```csv
team_name,field,source_a_value,source_b_value,source_a_url,source_b_url,resolution,status,notes
```

Registrare conflitti su rank, pari punti, statistiche, penalizzazioni o posti UEFA. Stato `resolved` o `unresolved`; solo intestazione se non esistono conflitti.

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
10. Tutti i pari punti verificati.
11. Posti UEFA e Coppa Italia verificati.
12. Sospensione/ripresa COVID verificata.
13. Retrocessioni verificate.

## `manifest.json`

```json
{
  "package_type": "season_standings_resolution",
  "area": "season_standings",
  "season": "2019/20",
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
      "coppa_italia_effect_verified": "passed",
      "covid_completion_verified": "passed",
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

`SOURCES.md` deve separare classifica, pari punti, Sassuolo, UEFA/Coppa Italia, COVID-19 e retrocessioni. Per ogni fonte: titolo, provider, URL, data e dati verificati.

Se non si includono copie, compilare `source-files/README.md` con URL, titolo, data, dati estratti e motivo.

Prima della consegna: nomi corretti, tutti i file, 20 righe, checksum reale, nessun `TODO`/`UNKNOWN`, quadrature superate e nessun valore alterato artificialmente.
