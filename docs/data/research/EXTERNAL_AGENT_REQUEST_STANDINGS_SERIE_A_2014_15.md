# Compito autonomo — classifica Serie A 2014/15

## Consegna

Genera uno ZIP chiamato esattamente:

`standings-serie-a-2014-15-resolution.zip`

Deve contenere la classifica finale ufficiale della Serie A 2014/15, tutte le 20 squadre, fonti, discrepanze e controlli. Non occorre vedere il codice del progetto “Sassuolo History & Stats”: segui questa specifica senza cambiare nomi o colonne.

Salva lo ZIP finale in:

`C:\Users\Coppi\Downloads\standings-serie-a-2014-15-resolution.zip`

Non modificare il database e non copiare file nel progetto.

## Perimetro

- stagione `2014/15`;
- competizione `Serie A`;
- 20 squadre;
- 38 partite per squadra;
- classifica sportiva finale dal 1° al 20° posto;
- titolo, qualificazioni UEFA, retrocessioni, penalizzazioni e decisioni amministrative.

## Casi da verificare espressamente

1. **Parma:** punti sportivi teorici, penalizzazione ufficiale finale, punti effettivi, fallimento e retrocessione. Distinguere penalizzazione in classifica e successivo esito amministrativo.
2. **Genoa/Sampdoria:** verificare il piazzamento sportivo del Genoa, la licenza UEFA negata e l’eventuale subentro della Sampdoria in Europa League. Non cambiare il rank sportivo.
3. Qualificazioni europee di Juventus, Roma, Lazio, Fiorentina, Napoli e dell’eventuale squadra subentrante.
4. Posizione e statistiche finali del Sassuolo.

## Fonti

Usare almeno:

- una fonte primaria/autorevole: Lega Serie A, FIGC, UEFA o comunicati ufficiali;
- una fonte statistica completa: RSSSF, WorldFootball, calcio-seriea.net, Soccerway o equivalente;
- per Parma e licenze UEFA, una fonte ufficiale o giornalistica contemporanea affidabile.

Wikipedia può essere soltanto una fonte supplementare. Usare URL diretti, mai homepage o pagine di ricerca.

## Struttura interna

```text
standings-serie-a-2014-15-resolution/
  data.csv
  discrepancies.csv
  aliases.csv
  manifest.json
  SOURCES.md
  source-files/
    README.md
```

## `data.csv`

CSV UTF-8, separatore virgola, intestazione esatta:

```csv
season,competition,team_name,rank,points,played,wins,draws,losses,goals_for,goals_against,goals_diff,status,description,source_provider,source_url,last_verified_at
```

Regole:

- 20 righe dati;
- `season` sempre `2014/15`, `competition` sempre `Serie A`;
- `rank` intero unico 1–20;
- `points` sono i punti ufficiali dopo penalizzazioni;
- valori sportivi tutti interi e non vuoti;
- `status`: valori applicabili separati da `|` tra `champion`, `champions_league`, `champions_league_qualifying`, `europa_league`, `europa_league_denied`, `relegated`, `excluded`, `not_admitted`, `points_deduction`, `none`;
- `description`: spiegare qualificazioni UEFA, licenza negata/subentro, penalizzazione Parma, fallimento o retrocessione;
- `source_provider`: fonte principale più controllo incrociato;
- `source_url`: URL diretto della fonte principale;
- `last_verified_at`: data reale `YYYY-MM-DD`.

Non alterare il rank per rappresentare la successiva assegnazione dei posti UEFA. Non ricalcolare i punti ignorando le penalizzazioni.

## `discrepancies.csv`

```csv
team_name,field,source_a_value,source_b_value,source_a_url,source_b_url,resolution,status,notes
```

Registrare ogni divergenza su posizione, punti, record, reti, penalizzazioni, licenze UEFA o verdetti. Stato `resolved` o `unresolved`. Se non ci sono conflitti, lasciare solo l’intestazione.

## `aliases.csv`

```csv
source_name,selected_team_name,source_provider,notes
```

Documentare abbreviazioni e denominazioni societarie diverse senza confondere club distinti.

## Controlli obbligatori

1. 20 righe.
2. Rank unici e completi 1–20.
3. 38 partite per squadra.
4. `wins + draws + losses = played` per ogni squadra.
5. `goals_for - goals_against = goals_diff`.
6. Somma vittorie = somma sconfitte.
7. Somma gol fatti = somma gol subiti.
8. Somma pareggi pari.
9. Confrontare `3 × wins + draws` con `points` per ogni squadra.
10. Ogni scarto punti deve corrispondere a una penalizzazione documentata.
11. Classifica verificata su almeno due fonti.
12. Caso Parma verificato con fonte probatoria.
13. Caso Genoa/Sampdoria e posti UEFA verificato con fonte probatoria.
14. Retrocessioni verificate.

## `manifest.json`

Struttura minima:

```json
{
  "package_type": "season_standings_resolution",
  "area": "season_standings",
  "season": "2014/15",
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
      "administrative_outcomes": "passed"
    },
    "unresolved_conflicts": []
  },
  "files": {
    "data.csv": { "sha256": "SHA256_REALE" }
  }
}
```

Se resta un conflitto sostanziale, usare `conflict_review_required` e inserirlo sia in `discrepancies.csv` sia in `unresolved_conflicts`.

## Documentazione

`SOURCES.md` deve elencare titolo, provider, URL diretto, data di accesso e campi verificati. Creare sezioni separate per classifica, qualificazioni UEFA, Parma, Genoa/Sampdoria, penalizzazioni e retrocessioni.

Se non si includono copie delle pagine, `source-files/README.md` deve riportare URL, titolo, data, dati estratti e motivo della mancata inclusione.

## Controllo prima della consegna

- nomi ZIP e cartella interna corretti;
- tutti i file presenti;
- 20 righe dati;
- nessun `TODO`, `UNKNOWN`, URL generico o checksum fittizio;
- SHA-256 reale;
- quadrature realmente superate;
- anomalie conservate e spiegate, mai corrette artificialmente.
