# Compito autonomo — classifica Serie A 2018/19

## Consegna

Genera:

`standings-serie-a-2018-19-resolution.zip`

e salvalo in:

`C:\Users\Coppi\Downloads\standings-serie-a-2018-19-resolution.zip`

Non modificare il progetto o il database.

## Obiettivo

Preparare la classifica finale ufficiale di Serie A 2018/19 con:

- 20 squadre e 38 partite ciascuna;
- rank sportivo 1–20;
- punti, vittorie, pareggi, sconfitte e reti;
- titolo, posti UEFA, retrocessioni e penalizzazioni;
- decisioni UEFA/amministrative successive annotate senza cambiare il rank.

## Casi obbligatori da verificare

1. Posizione e statistiche del Sassuolo.
2. Pari punti **Atalanta–Inter** e relativo ordine ufficiale.
3. Pari punti decisivo **Genoa–Empoli** per la salvezza e criterio applicato.
4. Ogni altro gruppo a pari punti, incluso quello del Sassuolo se presente.
5. Penalizzazione finale del **Chievo**: punti sportivi, detrazione e punti ufficiali.
6. Esclusione del **Milan** dalle competizioni UEFA 2019/20 e conseguente redistribuzione dei posti a Roma e Torino.
7. Effetto della vittoria della Lazio in Coppa Italia sui posti Europa League.
8. Retrocessioni e provvedimenti amministrativi.

## Fonti

Usare almeno:

- una fonte primaria/autorevole: Lega Serie A, FIGC, UEFA, CAS o comunicati ufficiali;
- una fonte statistica completa: RSSSF, WorldFootball, Soccerway o equivalente;
- fonti probatorie specifiche per penalizzazione Chievo, Milan/UEFA e criteri dei pari punti decisivi.

Wikipedia può essere solo supplementare. Usare URL diretti.

## Struttura ZIP

```text
standings-serie-a-2018-19-resolution/
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

- `season` sempre `2018/19`, `competition` sempre `Serie A`;
- 20 righe;
- `rank` unico 1–20;
- punti ufficiali dopo penalizzazioni;
- statistiche numeriche intere e non vuote;
- `status`: valori applicabili separati da `|` tra `champion`, `champions_league`, `europa_league`, `europa_league_qualifying`, `europa_league_denied`, `relegated`, `excluded`, `not_admitted`, `points_deduction`, `none`;
- `description`: titolo, pari punti, posti UEFA, esclusione Milan, penalizzazione Chievo e retrocessioni;
- `source_provider`: fonte principale più controllo incrociato;
- `source_url`: URL diretto;
- `last_verified_at`: data reale `YYYY-MM-DD`.

Milan, Roma e Torino devono mantenere la loro posizione sportiva; gli effetti UEFA vanno nei campi descrittivi.

## `discrepancies.csv`

```csv
team_name,field,source_a_value,source_b_value,source_a_url,source_b_url,resolution,status,notes
```

Registrare ogni conflitto su rank, pari punti, punti, record, penalizzazioni o posti UEFA. Stato `resolved` o `unresolved`; solo intestazione se nessun conflitto.

## `aliases.csv`

```csv
source_name,selected_team_name,source_provider,notes
```

Documentare abbreviazioni e denominazioni diverse.

## Controlli obbligatori

1. 20 righe e rank completi 1–20.
2. 38 partite per squadra.
3. `wins + draws + losses = played`.
4. `goals_for - goals_against = goals_diff`.
5. Somma vittorie = somma sconfitte.
6. Somma gol fatti = somma gol subiti.
7. Somma pareggi pari.
8. Confronto `3 × wins + draws` con punti ufficiali.
9. Scarto del Chievo coincidente con penalizzazione documentata.
10. Classifica verificata su almeno due fonti.
11. Tutti i pari punti e relativi criteri verificati.
12. Posti UEFA, Coppa Italia ed esclusione Milan verificati.
13. Retrocessioni verificate.

## `manifest.json`

```json
{
  "package_type": "season_standings_resolution",
  "area": "season_standings",
  "season": "2018/19",
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
      "milan_exclusion_verified": "passed",
      "administrative_outcomes": "passed"
    },
    "unresolved_conflicts": []
  },
  "files": {
    "data.csv": { "sha256": "SHA256_REALE" }
  }
}
```

Usare `conflict_review_required` se resta un conflitto sostanziale, registrandolo anche in `discrepancies.csv` e `unresolved_conflicts`.

## Documentazione e verifica finale

`SOURCES.md` deve separare: classifica, pari punti, Sassuolo, Chievo, qualificazioni UEFA, esclusione Milan, Coppa Italia e retrocessioni. Per ogni fonte indicare titolo, provider, URL, data e dati verificati.

Se non si includono copie delle fonti, compilare `source-files/README.md` con URL, titolo, data, dati estratti e motivo.

Prima della consegna: nomi corretti, tutti i file, 20 righe, checksum reale, nessun `TODO`/`UNKNOWN`, quadrature superate e nessuna modifica artificiale.
