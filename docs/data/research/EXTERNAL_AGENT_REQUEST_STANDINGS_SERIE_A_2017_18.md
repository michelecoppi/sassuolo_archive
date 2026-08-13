# Compito autonomo — classifica Serie A 2017/18

## Consegna

Genera lo ZIP:

`standings-serie-a-2017-18-resolution.zip`

e salvalo in:

`C:\Users\Coppi\Downloads\standings-serie-a-2017-18-resolution.zip`

Non modificare il progetto o il database.

## Obiettivo

Preparare la classifica finale ufficiale della Serie A 2017/18:

- 20 squadre;
- 38 partite per squadra;
- rank sportivo 1–20;
- punti, record e reti completi;
- titolo, qualificazioni UEFA, retrocessioni ed eventuali penalizzazioni.

## Casi da verificare espressamente

1. Posizione e statistiche finali del Sassuolo.
2. Nuova distribuzione dei posti Champions League per le prime quattro.
3. **Inter e Lazio a pari punti:** confermare ordine ufficiale e criterio applicato, senza riordinare per differenza reti generale.
4. Posti Europa League diretti e preliminari.
5. Effetto della Coppa Italia sull’ultimo posto europeo.
6. Ordine ufficiale di ogni altro gruppo a pari punti.
7. Retrocessioni ed eventuali decisioni amministrative.

## Fonti

Usare almeno:

- una fonte primaria/autorevole: Lega Serie A, FIGC, UEFA o comunicati ufficiali;
- una fonte statistica completa: RSSSF, WorldFootball, Soccerway, calcio-seriea.net o equivalente;
- una fonte probatoria per il pari punti Inter–Lazio e l’assegnazione dei posti UEFA.

Wikipedia può essere solo una fonte supplementare. Usare URL diretti.

## Struttura ZIP

```text
standings-serie-a-2017-18-resolution/
  data.csv
  discrepancies.csv
  aliases.csv
  manifest.json
  SOURCES.md
  source-files/
    README.md
```

## `data.csv`

CSV UTF-8 con separatore virgola:

```csv
season,competition,team_name,rank,points,played,wins,draws,losses,goals_for,goals_against,goals_diff,status,description,source_provider,source_url,last_verified_at
```

Regole:

- `season` sempre `2017/18` e `competition` sempre `Serie A`;
- 20 righe dati;
- `rank` unico 1–20;
- punti ufficiali finali;
- statistiche numeriche intere e non vuote;
- `status`: valori applicabili separati da `|` tra `champion`, `champions_league`, `champions_league_qualifying`, `europa_league`, `europa_league_qualifying`, `relegated`, `excluded`, `not_admitted`, `points_deduction`, `none`;
- `description`: titolo, posti UEFA, criterio pari punti, Coppa Italia, penalizzazioni o retrocessioni;
- `source_provider`: fonte principale e controllo incrociato;
- `source_url`: URL diretto;
- `last_verified_at`: data reale `YYYY-MM-DD`.

Non modificare il rank in base alla competizione UEFA successiva.

## `discrepancies.csv`

```csv
team_name,field,source_a_value,source_b_value,source_a_url,source_b_url,resolution,status,notes
```

Registrare conflitti su rank, pari punti, record, reti, qualificazioni o penalizzazioni. Stato `resolved` o `unresolved`; se non ci sono conflitti, lasciare solo l’intestazione.

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
11. Inter/Lazio e criteri di pari punti verificati.
12. Posti UEFA e relativi turni verificati.
13. Effetto Coppa Italia verificato.
14. Retrocessioni verificate.

## `manifest.json`

```json
{
  "package_type": "season_standings_resolution",
  "area": "season_standings",
  "season": "2017/18",
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
      "administrative_outcomes": "passed"
    },
    "unresolved_conflicts": []
  },
  "files": {
    "data.csv": { "sha256": "SHA256_REALE" }
  }
}
```

Se rimane un conflitto sostanziale, usare `conflict_review_required` e registrarlo in `discrepancies.csv` e `unresolved_conflicts`.

## Documentazione e controllo finale

`SOURCES.md` deve riportare titolo, provider, URL, data e campi verificati, con sezioni per classifica, pari punti, UEFA, Coppa Italia, Sassuolo e retrocessioni.

Se non si includono copie delle fonti, compilare `source-files/README.md` con URL, titolo, data, dati estratti e motivo.

Prima della consegna verificare: nomi corretti, tutti i file, 20 righe, checksum reale, nessun `TODO`/`UNKNOWN`, quadrature superate e nessuna modifica artificiale dei dati.
