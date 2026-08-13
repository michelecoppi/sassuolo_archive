# Compito autonomo — classifica Serie A 2013/14

## Risultato da consegnare

Genera un file ZIP chiamato esattamente:

`standings-serie-a-2013-14-resolution.zip`

Lo ZIP deve contenere la classifica finale ufficiale della **Serie A 2013/14**, completa di tutte le 20 squadre, fonti e controlli. Il progetto di destinazione è “Sassuolo History & Stats”, ma non occorre vedere il suo codice: segui rigorosamente questa specifica.

## Ambito

- stagione: `2013/14`;
- competizione: `Serie A`;
- 20 squadre;
- 38 partite per squadra;
- classifica finale della stagione regolare, posizioni 1–20;
- includere tutte le squadre, non soltanto il Sassuolo;
- verificare titolo, qualificazioni UEFA, retrocessioni, penalizzazioni e provvedimenti amministrativi.

### Caso storico da controllare espressamente

Verifica con fonti affidabili il caso della qualificazione all’Europa League collegato alla **licenza UEFA del Parma** e all’eventuale subentro del Torino. La posizione in classifica non deve essere modificata: conseguenze e decisioni amministrative vanno spiegate in `status` e `description`.

## Fonti minime

Servono almeno due fonti indipendenti:

1. una fonte primaria o autorevole: Lega Serie A, FIGC, UEFA o comunicati ufficiali archiviati;
2. una fonte statistica completa: RSSSF, WorldFootball, calcio-seriea.net, Soccerway o equivalente.

Wikipedia può essere soltanto una terza fonte di controllo. Per licenze UEFA, penalizzazioni e decisioni amministrative preferire documenti ufficiali o fonti giornalistiche contemporanee. Usare URL diretti, non homepage né risultati di ricerca.

## Cartella interna allo ZIP

```text
standings-serie-a-2013-14-resolution/
  data.csv
  discrepancies.csv
  aliases.csv
  manifest.json
  SOURCES.md
  source-files/
    README.md
```

## `data.csv`

Creare un CSV UTF-8 con separatore virgola e questa intestazione esatta:

```csv
season,competition,team_name,rank,points,played,wins,draws,losses,goals_for,goals_against,goals_diff,status,description,source_provider,source_url,last_verified_at
```

Regole:

- esattamente 20 righe dati;
- `season` sempre `2013/14`;
- `competition` sempre `Serie A`;
- `rank` intero unico da 1 a 20;
- `points` contiene i punti ufficiali finali dopo eventuali penalizzazioni;
- tutte le statistiche numeriche devono essere interi e non vuote;
- `status`: valori applicabili separati da `|` tra `champion`, `champions_league`, `champions_league_qualifying`, `europa_league`, `europa_league_denied`, `relegated`, `points_deduction`, `none`;
- `description`: spiegare titolo, qualificazione europea, licenza negata/subentro, penalizzazioni o retrocessione. Lasciare vuoto solo se non serve alcuna nota;
- `source_provider`: fonte principale con controllo incrociato;
- `source_url`: URL diretto della fonte principale;
- `last_verified_at`: data reale della verifica in formato `YYYY-MM-DD`.

Non cambiare il `rank` in base alla successiva assegnazione dei posti UEFA. Non sostituire i punti ufficiali con punti ricalcolati.

## `discrepancies.csv`

Intestazione esatta:

```csv
team_name,field,source_a_value,source_b_value,source_a_url,source_b_url,resolution,status,notes
```

Registrare ogni divergenza tra fonti su posizione, punti, record, gol, penalizzazioni o qualificazione UEFA. `status` deve essere `resolved` o `unresolved`. Se non esistono divergenze, lasciare soltanto l’intestazione.

## `aliases.csv`

Intestazione esatta:

```csv
source_name,selected_team_name,source_provider,notes
```

Documentare abbreviazioni e ragioni sociali diverse. Usare nomi calcistici riconoscibili e non confondere società distinte.

## Controlli obbligatori

Il modello deve calcolare realmente:

1. 20 righe dati;
2. rank unici e completi da 1 a 20;
3. 38 partite per ogni squadra;
4. per ogni squadra `wins + draws + losses = played`;
5. per ogni squadra `goals_for - goals_against = goals_diff`;
6. somma vittorie = somma sconfitte;
7. somma gol fatti = somma gol subiti;
8. somma pareggi pari;
9. confronto `3 × wins + draws` con i punti ufficiali;
10. ogni eventuale differenza punti spiegata da penalizzazione documentata;
11. ordine e statistiche verificati su almeno due fonti;
12. qualificazioni UEFA e caso Parma/Torino verificati con una fonte probatoria;
13. retrocessioni verificate.

## `manifest.json`

Usare almeno questa struttura:

```json
{
  "package_type": "season_standings_resolution",
  "area": "season_standings",
  "season": "2013/14",
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

Se resta anche un solo conflitto sostanziale, usare `conflict_review_required`, inserirlo in `discrepancies.csv` e riportarlo in `unresolved_conflicts`.

## `SOURCES.md`

Indicare per ogni fonte:

- titolo e provider;
- URL diretto;
- data di accesso;
- campi verificati.

Creare sezioni specifiche per:

- classifica e statistiche;
- campione e qualificazioni UEFA;
- caso Parma/Torino e licenza UEFA;
- eventuali penalizzazioni;
- retrocessioni;
- pari punti e conflitti tra fonti.

## `source-files/README.md`

Se non si possono includere copie delle pagine, elencare URL, titolo, data di accesso, dati estratti e motivo della mancata inclusione. Non è necessario redistribuire intere pagine HTML.

## Verifica finale

Prima della consegna assicurarsi che:

- lo ZIP e la cartella interna abbiano i nomi richiesti;
- siano presenti tutti i file;
- `data.csv` abbia 20 righe;
- tutti i controlli matematici siano superati;
- lo SHA-256 dichiarato sia reale;
- non siano presenti `TODO`, `UNKNOWN`, checksum fittizi o URL generici;
- nessun dato sia stato modificato solo per far tornare i conti.

## Dove salvare il risultato

Salvare lo ZIP finale in:

`C:\Users\Coppi\Downloads\standings-serie-a-2013-14-resolution.zip`

Non copiarlo direttamente nella cartella del progetto e non modificare il database: il pacchetto verrà prima controllato e poi trasformato in candidato importabile.
