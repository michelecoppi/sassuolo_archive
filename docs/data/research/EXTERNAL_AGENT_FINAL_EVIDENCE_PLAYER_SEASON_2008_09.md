# Ultime evidenze richieste — PlayerSeason Sassuolo Serie B 2008/09

## Stato acquisito

Non ricostruire tabelle, rose o calendari. Sono già verificati:

- 42 partite di Serie B;
- 24 giocatori WorldFootball e 25 StatsCrew;
- 440 partenze da titolare pubblicate da entrambe le fonti aggregate;
- 55 gol giocatore aggregati;
- 57 gol squadra;
- l’archivio calcio-seriea.net elenca 56 gol giocatore e 1 autorete.

Il follow-up precedente è correttamente rimasto `conflict_review_required`. Servono soltanto prove indipendenti sui punti seguenti.

## 1. Quarto gol di Filippo Pensalfini

L’archivio calcio-seriea.net gli attribuisce quattro reti:

1. Frosinone–Sassuolo 2-2, 6 dicembre 2008, 11';
2. Frosinone–Sassuolo 2-2, 6 dicembre 2008, 74';
3. Sassuolo–Salernitana 1-0, 24 gennaio 2009, 74';
4. Empoli–Sassuolo 3-2, 21 marzo 2009, 45+1'.

StatsCrew e WorldFootball ne pubblicano tre.

Per ciascuna delle quattro reti trovare almeno una fonte **indipendente da calcio-seriea.net**. È sufficiente una delle seguenti:

- referto Lega Serie B/FIGC;
- Transfermarkt match report;
- ESPN/Soccerway/BeSoccer;
- cronaca giornalistica contemporanea con marcatori.

Consegna una tabella testuale o CSV:

```csv
date,home_team,away_team,result,player_name,minute,source_provider,source_url,last_verified_at
```

## 2. Feussi oppure Masucci in Sassuolo–Pisa 3-1

Conflitto attuale:

- calcio-seriea.net: autorete di Patrice Feussi all’81';
- Transfermarkt: gol di Gaetano Masucci.

Trovare una **terza fonte indipendente** che riporti esplicitamente l’autore del 3-1:

```text
Sassuolo–Pisa 3-1
16 settembre 2008
terza rete Sassuolo, 81'
```

Non basta un riepilogo del risultato. La fonte deve nominare Feussi/autorete oppure Masucci.

Fonti prioritarie: referto Lega Serie B, cronaca contemporanea, ESPN con marcatori, archivio ufficiale Sassuolo/Pisa.

## 3. Presenza di Alberto Pomini

StatsCrew e Wikipedia indicano una presenza in Serie B, mentre WorldFootball non lo elenca. Trovare la partita esatta.

Serve un tabellino che riporti:

- data e avversario;
- Pomini titolare, subentrato o espulso/sostituito;
- minuti giocati, se disponibili;
- URL puntuale.

Controllare in particolare le due partite nelle quali Walter Bressan non risulta titolare, senza assumere che siano Sassuolo–Pisa e Pisa–Sassuolo.

Se la presenza appartiene invece alla Coppa Italia, fornire il tabellino che lo dimostra e spiegare perché StatsCrew la include nella Serie B.

## 4. Significato delle 440 titolarità

Non sommare automaticamente due formazioni complete alle statistiche individuali.

Occorre determinare una delle seguenti conclusioni, con prova:

- `coverage_gap`: le fonti aggregate omettono esattamente due gare; indicare quali e mostrare il confronto individuale prima/dopo;
- `field_semantics`: la colonna Start non rappresenta tutte le titolarità della regular season;
- `source_error`: il totale è errato e non correggibile puntualmente.

La risposta deve spiegare perché Walter Bressan ha 40 partenze su 42 gare e chi iniziò in porta le altre due.

## Consegna

Non serve uno ZIP se non ci sono nuovi file. È sufficiente una risposta con:

1. URL indipendenti dei quattro gol di Pensalfini;
2. terza fonte sul gol Feussi/Masucci;
3. tabellino della presenza di Pomini;
4. identità dei portieri titolari nelle 42 gare;
5. conclusione documentata sulle 440 partenze.

Se una prova non esiste o non è reperibile, dichiararlo. In quel caso importeremo soltanto i campi verificabili e lasceremo `starts`/dato controverso vuoto, come previsto dalle regole del progetto.
