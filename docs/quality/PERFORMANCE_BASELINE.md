# Baseline paginazione API

Misurazione locale: 11 agosto 2026, 30 richieste per endpoint, cache HTTP disabilitata, risposta JSON inclusa nel tempo. Archivio usato: 765 partite, 335 giocatori, 848 trasferimenti e 809 righe giocatore/stagione.

| Endpoint (50 righe) | p50 | p95 | risposta |
| --- | ---: | ---: | ---: |
| `/matches` | 1,42 ms | 4,09 ms | 45.543 byte |
| `/players` | 3,09 ms | 4,46 ms | 35.816 byte |
| `/transfers` | 1,07 ms | 1,52 ms | 37.552 byte |
| `/manual/matches` | 1,17 ms | 2,46 ms | 45.543 byte |

La misura è ripetibile con `npm run perf:pagination`. Le liste pubbliche e amministrative limitano `pageSize` a 100; filtri, ordinamento e pagina sono applicati prima di `LIMIT/OFFSET`. La dashboard usa l’aggregato dedicato `/dashboard` e non scarica la lista completa delle partite.

## Archivio finale sintetico (PERF-05)

`npm run perf:archive` ricrea ogni volta `.tmp/perf-final-archive.db` con seed deterministico `final-archive-v1`: 20 stagioni, 800 giocatori, 1.200 partite dettagliate, 19.200 eventi, 2.400 formazioni, 26.400 statistiche giocatore/partita e 36.800 riferimenti fonte.

Il file versionato `perf-baseline.json` contiene p95 di riferimento, tolleranza di regressione del 20%, limiti payload e memoria. Il comando fallisce anche se `EXPLAIN QUERY PLAN` non usa gli indici dichiarati per partite stagionali, carriere, eventi, statistiche e fonti. La CI esegue questo gate a ogni push e pull request.

Playwright verifica inoltre `/matches`, `/players`, il dettaglio stagione e il Data Manager sia nel viewport desktop sia mobile: `DOMContentLoaded < 5 s`, caricamento `< 7,5 s`, meno di 5.000 nodi DOM e nessun overflow orizzontale mobile. Sono soglie CI conservative; il benchmark API resta il segnale sensibile per regressioni sul volume finale.

## Baseline frontend Time Machine

Misurazione del 21 agosto 2026: la Sassuolo Time Machine è caricata separatamente dalla pagina Club in un chunk da **14,36 KiB** (**4,56 KiB gzip**) e disegna il percorso con SVG/CSS, senza una nuova dipendenza. Il JavaScript iniziale resta **273,3 KiB su 300 KiB**; il chunk massimo resta **362,5 KiB su 400 KiB**. `e2e/critical-flows.spec.ts` include selezione di stagioni con e senza dati e controllo dell'overflow mobile.

## Baseline frontend Match Cinema

Misurazione del 22 agosto 2026: Match Cinema è un secondo livello lazy del dettaglio partita e produce un chunk autonomo da **22,78 KiB** (**7,37 KiB gzip**). Campo, luci e texture sono SVG/CSS e non aggiungono dipendenze né richieste decorative. Il JavaScript iniziale resta **273,3 KiB su 300 KiB** e il chunk massimo resta Dashboard a **362,5 KiB su 400 KiB**. La matrice E2E copre un racconto `DETAILED`, fallback `BASIC`, collegamento diretto, tastiera, axe e overflow mobile.
