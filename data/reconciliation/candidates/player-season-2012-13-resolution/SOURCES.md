# PlayerSeason Serie B 2012/13 - resolution notes

## Perimetro

Questa consegna copre solo U.S. Sassuolo Calcio, stagione `2012/13`, competizione `Serie B`.

Non include Coppa Italia, playoff o amichevoli. I valori mancanti non sono stimati e non sono sostituiti con `0`.

## Fonti consultate

- StatsCrew, `2012-13 Sassuolo Calcio Statistics`: https://www.statscrew.com/worldfootball/stats/t-SASCA963/y-2012
- FBref, `2012-2013 Sassuolo Stats`: https://fbref.com/en/squads/e2befd26/2012-2013/Sassuolo-Stats
- ESPN squad page, `Sassuolo 2012-13 Italian Serie B Squad`: https://www.espn.com/soccer/team/squad/_/id/3997/league/ITA.2/season/2012
- ESPN match page, `Novara 3-2 Sassuolo`, gameId `353056`: https://www.espn.com/soccer/match/_/gameId/353056/sassuolo-novara
- BeSoccer event page, `Novara vs Sassuolo - Serie B 2012/13`: https://www.besoccer.com/match/novara-calcio/us-sassuolo-calcio/2013228821/events/
- ESPN match page, `Sassuolo 2-1 Crotone`, gameId `353413`: https://www.espn.com/soccer/match/_/gameId/353413/crotone-sassuolo
- ESPN match page, `Sassuolo 2-1 Pro Vercelli`, gameId `353397`: https://www.espn.com.au/football/match/_/gameId/353397/pro-vercelli-sassuolo
- Transfermarkt match report, `Sassuolo-Pro Vercelli`: https://www.transfermarkt.com/us-sassuolo_fc-pro-vercelli-1892/index/spielbericht/2259719
- BeSoccer match page, `Sassuolo-Pro Vercelli`: https://fr.besoccer.com/match/us-sassuolo-calcio/us-pro-vercelli-calcio/2013228480

## Conteggio gol

StatsCrew riporta per il Sassuolo 2012/13:

- record campionato: 25 vittorie, 10 pareggi, 7 sconfitte;
- punti: 85;
- gol squadra: 78;
- gol subiti: 40.

FBref, nella pagina stagione Sassuolo 2012/13, conferma il riepilogo di squadra con `Goals: 78` e `Goals Against: 40`.

La somma dei gol nelle 23 righe giocatore di StatsCrew e' invece `76`.

## Autogol e gol non attribuiti

Un gol del divario e' spiegato da un autogol avversario:

- `2013-04-06`, `Novara 3-2 Sassuolo`: Carlo Alberto Ludi, autogol al 31'. ESPN indicizza il match con `Carlo Alberto Ludi - 31' OG`; BeSoccer espone l'evento come `C. Ludi Own goal`.

Questo autogol conta nei gol squadra del Sassuolo ma non nei gol dei giocatori Sassuolo.

Il secondo gol del divario è anch'esso un autogol avversario:

- `2012-09-15`, `Sassuolo 2-1 Pro Vercelli`: Alex Valentini, autogol al 38'. La pagina ESPN mostra nel tabellino `Alex Valentini - 38' OG`; Transfermarkt e BeSoccer sono conservati come riferimenti di supporto.

La riconciliazione è quindi completa: `76` gol attribuiti ai giocatori Sassuolo + `2` autogol avversari = `78` gol squadra. Nessuno dei due autogol deve aumentare i gol individuali dei giocatori Sassuolo.

Nota: `Sassuolo 2-1 Crotone`, `2012-09-01`, contiene un autogol di Simone Missiroli al 90'+1' secondo ESPN/BeSoccer. Essendo autogol di un giocatore del Sassuolo a favore del Crotone, non spiega il divario dei gol a favore del Sassuolo.

## Valutazione della seconda fonte giocatore

ESPN e' stata trovata come seconda fonte riproducibile con pagina rosa Sassuolo `2012-13` e campi presenze/gol/assist/cartellini. Tuttavia, l'HTML accessibile mostra valori di presenza fortemente incompatibili con StatsCrew per molti giocatori, per esempio:

- Alberto Pomini: StatsCrew 41 presenze, ESPN accessibile 4;
- Alessandro Longhi: StatsCrew 41 presenze, ESPN accessibile 9;
- Emanuele Terranova: StatsCrew 37 presenze, ESPN accessibile 17;
- Francesco Magnanelli: StatsCrew 40 presenze, ESPN accessibile 13.

Per questo motivo ESPN viene registrata come fonte consultata e conflittuale, non come base di sostituzione.

## Decisione candidata

`data.csv` conserva il candidato StatsCrew per le 23 righe giocatore, perche':

- fornisce presenze, titolarita', minuti, gol, assist e cartellini;
- il totale gol giocatore e' internamente calcolabile e pari a `76`;
- il totale squadra `78` e' coerente con FBref;
- almeno un gol del divario e' spiegato da autogol avversario documentato.

La consegna è `reconciled` per la discrepanza gol. Le differenze della tabella rosa ESPN restano documentate come motivo di esclusione di quella fonte, non come valori alternativi da importare.

## Risposte esplicite alle domande del mandato

1. Totale corretto dei gol Sassuolo in campionato: `78`, confermato da StatsCrew e FBref.
2. Il totale squadra include almeno un autogol avversario documentato; per definizione i gol a favore in classifica includono gli autogol avversari.
3. I due gol mancanti dalla tabella StatsCrew sono gli autogol avversari di Alex Valentini in Sassuolo-Pro Vercelli e Carlo Alberto Ludi in Novara-Sassuolo.
4. Entrambi sono autogol avversari a favore del Sassuolo e non vanno attribuiti a un giocatore Sassuolo.
5. Le differenze fra StatsCrew ed ESPN sono registrate in `discrepancies.csv` per i casi principali; ESPN non e' accettata come fonte sostitutiva perche' l'HTML accessibile appare incompleto/incoerente.
6. StatsCrew e FBref indicano la stagione di campionato Serie B; `data.csv` non include Coppa Italia o playoff.

## Record esclusi

- Simone Perilli, Raffaele Conforto e Davide Luppi compaiono nella pagina ESPN accessibile ma senza statistiche affidabili pubblicate; esclusi da `data.csv` per evitare righe non verificabili.
