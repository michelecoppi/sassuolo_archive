# Richiesta ricerca esterna — classifica Serie B 2012/13

## Obiettivo

Preparare uno ZIP verificabile con la **classifica finale ufficiale della stagione regolare di Serie B 2012/13**, completo di tutte le squadre e destinato al progetto “Sassuolo History & Stats”. Non hai accesso al codice: rispetta esattamente struttura, schema e controlli indicati qui.

Questa è la stagione della promozione del Sassuolo: servono particolare precisione su posizione finale, titolo, punti, reti e verdetti.

## Perimetro

- stagione: `2012/13`;
- competizione: `Serie B`;
- 22 squadre;
- 42 partite per squadra;
- classifica finale della regular season, posizioni 1–22;
- includere tutte le squadre, non solo il Sassuolo;
- playoff/playout ed esiti amministrativi vanno annotati senza alterare il rank della regular season.

## Ricerca obbligatoria

Per ogni squadra determinare:

- posizione ufficiale;
- punti ufficiali finali;
- partite, vittorie, pareggi e sconfitte;
- gol fatti, gol subiti e differenza reti;
- stato sportivo e amministrativo finale.

Rispondere inoltre a queste domande:

1. Quali squadre furono promosse direttamente e quale vinse il campionato?
2. I playoff furono disputati? Se sì, da chi e con quale esito; se non furono disputati, documentare il motivo regolamentare.
3. Quali squadre disputarono i playout e con quale esito?
4. Quali squadre retrocessero direttamente o dopo spareggio?
5. Quali penalizzazioni furono applicate? Indicare per ogni squadra punti teorici, detrazione finale, punti ufficiali e motivazione.
6. Vi furono penalizzazioni ridotte, annullate o modificate durante la stagione?
7. Vi furono fallimenti, esclusioni, retrocessioni d’ufficio, ripescaggi o mancate ammissioni successivi?
8. Qual è l’ordine ufficiale delle squadre a pari punti?
9. Esistono divergenze tra fonti su penalizzazioni, posizione o verdetti?

Non ricostruire autonomamente la graduatoria quando è disponibile quella ufficiale.

## Fonti minime

Usare almeno due fonti indipendenti:

- una fonte primaria o autorevole, preferibilmente Lega Serie B, FIGC o comunicati ufficiali archiviati;
- una fonte statistica completa, per esempio RSSSF, WorldFootball, calcio-seriea.net o Soccerway.

Wikipedia è ammessa solo come controllo supplementare. Penalizzazioni e provvedimenti amministrativi richiedono preferibilmente una prova ufficiale o una fonte giornalistica contemporanea. Fornire URL diretti alle pagine probatorie.

## Struttura obbligatoria dello ZIP

```text
standings-serie-b-2012-13-resolution/
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

- `season`: sempre `2012/13`;
- `competition`: sempre `Serie B`;
- esattamente 22 righe dati;
- `rank`: intero unico da 1 a 22;
- `points`: punti ufficiali finali dopo ogni penalizzazione;
- statistiche numeriche sempre intere e non vuote;
- `status`: valori applicabili separati da `|`, scegliendo tra `champion`, `promoted`, `playoff`, `playoff_winner`, `playoff_eliminated`, `playout`, `playout_winner`, `playout_loser`, `relegated`, `excluded`, `not_admitted`, `points_deduction`, `none`;
- `description`: spiegazione leggibile di penalizzazioni, spareggi, promozioni, retrocessioni e provvedimenti amministrativi;
- `source_provider`: fonte principale e controllo incrociato;
- `source_url`: URL diretto della fonte principale;
- `last_verified_at`: data effettiva in formato `YYYY-MM-DD`.

Non sostituire i punti ufficiali con `3 × vittorie + pareggi`. Ogni differenza deve essere spiegata da una penalizzazione documentata.

## `discrepancies.csv`

```csv
team_name,field,source_a_value,source_b_value,source_a_url,source_b_url,resolution,status,notes
```

Registrare ogni conflitto su posizione, punti, record, reti, penalizzazioni, playoff/playout o provvedimenti amministrativi. Usare `resolved` o `unresolved`. Se non esistono conflitti, lasciare solo l’intestazione. Non scegliere silenziosamente una fonte.

## `aliases.csv`

```csv
source_name,selected_team_name,source_provider,notes
```

Documentare abbreviazioni, varianti e ragioni sociali. Conservare le denominazioni storiche rilevanti e non confondere club distinti.

## Controlli matematici

1. Esattamente 22 righe.
2. Rank completi e unici da 1 a 22.
3. Ogni squadra ha 42 partite.
4. `wins + draws + losses = played` per ogni squadra.
5. `goals_for - goals_against = goals_diff` per ogni squadra.
6. Somma vittorie = somma sconfitte.
7. Somma gol fatti = somma gol subiti.
8. Somma dei pareggi pari.
9. Confrontare `3 × wins + draws` con i punti ufficiali per ogni squadra.
10. Ogni scarto punti deve coincidere con una penalizzazione provata.
11. Classifica e verdetti verificati su almeno due fonti.
12. Regola ed eventuale mancata disputa dei playoff esplicitamente verificata.
13. Provvedimenti amministrativi successivi documentati senza alterare il rank.

## `manifest.json`

Struttura minima:

```json
{
  "package_type": "season_standings_resolution",
  "area": "season_standings",
  "season": "2012/13",
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
      "playoff_rule_verified": "passed",
      "administrative_outcomes": "passed"
    },
    "unresolved_conflicts": []
  },
  "files": {
    "data.csv": { "sha256": "SHA256_REALE" }
  }
}
```

Se resta un conflitto sostanziale, impostare `validation.status` su `conflict_review_required`, registrarlo in `discrepancies.csv` e inserirlo in `unresolved_conflicts`.

## `SOURCES.md` e prove

In `SOURCES.md` indicare per ogni fonte titolo, provider, URL diretto, data di consultazione e campi verificati. Includere sezioni specifiche per:

- promozione e titolo del Sassuolo;
- regola ed eventuale svolgimento dei playoff;
- playout e retrocessioni;
- penalizzazioni finali e loro evoluzione;
- pari punti;
- provvedimenti amministrativi successivi.

Inserire copie o estratti in `source-files/` quando possibile. Altrimenti elencare in `source-files/README.md` URL, titolo, data di accesso, dati estratti e motivo della mancata inclusione.

## Condizioni di consegna

Consegnare lo ZIP soltanto se:

- contiene tutti i file richiesti;
- `data.csv` contiene 22 righe;
- tutti i controlli sono realmente superati;
- penalizzazioni, spareggi e provvedimenti amministrativi sono documentati;
- lo SHA-256 è reale;
- non contiene `TODO`, `UNKNOWN`, URL generici o valori inventati.

Non modificare dati per far quadrare artificialmente i totali: ogni anomalia reale deve essere conservata e spiegata.
