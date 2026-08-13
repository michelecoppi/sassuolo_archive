# Richiesta ricerca esterna — classifica Serie B 2011/12

## Obiettivo

Preparare uno ZIP completo e verificabile con la **classifica finale ufficiale della stagione regolare di Serie B 2011/12**, destinato al progetto “Sassuolo History & Stats”. Non hai accesso al codice del progetto: segui esattamente struttura, schema e controlli descritti qui.

## Perimetro

- stagione: `2011/12`;
- competizione: `Serie B`;
- tutte le 22 squadre;
- 42 partite per squadra;
- classifica ufficiale della regular season, posizioni 1–22;
- playoff e playout vanno annotati, senza riordinare la classifica;
- distinguere sempre verdetti sul campo e successivi provvedimenti amministrativi.

## Questioni da risolvere

Per ogni squadra ricercare posizione, punti ufficiali, partite, vittorie, pareggi, sconfitte, gol fatti, gol subiti e differenza reti. Verificare inoltre:

1. campione e promosse direttamente;
2. partecipanti ed esito dei playoff;
3. partecipanti ed esito dei playout;
4. retrocessioni dirette e dopo playout;
5. tutte le penalizzazioni, indicando punti sportivi teorici, punti sottratti e punti ufficiali;
6. eventuali penalizzazioni ridotte, annullate o modificate durante la stagione;
7. fallimenti, esclusioni, ripescaggi e mancate ammissioni successivi;
8. ordine ufficiale delle squadre a pari punti;
9. eventuali divergenze tra fonti su punti, penalizzazioni o posizione.

Non calcolare autonomamente la graduatoria quando è disponibile quella ufficiale.

## Fonti richieste

Usare almeno due fonti indipendenti:

- una fonte primaria o autorevole, preferibilmente Lega Serie B, FIGC o comunicati ufficiali archiviati;
- una fonte statistica completa, come RSSSF, WorldFootball, calcio-seriea.net o Soccerway.

Wikipedia può essere usata soltanto come controllo supplementare. Penalizzazioni e decisioni amministrative devono avere preferibilmente una prova ufficiale o una fonte giornalistica contemporanea. Usare URL diretti, non homepage o risultati di ricerca.

## Struttura dello ZIP

```text
standings-serie-b-2011-12-resolution/
  data.csv
  discrepancies.csv
  aliases.csv
  manifest.json
  SOURCES.md
  source-files/
    README.md
```

## Schema di `data.csv`

CSV UTF-8, separatore virgola, intestazione esatta:

```csv
season,competition,team_name,rank,points,played,wins,draws,losses,goals_for,goals_against,goals_diff,status,description,source_provider,source_url,last_verified_at
```

Regole:

- `season` sempre `2011/12`;
- `competition` sempre `Serie B`;
- esattamente 22 righe dati;
- `rank` intero, unico, da 1 a 22;
- `points` rappresenta i punti ufficiali finali dopo eventuali penalizzazioni;
- tutte le statistiche sono interi e non possono essere vuote;
- `status`: valori applicabili separati da `|`, scegliendo tra `champion`, `promoted`, `playoff`, `playoff_winner`, `playoff_eliminated`, `playout`, `playout_winner`, `playout_loser`, `relegated`, `excluded`, `not_admitted`, `points_deduction`, `none`;
- `description`: spiegazione di penalizzazioni, spareggi e provvedimenti amministrativi; vuoto solo se non serve annotazione;
- `source_provider`: fonte principale con controllo incrociato;
- `source_url`: URL diretto della fonte principale;
- `last_verified_at`: data effettiva `YYYY-MM-DD`.

Gli esiti degli spareggi non devono modificare `rank`. Non sostituire i punti ufficiali con il valore calcolato da vittorie e pareggi.

## Schema di `discrepancies.csv`

```csv
team_name,field,source_a_value,source_b_value,source_a_url,source_b_url,resolution,status,notes
```

Registrare ogni conflitto su posizione, punti, record, reti, penalizzazioni o verdetti. Usare `resolved` oppure `unresolved`. Se non ci sono conflitti, lasciare soltanto l’intestazione. Non eliminare una divergenza scegliendo silenziosamente una fonte.

## Schema di `aliases.csv`

```csv
source_name,selected_team_name,source_provider,notes
```

Documentare abbreviazioni, varianti e ragioni sociali. Conservare denominazioni storiche quando rilevanti e non confondere club distinti.

## Controlli obbligatori

1. `row_count`: 22.
2. `rank_sequence`: posizioni uniche e complete da 1 a 22.
3. `played_per_team`: 42 per ogni squadra.
4. `record_identity`: `wins + draws + losses = played` per ogni squadra.
5. `goal_difference_identity`: `goals_for - goals_against = goals_diff`.
6. `league_win_loss_balance`: somma vittorie = somma sconfitte.
7. `league_goal_balance`: somma gol fatti = somma gol subiti.
8. `draw_balance`: somma pareggi pari.
9. `points_reconciliation`: confrontare per ogni squadra `3 × wins + draws` con i punti ufficiali.
10. Ogni scarto punti deve coincidere con una penalizzazione documentata.
11. `source_crosscheck`: classifica verificata su almeno due fonti.
12. `administrative_outcomes`: spareggi e provvedimenti successivi verificati.

## Struttura minima di `manifest.json`

```json
{
  "package_type": "season_standings_resolution",
  "area": "season_standings",
  "season": "2011/12",
  "competition": "Serie B",
  "source_provider": "FONTE PRINCIPALE + CONTROLLO INCROCIATO",
  "source_url": "URL DIRETTO",
  "row_count": 22,
  "records_total": 22,
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
      "administrative_outcomes": "passed"
    },
    "unresolved_conflicts": []
  },
  "files": {
    "data.csv": { "sha256": "SHA256_REALE" }
  }
}
```

Se rimane un conflitto sostanziale, impostare `validation.status` su `conflict_review_required`, registrarlo in `discrepancies.csv` e inserirlo in `unresolved_conflicts`.

## Fonti e materiale probatorio

In `SOURCES.md` indicare per ogni fonte titolo, provider, URL diretto, data di consultazione e campi verificati. Aggiungere sezioni specifiche per penalizzazioni, spareggi, pari punti e provvedimenti amministrativi.

Inserire in `source-files/` copie o estratti quando legalmente possibile. Altrimenti usare `source-files/README.md` per elencare URL, titolo, data di accesso, dati estratti e motivo della mancata inclusione.

## Condizioni di consegna

Consegnare lo ZIP soltanto quando:

- sono presenti tutti i file;
- `data.csv` contiene esattamente 22 righe;
- tutti i controlli matematici sono superati;
- penalizzazioni e provvedimenti amministrativi sono documentati;
- il checksum SHA-256 è reale;
- non restano `TODO`, `UNKNOWN`, URL generici o valori inventati.

Non modificare dati per far quadrare artificialmente i controlli: qualsiasi anomalia reale deve essere conservata e spiegata.
