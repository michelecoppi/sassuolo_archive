# Richiesta ricerca esterna — classifica Serie B 2010/11

## Obiettivo

Preparare un pacchetto ZIP completo e verificabile con la **classifica finale ufficiale della stagione regolare di Serie B 2010/11**, destinato al progetto “Sassuolo History & Stats”. Non hai accesso al codice: rispetta esattamente struttura, colonne e controlli indicati qui.

## Perimetro

- stagione: `2010/11`;
- competizione: `Serie B`;
- 22 squadre e 42 partite per squadra;
- classifica della regular season dal 1° al 22° posto;
- includere tutte le squadre, non solo il Sassuolo;
- non riordinare la classifica in base ai successivi playoff/playout;
- annotare separatamente penalizzazioni, spareggi, promozioni, retrocessioni e provvedimenti amministrativi.

## Ricerca richiesta

Determinare e documentare:

1. posizione, punti ufficiali, partite, vittorie, pareggi, sconfitte, gol fatti, gol subiti e differenza reti per ogni squadra;
2. campione e promosse direttamente;
3. partecipanti ed esito dei playoff;
4. partecipanti ed esito dei playout;
5. retrocessioni dirette e dopo playout;
6. ogni penalizzazione: squadra, punti sportivi teorici, punti sottratti, punti ufficiali, motivazione e fonte;
7. eventuali penalizzazioni inizialmente comminate ma successivamente ridotte o annullate;
8. fallimenti, esclusioni, ripescaggi o mancate ammissioni successivi alla stagione, senza confonderli con il verdetto sul campo;
9. ordine ufficiale delle squadre a pari punti, senza ricostruire arbitrariamente i criteri.

## Fonti

Usare almeno due fonti indipendenti:

- una fonte primaria/autorevole: Lega Serie B, FIGC o comunicati ufficiali archiviati;
- una fonte statistica specialistica completa: RSSSF, WorldFootball, calcio-seriea.net, Soccerway o equivalente.

Wikipedia è ammessa solo come controllo supplementare. Per penalizzazioni e provvedimenti amministrativi serve preferibilmente una fonte ufficiale o giornalistica contemporanea. Riportare URL diretti alle pagine probatorie, non homepage o risultati di ricerca.

## Struttura obbligatoria

```text
standings-serie-b-2010-11-resolution/
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

- `season` sempre `2010/11` e `competition` sempre `Serie B`;
- esattamente 22 righe dati;
- `rank` intero, unico, da 1 a 22;
- `points` deve contenere i punti ufficiali finali dopo eventuali penalizzazioni;
- tutti i valori statistici devono essere interi e non vuoti;
- `status`: valori applicabili separati da `|`, scegliendo tra `champion`, `promoted`, `playoff`, `playoff_winner`, `playoff_eliminated`, `playout`, `playout_winner`, `playout_loser`, `relegated`, `excluded`, `not_admitted`, `points_deduction`, `none`;
- `description`: spiegazione di penalizzazioni, spareggi ed esiti amministrativi; vuoto solo in assenza di annotazioni;
- `source_provider`: fonte principale e controllo incrociato;
- `source_url`: URL diretto della fonte principale;
- `last_verified_at`: data reale `YYYY-MM-DD`.

Non ricalcolare o sostituire i punti ufficiali. Se `3 × wins + draws` differisce da `points`, documentare lo scarto.

## `discrepancies.csv`

```csv
team_name,field,source_a_value,source_b_value,source_a_url,source_b_url,resolution,status,notes
```

Registrare ogni conflitto tra fonti su posizione, punti, record, reti, penalizzazioni o verdetti. Usare `resolved` o `unresolved`. Se non ci sono conflitti, lasciare solo l’intestazione. Non scegliere silenziosamente una fonte.

## `aliases.csv`

```csv
source_name,selected_team_name,source_provider,notes
```

Documentare varianti, abbreviazioni e ragioni sociali. Usare un nome calcistico riconoscibile in `selected_team_name`, senza confondere club distinti.

## Controlli matematici obbligatori

1. 22 righe dati.
2. Rank completi e unici da 1 a 22.
3. Ogni squadra ha 42 partite.
4. Per ogni squadra: `wins + draws + losses = played`.
5. Per ogni squadra: `goals_for - goals_against = goals_diff`.
6. Somma vittorie = somma sconfitte.
7. Somma gol fatti = somma gol subiti.
8. Somma pareggi pari.
9. Per ogni squadra confrontare `3 × wins + draws` con i punti ufficiali.
10. Ogni differenza punti deve coincidere con una penalizzazione documentata.
11. Classifica e verdetti devono essere controllati su almeno due fonti.
12. Nessun conflitto sostanziale può essere omesso.

## `manifest.json`

Struttura minima richiesta:

```json
{
  "package_type": "season_standings_resolution",
  "area": "season_standings",
  "season": "2010/11",
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

Se resta un conflitto sostanziale, usare `conflict_review_required`, registrarlo in `discrepancies.csv` e inserirlo in `unresolved_conflicts`.

## Documentazione delle fonti

In `SOURCES.md` riportare per ogni fonte: titolo, provider, URL diretto, data di accesso e campi verificati. Aggiungere sezioni esplicite per penalizzazioni, pari punti, playoff/playout e provvedimenti amministrativi.

Inserire copie o estratti in `source-files/` quando possibile. Altrimenti spiegare in `source-files/README.md` perché non sono inclusi e indicare URL, titolo, data di accesso e dati estratti.

## Verifica prima della consegna

Lo ZIP può essere consegnato soltanto se:

- contiene tutti i file richiesti;
- `data.csv` contiene 22 righe;
- tutti i controlli matematici sono superati;
- penalizzazioni ed esiti amministrativi sono documentati;
- il checksum SHA-256 è reale;
- non contiene `TODO`, `UNKNOWN`, URL generici o valori inventati.

Non alterare dati per far quadrare artificialmente i totali: conservare e spiegare qualsiasi anomalia reale.
