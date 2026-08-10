# Revisione pacchetto PlayerSeason 2012/13

Pacchetto ricevuto: `player-season-2012-13-resolution.zip`, 9 agosto 2026. Nessun import eseguito.

## Esito

**Candidato valido tecnicamente, ma non riconciliato e non approvabile per l'import.**

## Controlli superati

- ZIP senza percorsi anomali;
- struttura richiesta presente: `data.csv`, `discrepancies.csv`, `manifest.json`, `SOURCES.md`;
- SHA-256 dichiarato e reale di `data.csv`: `e69d129c72bcca74bf447a183246abd197dd0b49300f4414ede1f6c35e0d437f`;
- 23 righe dichiarate e 23 effettive;
- tutte le righe `2012/13 · Serie B`;
- nessun giocatore duplicato nel file;
- nessuna riga senza URL fonte;
- valori numerici formalmente validi;
- somma gol giocatori: 76;
- dry-run database: 1 creazione, 22 aggiornamenti, 0 skip, 0 conflitti manuali, 0 errori strutturali.

## Evidenza nuova utile

Il pacchetto documenta un autogol avversario:

- Carlo Alberto Ludi, Novara–Sassuolo 3–2 del 6 aprile 2013, indicato come autogol al 31'.

Questo spiega una unità della differenza fra 76 gol attribuiti ai giocatori Sassuolo e 78 gol di squadra.

## Blocchi ancora aperti

1. Il secondo gol della differenza non è identificato.
2. `manifest.validation.status` è `candidate`, non `reconciled`.
3. Il manifest stesso ordina di non importare il pacchetto come finale.
4. `discrepancies.csv` contiene 13 righe in stato `source_conflict` o `unverified`.
5. La seconda fonte ESPN mostra presenze incompatibili e non è accettata come sostituzione.
6. `records_discarded=3`, ma una delle ragioni riguarda un gol non attribuito e non una riga scartata: il conteggio/scopo andrebbe chiarito.
7. Il contenuto statistico di `data.csv` non risolve il candidato precedente: aggiunge soprattutto documentazione e riordina le colonne.

## Informazione richiesta per chiudere

Serve identificare il secondo gol tramite una fonte puntuale. La consegna successiva deve includere:

- partita e data;
- marcatore o autore dell'autogol;
- minuto, se pubblicato;
- URL diretto o referto/PDF;
- spiegazione del perché il gol è incluso nei 78 gol squadra ma non nei 76 attribuiti;
- aggiornamento di `discrepancies.csv` da `unverified` a `resolved`;
- `manifest.validation.status = reconciled`;
- nuovo checksum di `data.csv` solo se il file cambia.

Se dopo una verifica partita-per-partita una fonte affidabile dimostra che StatsCrew ha semplicemente un errore di attribuzione, il conflitto deve restare dichiarato con entrambe le fonti; non va corretto per deduzione.
