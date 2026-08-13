# Richiesta ricerca esterna — classifica Serie B 2008/09

## Obiettivo

Preparare un pacchetto ZIP completo e verificabile con la **classifica finale ufficiale della stagione regolare di Serie B 2008/09**.

Il pacchetto deve contenere tutte le 22 squadre, non soltanto il Sassuolo. I dati serviranno per l'importazione nel progetto “Sassuolo History & Stats”. Non hai accesso al codice del progetto: segui quindi esattamente struttura, colonne e controlli descritti qui.

## Ambito preciso

- Stagione: `2008/09`
- Competizione: `Serie B`
- Tipo di dato: classifica finale della stagione regolare
- Numero atteso di squadre: `22`
- Partite attese per ogni squadra: `42`
- Non modificare l'ordine della classifica in base all'esito successivo di playoff o playout.
- Promozioni, retrocessioni, playoff, playout, esclusioni e penalizzazioni devono essere documentati separatamente nei campi `status` e `description`.

## Domande che la ricerca deve risolvere

1. Qual è l'ordine ufficiale finale dal 1° al 22° posto?
2. Per ogni squadra: punti ufficiali, partite, vittorie, pareggi, sconfitte, gol fatti, gol subiti e differenza reti.
3. Quali squadre subirono penalizzazioni o detrazioni di punti? Quanti punti furono sottratti e per quale motivo?
4. Quali squadre furono promosse direttamente?
5. Quali squadre parteciparono ai playoff e quale fu il loro esito?
6. Quali squadre parteciparono ai playout e quale fu il loro esito?
7. Quali squadre retrocessero, furono escluse, non ammesse o fallirono dopo il campionato?
8. In caso di squadre a pari punti, qual è il piazzamento ufficiale pubblicato dalla fonte? Non ricostruire autonomamente i criteri di spareggio se è disponibile una classifica finale ufficiale.

## Fonti richieste

Usare almeno:

- una fonte primaria o archivio storico autorevole, preferibilmente Lega Serie B, FIGC o comunicati ufficiali archiviati;
- una seconda fonte indipendente e specialistica per il controllo incrociato, per esempio RSSSF, WorldFootball, calcio-seriea.net o un archivio statistico equivalente.

Wikipedia può essere usata soltanto come supporto orientativo, non come unica prova. Per penalizzazioni, esclusioni e decisioni amministrative cercare preferibilmente un comunicato ufficiale o una fonte giornalistica contemporanea affidabile.

Salvare in `SOURCES.md` l'URL diretto di ogni pagina consultata, il nome della fonte, la data di consultazione e che cosa dimostra. Non indicare semplicemente la homepage del sito.

## Struttura obbligatoria dello ZIP

Creare una cartella chiamata:

`standings-serie-b-2008-09-resolution`

La cartella deve contenere:

```text
standings-serie-b-2008-09-resolution/
  data.csv
  discrepancies.csv
  aliases.csv
  manifest.json
  SOURCES.md
  source-files/
    README.md
```

## Formato di `data.csv`

CSV UTF-8, separatore virgola, intestazione esattamente uguale a questa:

```csv
season,competition,team_name,rank,points,played,wins,draws,losses,goals_for,goals_against,goals_diff,status,description,source_provider,source_url,last_verified_at
```

Regole:

- una riga per squadra, quindi esattamente 22 righe dati;
- `season`: sempre `2008/09`;
- `competition`: sempre `Serie B`;
- `team_name`: denominazione calcistica riconoscibile e non abbreviata;
- `rank`: posizione ufficiale finale, intero da 1 a 22 senza duplicati;
- `points`: punti ufficiali finali **dopo** eventuali penalizzazioni;
- `played`, `wins`, `draws`, `losses`, `goals_for`, `goals_against`, `goals_diff`: numeri interi;
- `status`: lista sintetica di valori separati da `|`, scegliendo quando applicabile tra `champion`, `promoted`, `playoff`, `playoff_winner`, `playoff_eliminated`, `playout`, `playout_winner`, `playout_loser`, `relegated`, `excluded`, `not_admitted`, `points_deduction`, `none`;
- `description`: nota leggibile che spieghi penalizzazioni ed esito sportivo/amministrativo. Se non c'è nulla da annotare, lasciare vuoto;
- `source_provider`: fonte principale della riga;
- `source_url`: URL diretto della fonte principale;
- `last_verified_at`: data effettiva della verifica in formato `YYYY-MM-DD`.

Non ricalcolare i punti come `3 × vittorie + pareggi` quando esiste una penalizzazione: riportare i punti ufficiali e descrivere la differenza.

## Formato di `aliases.csv`

Intestazione:

```csv
source_name,selected_team_name,source_provider,notes
```

Inserire una riga quando le fonti usano nomi diversi per la stessa squadra, per esempio ragione sociale completa, nome breve o denominazione storica. Non inventare fusioni tra club diversi.

## Formato di `discrepancies.csv`

Intestazione:

```csv
team_name,field,source_a_value,source_b_value,source_a_url,source_b_url,resolution,status,notes
```

Registrare ogni differenza rilevata tra le fonti su posizione, punti, record, reti, penalizzazioni o stato finale.

- `resolution`: valore scelto e motivazione;
- `status`: `resolved` oppure `unresolved`;
- non nascondere i conflitti scegliendo silenziosamente una fonte;
- se non esistono discrepanze, lasciare soltanto l'intestazione.

## Controlli matematici obbligatori

Eseguire e documentare nel manifest tutti i seguenti controlli:

1. `row_count`: 22 righe.
2. `rank_sequence`: posizioni uniche e complete da 1 a 22.
3. `played_per_team`: ogni squadra ha 42 partite.
4. `record_identity`: per ogni squadra, `wins + draws + losses = played`.
5. `goal_difference_identity`: per ogni squadra, `goals_for - goals_against = goals_diff`.
6. `league_win_loss_balance`: somma delle vittorie uguale alla somma delle sconfitte.
7. `league_goal_balance`: somma dei gol fatti uguale alla somma dei gol subiti.
8. `draw_balance`: la somma dei pareggi deve essere pari.
9. `points_reconciliation`: per ogni squadra confrontare `3 × wins + draws` con i punti ufficiali; ogni differenza deve essere spiegata da una penalizzazione documentata.
10. `source_crosscheck`: ogni riga verificata su almeno due fonti oppure eventuale eccezione spiegata.
11. `administrative_outcomes`: promozioni, playoff, playout, retrocessioni e provvedimenti amministrativi verificati.

## Formato minimo di `manifest.json`

Usare questa struttura, completandola con i risultati reali:

```json
{
  "package_type": "season_standings_resolution",
  "area": "season_standings",
  "season": "2008/09",
  "competition": "Serie B",
  "row_count": 22,
  "generated_at": "YYYY-MM-DD",
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
    "data.csv": {
      "sha256": "INSERIRE_SHA256_REALE"
    }
  }
}
```

Impostare `validation.status` su `reconciled` soltanto se non restano conflitti sostanziali. Se resta anche un solo conflitto non risolto, usare `conflict_review_required` e inserirlo sia in `discrepancies.csv` sia in `unresolved_conflicts`.

## Contenuto di `SOURCES.md`

Il documento deve includere:

- elenco delle fonti con URL diretti;
- data di accesso;
- campi verificati su ciascuna fonte;
- spiegazione delle penalizzazioni e relativo documento probatorio;
- spiegazione degli esiti di playoff e playout;
- eventuali cambi di denominazione o ambiguità sui nomi delle squadre;
- riepilogo di ogni conflitto e della decisione adottata.

## Materiale sorgente

Se è legalmente possibile, inserire in `source-files/` copie HTML, PDF, screenshot o estratti delle fonti. Altrimenti descrivere in `source-files/README.md` perché il file non è incluso e riportare URL, titolo della pagina, data di accesso e informazioni estratte.

## Criterio di consegna

Consegnare lo ZIP soltanto dopo aver verificato che:

- contenga tutti i file richiesti;
- `data.csv` abbia esattamente 22 righe dati;
- tutti i controlli matematici siano superati;
- punti di penalizzazione e provvedimenti amministrativi siano documentati;
- lo SHA-256 di `data.csv` nel manifest sia reale;
- non siano presenti segnaposto come `TODO`, `UNKNOWN` o URL generici.

Non modificare dati per far tornare artificialmente i controlli. Qualunque anomalia reale deve essere conservata e spiegata.
