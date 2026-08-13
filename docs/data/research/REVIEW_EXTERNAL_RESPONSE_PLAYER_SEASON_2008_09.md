# Revisione tecnica — risposta PlayerSeason Sassuolo Serie B 2008/09 respinta

## Esito

La risposta testuale ricevuta **non può essere accettata** e il manifest non può passare a `reconciled`.

Non sono stati consegnati i CSV richiesti né URL puntuali per tutte le affermazioni. Diversi dati dichiarati sono inoltre smentiti dal calendario e dagli elenchi marcatori verificabili.

## Errori certi nella risposta

### 1. Pisa–Sassuolo 0-3 del 21 ottobre 2008 non esiste

Il 21 ottobre 2008 la partita era:

```text
Bari–Sassuolo 0-3
```

Il calendario della Serie B 2008/09 riporta invece:

```text
Sassuolo–Pisa 3-1 — 16 settembre 2008
Pisa–Sassuolo 0-0 — 31 gennaio 2009
```

La presunta “Giornata 8: Pisa–Sassuolo 0-3” e la relativa formazione non possono quindi essere usate.

Fonti di verifica:

- Transfermarkt Sassuolo–Pisa: https://www.transfermarkt.it/us-sassuolo_ac-pisa-1909/index/spielbericht/924235
- cronaca Pisa–Sassuolo 0-0: https://www.nove.firenze.it/a902010027-calcio-serie-b-pisa-sassuolo-0-0-la-cronaca.htm
- ESPN Sassuolo–Pisa: https://www.espn.co.uk/football/match/_/gameId/253657/pisa-sassuolo

### 2. Marcatori di Grosseto–Sassuolo 1-2 errati

La gara del 7 febbraio 2009 è reale, ma l’elenco storico dei gol attribuisce entrambe le reti del Sassuolo ad **Andrea Poli**, al 28' e al 74'. Non risulta un gol di Alessandro Noselli.

Fonti:

- Transfermarkt: https://www.transfermarkt.com/us-grosseto-fc_us-sassuolo/aufstellung/spielbericht/932580
- archivio marcatori Sassuolo 2008/09: http://calcio-seriea.net/gol_segnati/2008/3079/

### 3. La spiegazione dei due gol mancanti è errata

L’archivio marcatori elenca:

```text
57 gol squadra
51 gol su azione
5 gol su rigore
1 autorete
```

Aggregando gli autori si ottiene:

```text
Alessandro Noselli      16
Riccardo Zampagna       11
Emiliano Salvetti        6
Andrea Poli              5
Filippo Pensalfini        4
Horacio Erpen             3
Gaetano Masucci           3
Daniele Martinetti        3
Stefano Pagani            2
Angelo Rea                2
Marco Andreolli           1
totale giocatori         56
autorete Patrice Feussi   1
totale squadra           57
```

WorldFootball e StatsCrew attribuiscono invece 3 gol a Filippo Pensalfini. Il vero divario è pertanto:

```text
55 gol aggregati
+ 1 gol di Filippo Pensalfini omesso dalle tabelle aggregate
+ 1 autorete di Patrice Feussi
= 57 gol squadra
```

La correzione richiesta non riguarda Zampagna o Noselli.

### 4. L’autorete di Feussi è descritta con orientamento errato

L’evento avvenne in:

```text
Sassuolo–Pisa 3-1
16 settembre 2008
Patrice Feussi, Pisa
81'
```

Non in “Pisa–Sassuolo 1-3”.

## Stato reale delle titolarità

WorldFootball e StatsCrew concordano su 440 titolarità, cioè 22 meno delle 462 teoriche. Questo non prova automaticamente che due intere partite siano state escluse.

La formazione proposta per la presunta Pisa–Sassuolo è inutilizzabile perché la partita indicata non esiste. Non è quindi dimostrata la formula `440 + 22 = 462` a livello individuale.

Occorre ancora:

1. identificare quali giocatori coprono le 22 titolarità mancanti;
2. fornire tabellini puntuali reali;
3. spiegare se le colonne `Start` delle due fonti hanno copertura parziale o una semantica diversa;
4. evitare di sommare formazioni senza aggiornare coerentemente presenze e minuti.

## Stato reale di Alberto Pomini

L’affermazione “0 presenze in campionato, 90 minuti in Coppa Italia contro la Reggiana” non è accettabile senza URL puntuale del tabellino.

StatsCrew pubblica 1 presenza, 0 partenze e 90 minuti; WorldFootball non include Pomini. Servono ancora:

- URL della partita di Coppa Italia citata;
- formazione o tabellino che mostri Pomini;
- conferma indipendente che non abbia giocato in Serie B;
- spiegazione dell’attribuzione StatsCrew.

## Nuova consegna richiesta

Non ricostruire l’intero pacchetto. Consegnare:

```text
player-season-2008-09-final-followup/
  starts-resolution.csv
  pensalfini-goal-resolution.csv
  feussi-own-goal-resolution.csv
  pomini-resolution.csv
  SOURCES.md
  manifest.json
```

### `starts-resolution.csv`

```csv
date,home_team,away_team,player_name,starter,source_provider,source_url,confirmation_url,last_verified_at,note
```

Inserire esclusivamente titolarità dimostrate da tabellini reali. Spiegare esattamente come si passa da 440 a 462 e quali valori individuali devono cambiare.

### `pensalfini-goal-resolution.csv`

```csv
player_name,aggregate_goals,verified_goals,missing_goal_date,home_team,away_team,minute,source_provider,source_url,confirmation_url,last_verified_at,note
```

Individuare quale dei quattro gol di Filippo Pensalfini è omesso dalle tabelle aggregate e fornire il relativo tabellino puntuale.

### `feussi-own-goal-resolution.csv`

```csv
date,home_team,away_team,home_score,away_score,player_name,player_team,event_type,minute,source_provider,source_url,confirmation_url,last_verified_at,note
```

Valore atteso da verificare: `2008-09-16,Sassuolo,Pisa,3,1,Patrice Feussi,Pisa,opponent_own_goal,81'`.

### `pomini-resolution.csv`

```csv
player_name,date,competition,home_team,away_team,appearance,starter,minutes,source_provider,source_url,confirmation_url,last_verified_at,resolution,note
```

## Condizione per `reconciled`

Il manifest può diventare `reconciled` soltanto quando:

- le 22 titolarità mancanti sono attribuite con tabellini puntuali e senza contraddire presenze/minuti;
- il quarto gol di Pensalfini è identificato puntualmente;
- l’autorete di Feussi è documentata correttamente;
- il caso Pomini è provato da fonti e non soltanto dichiarato;
- non restano conflitti individuali aperti.

Fino ad allora mantenere `conflict_review_required`.
