# Richiesta ricerca esterna — classifica Serie B 2009/10

## Obiettivo

Preparare uno ZIP verificabile con la **classifica finale ufficiale della stagione regolare di Serie B 2009/10**, completo di tutte le squadre e pronto per un successivo controllo e importazione nel progetto “Sassuolo History & Stats”. Non hai accesso al codice del progetto: il pacchetto deve rispettare esattamente le istruzioni seguenti.

## Perimetro

- stagione: `2009/10`;
- competizione: `Serie B`;
- classifica della stagione regolare, non riordinata in base ai successivi playoff/playout;
- numero atteso: **22 squadre**;
- partite attese: **42 per squadra**;
- includere posizione, punti ufficiali, record e reti di tutte le squadre, non soltanto il Sassuolo.

Verificare espressamente penalizzazioni, spareggi, promozioni, retrocessioni, esclusioni, fallimenti o mancate ammissioni. Non presumere che i punti ufficiali coincidano con `3 × vittorie + pareggi`: ogni differenza deve essere spiegata da una decisione documentata.

## Fonti minime

Usare almeno due fonti indipendenti:

1. una fonte primaria o archivio autorevole, preferibilmente Lega Serie B, FIGC o comunicati ufficiali archiviati;
2. una fonte statistica specialistica completa, per esempio RSSSF, WorldFootball, calcio-seriea.net o Soccerway.

Wikipedia può servire soltanto come controllo supplementare, mai come unica prova. Per penalizzazioni e decisioni amministrative cercare una fonte ufficiale o una fonte giornalistica contemporanea affidabile. Usare URL diretti alle pagine probatorie, non homepage o risultati di ricerca.

## Domande obbligatorie

La consegna deve rispondere chiaramente a queste domande:

1. Qual è l’ordine ufficiale finale dal 1° al 22° posto?
2. Quali squadre furono promosse direttamente?
3. Quali disputarono i playoff e con quale esito?
4. Quali disputarono i playout e con quale esito?
5. Quali retrocessero direttamente o dopo i playout?
6. Esistettero penalizzazioni? Per ogni caso: squadra, punti sottratti, punti sportivi teorici, punti ufficiali e fonte.
7. Esistettero provvedimenti amministrativi successivi capaci di creare ambiguità tra “retrocesso sul campo” e “non ammesso/escluso”? Documentarli senza alterare la posizione della regular season.
8. In caso di pari punti, qual è l’ordine ufficiale pubblicato? Non inventare criteri di spareggio.

## Struttura dello ZIP

```text
standings-serie-b-2009-10-resolution/
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

Regole dei campi:

- `season`: sempre `2009/10`;
- `competition`: sempre `Serie B`;
- `team_name`: nome calcistico completo e riconoscibile;
- `rank`: posizione ufficiale intera, unica, da 1 a 22;
- `points`: punti ufficiali dopo le penalizzazioni;
- valori sportivi tutti interi; non lasciare celle numeriche vuote;
- `status`: valori applicabili separati da `|`, scegliendo tra `champion`, `promoted`, `playoff`, `playoff_winner`, `playoff_eliminated`, `playout`, `playout_winner`, `playout_loser`, `relegated`, `excluded`, `not_admitted`, `points_deduction`, `none`;
- `description`: spiegazione leggibile di penalizzazioni, spareggi e provvedimenti amministrativi; vuoto soltanto se non c’è nulla da annotare;
- `source_provider`: fonte principale, con eventuale controllo incrociato;
- `source_url`: URL diretto della fonte principale;
- `last_verified_at`: data di verifica `YYYY-MM-DD`.

Gli esiti dei playoff e playout vanno annotati in `status` e `description`, ma non devono cambiare `rank`.

## `discrepancies.csv`

Intestazione esatta:

```csv
team_name,field,source_a_value,source_b_value,source_a_url,source_b_url,resolution,status,notes
```

Registrare ogni conflitto tra fonti su posizione, punti, record, reti, penalizzazioni o verdetti. `status` deve essere `resolved` o `unresolved`. Se non esistono conflitti, lasciare soltanto l’intestazione. Non scegliere silenziosamente una versione.

## `aliases.csv`

Intestazione esatta:

```csv
source_name,selected_team_name,source_provider,notes
```

Inserire le varianti di denominazione incontrate nelle fonti. Non confondere club distinti e non modernizzare una denominazione storica senza documentarlo.

## Controlli obbligatori

Calcolare e documentare nel manifest:

1. esattamente 22 righe;
2. posizioni uniche e complete da 1 a 22;
3. 42 partite per ogni squadra;
4. per ogni squadra, `wins + draws + losses = played`;
5. per ogni squadra, `goals_for - goals_against = goals_diff`;
6. somma vittorie = somma sconfitte;
7. somma gol fatti = somma gol subiti;
8. somma dei pareggi pari;
9. confronto `3 × wins + draws` con i punti ufficiali per tutte le squadre;
10. ogni scarto punti spiegato da penalizzazione documentata;
11. classifica ed esiti verificati su almeno due fonti;
12. nessun conflitto sostanziale rimasto nascosto.

## `manifest.json`

Struttura minima:

```json
{
  "package_type": "season_standings_resolution",
  "area": "season_standings",
  "season": "2009/10",
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

Usare `conflict_review_required` al posto di `reconciled` se rimane anche un solo conflitto sostanziale; descriverlo in `discrepancies.csv` e `unresolved_conflicts`.

## `SOURCES.md` e materiale sorgente

`SOURCES.md` deve riportare per ogni fonte: titolo, provider, URL diretto, data di accesso e campi verificati. Deve inoltre spiegare penalizzazioni, promozioni, playoff, playout, retrocessioni e decisioni amministrative.

Inserire in `source-files/` copie o estratti quando legalmente possibile. Altrimenti, in `source-files/README.md`, indicare per ogni pagina URL, titolo, data di consultazione e dati estratti.

## Condizioni finali di consegna

Prima di creare lo ZIP verificare che:

- tutti i file richiesti siano presenti;
- `data.csv` contenga 22 righe dati;
- non esistano `TODO`, `UNKNOWN`, URL generici o checksum fittizi;
- tutti i controlli matematici siano realmente superati;
- penalizzazioni e provvedimenti amministrativi siano provati da fonti;
- lo SHA-256 dichiarato corrisponda al file reale.

Non modificare valori per far tornare artificialmente i conti: ogni anomalia reale deve essere conservata e spiegata.
