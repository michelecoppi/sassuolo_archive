# Stato pubblico e changelog del dataset

La pagina `/status` rende consultabili lo stato editoriale dell’archivio, l’identità della release dati corrente e una cronologia verificabile. L’endpoint JSON è `/api/status`; `/api/status/feed.xml` offre lo stesso flusso in formato RSS 2.0.

## Cosa viene pubblicato

Ogni voce di `data/releases/changelog.json` dichiara:

- un ID stabile e un tipo tra `release`, `source`, `correction` e `incident`;
- data ISO, titolo e sintesi leggibile;
- almeno un perimetro interessato in `coverage`;
- almeno un collegamento interno o HTTPS che permetta di verificare la modifica;
- per le release, la stessa `releaseVersion` del relativo manifesto dati;
- per gli incidenti, uno stato tra `investigating`, `monitoring` e `resolved`.

Le altre voci usano sempre `published`. Un incidente non risolto porta lo stato generale a “Servizio con limitazioni”; un incidente risolto resta nella cronologia senza degradare lo stato corrente.

## Generare una release

La release e la sua voce pubblica vengono scritte insieme:

```bash
npm run data:release -- \
  --version 2026.08.21.1 \
  --summary "Aggiunte fonti verificate e completata la nuova tranche storica." \
  --coverage "Serie A 2015/16|Partite e formazioni" \
  --link-url "/matches?season=2015%2F16" \
  --link-label "Consulta le partite"
```

`--summary` e `--coverage` sono obbligatori; più perimetri sono separati da `|`. Il comando aggiorna idempotentemente la voce della stessa versione invece di duplicarla. Si possono usare anche `DATA_RELEASE_SUMMARY`, `DATA_RELEASE_COVERAGE`, `DATA_RELEASE_LINK_URL` e `DATA_RELEASE_LINK_LABEL`.

`npm run data:release:check` blocca la CI se:

- il manifesto corrente non compare esattamente una volta nel changelog;
- mancano sintesi, copertura o collegamenti verificabili;
- date, checksum, tipi, stati o ID non rispettano il contratto;
- un collegamento usa un protocollo non ammesso.

## Feed RSS

Impostare `PUBLIC_APP_URL` all’origine pubblica dell’applicazione, senza percorsi aggiuntivi. In locale il valore predefinito è `http://localhost:5173`. Il contenuto del feed è sottoposto allo stesso validatore del JSON e tutti i testi vengono codificati prima della serializzazione XML.

## Regola editoriale

Non creare voci per riempire una categoria vuota. Una nuova fonte va annunciata dopo l’import verificato; una correzione dopo l’applicazione curatoriale; un incidente quando influenza davvero consultazione, aggiornamento o affidabilità dei dati. Le note operative private, i token e i dettagli del database non devono entrare nel changelog pubblico.
