# Compito autonomo — classifica Serie A 2021/22

## Consegna

Genera:

`standings-serie-a-2021-22-resolution.zip`

e salvalo in:

`C:\Users\Coppi\Downloads\standings-serie-a-2021-22-resolution.zip`

Non modificare il progetto o il database. Questa è l’ultima classifica mancante del blocco storico.

## Obiettivo

Preparare la classifica finale ufficiale della Serie A 2021/22:

- 20 squadre e 38 partite ciascuna;
- rank sportivo 1–20;
- punti, record e reti completi;
- campione, posti Champions/Europa/Conference League, retrocessioni e penalizzazioni;
- provvedimenti successivi annotati senza cambiare il rank.

## Casi da verificare espressamente

1. Posizione e statistiche del Sassuolo.
2. **Torino–Sassuolo a pari punti:** ordine ufficiale e criterio applicato.
3. Tutti gli altri gruppi a pari punti, inclusa la zona medio-bassa.
4. Prime quattro in Champions League.
5. Posti Europa League e Conference League.
6. Effetto della Coppa Italia vinta dall’Inter sull’assegnazione UEFA.
7. Eventuale influenza della vittoria della Roma nella Conference League 2021/22: distinguere qualificazione ottenuta dal campionato e titolo europeo, senza alterare il rank.
8. Zona salvezza e tre retrocessioni finali.
9. Eventuali penalizzazioni o decisioni amministrative.

## Fonti

Usare almeno:

- una fonte primaria/autorevole: Lega Serie A, FIGC, UEFA o comunicati ufficiali;
- una fonte statistica completa: RSSSF, WorldFootball, Soccerway o equivalente;
- fonti probatorie per criteri di pari punti e assegnazione dei posti UEFA.

Wikipedia solo come supporto. Usare URL diretti.

## Struttura ZIP

```text
standings-serie-a-2021-22-resolution/
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

- `season` sempre `2021/22`, `competition` sempre `Serie A`;
- 20 righe;
- rank unico 1–20;
- punti ufficiali finali;
- statistiche numeriche intere e complete;
- `status`: valori applicabili separati da `|` tra `champion`, `champions_league`, `europa_league`, `conference_league`, `conference_league_qualifying`, `relegated`, `excluded`, `not_admitted`, `points_deduction`, `none`;
- `description`: titolo, pari punti, posti UEFA, Coppa Italia, titolo Conference League, penalizzazioni o retrocessioni;
- `source_provider`: fonte principale più controllo incrociato;
- `source_url`: URL diretto;
- `last_verified_at`: data reale `YYYY-MM-DD`.

Non cambiare il rank per riflettere titoli o accessi UEFA successivi.

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
10. Tutti i pari punti verificati, soprattutto Torino/Sassuolo.
11. Posti UEFA e relativi turni verificati.
12. Effetto Coppa Italia verificato.
13. Titolo Conference League della Roma contestualizzato correttamente.
14. Retrocessioni verificate.

## `manifest.json`

```json
{
  "package_type": "season_standings_resolution",
  "area": "season_standings",
  "season": "2021/22",
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

`SOURCES.md` deve separare classifica, pari punti, Sassuolo, posti UEFA, Coppa Italia, Roma/Conference League e retrocessioni. Per ogni fonte: titolo, provider, URL, data e dati verificati.

Se non si includono copie, compilare `source-files/README.md` con URL, titolo, data, dati estratti e motivo.

Prima della consegna: nomi corretti, tutti i file, 20 righe, checksum reale, nessun `TODO`/`UNKNOWN`, quadrature superate e nessuna modifica artificiale.
