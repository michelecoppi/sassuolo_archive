# Sassuolo Time Machine

La **Sassuolo Time Machine** è il racconto interattivo delle stagioni in homepage. Non introduce un secondo archivio e non contiene statistiche editoriali hard-coded: `GET /api/time-machine` compone soltanto dati già presenti in SQLite, matrice di copertura e `data/club-history.json`.

## Cosa mostra

Per ogni stagione dichiarata dal 2007/08 alla stagione corrente espone:

- campionato principale e altre competizioni presenti nel perimetro;
- piazzamento, partite, vittorie, pareggi, sconfitte, gol e punti;
- fino a tre protagonisti ordinati per gol, assist, presenze e nome;
- migliore vittoria verificata, considerando correttamente gare in casa e in trasferta;
- percorso cumulativo dei punti nelle sole gare del campionato principale;
- allenatore, stadio, palmarès, milestone, copertura e fonti disponibili.

La stagione selezionata è salvata nell'URL con `?era=YYYY%2FYY`. Il componente accetta slider, pulsanti precedente/successiva, tastiera e swipe orizzontale su mobile. Il grafico è SVG nativo; non aggiunge una libreria al bundle e rispetta sia `prefers-reduced-motion` sia la preferenza interna “Riduci animazioni”.

## Regole di composizione

| Campo | Fonte e regola |
| --- | --- |
| Campionato principale | voce con `competition_kind = league` in `data/historical-scope.json`; fallback esplicito alle competizioni Serie A/B/C solo per record fuori perimetro |
| Riepilogo | riga `seasons` del campionato; se manca, derivazione dalle sole partite concluse valide |
| Percorso punti | risultati del campionato in ordine `date, id`; vittoria 3, pareggio 1, sconfitta 0 |
| Protagonisti | somma nullable delle righe `player_seasons` di tutte le competizioni; limite tre |
| Migliore vittoria | margine più alto in tutte le competizioni; spareggi: gol segnati, data più vecchia, ID |
| Milestone e palmarès | elementi con la stessa stagione in `data/club-history.json` |
| Copertura | riga canonica prodotta da `server/services/coverage.ts` per il campionato |
| Verifica | timestamp più recente fra riepilogo, partite e statistiche protagonisti |

Il riepilogo verificato in `seasons` ha priorità sulla ricostruzione da un calendario eventualmente parziale. Per questo il grafico può dichiarare, ad esempio, tre gare ricostruite mentre il riepilogo ufficiale ne riporta 42: i due numeri descrivono perimetri diversi e non vengono nascosti.

## Semantica dei dati assenti

- `NULL` resta `null` nel JSON e `N/D` nell'interfaccia.
- Un valore verificato uguale a zero resta `0`.
- Una stagione dichiarata ma vuota rimane selezionabile.
- Una rosa senza statistiche non produce protagonisti stimati.
- Punteggi negativi, non interi o incompleti non alimentano vittoria e percorso.
- Le gare di coppa possono concorrere alla migliore vittoria, ma non entrano nel grafico punti del campionato.

L'endpoint restituisce anche `methodology`, `coverage.status` e `gapReason`, così altri client possono spiegare lo stesso perimetro senza duplicare le regole del backend.

## File coinvolti

- `server/services/timeMachine.ts`: composizione e regole deterministiche;
- `server/routes/api.ts`: endpoint pubblico `/time-machine`;
- `server/openapi.ts` e `server/openapiRouteManifest.ts`: contratto API e controllo anti-drift;
- `src/components/TimeMachine.tsx`: esperienza responsive e accessibile;
- `src/pages/Club.tsx`: caricamento lazy e isolamento del widget;
- `tests/time-machine.test.ts`: casi realistici, pareggi di ordinamento, casa/trasferta, competizioni e `NULL`;
- `e2e/critical-flows.spec.ts`: navigazione, URL, stagione vuota e overflow mobile.

## Estensioni future

Un nuovo indicatore va prima derivato nel servizio, documentando fonte, perimetro, gestione di `NULL` e spareggio. Il frontend deve limitarsi a renderizzare il contratto. Non aggiungere testi o numeri di una singola stagione direttamente nel componente.
