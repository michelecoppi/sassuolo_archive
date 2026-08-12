# Baseline paginazione API

Misurazione locale: 11 agosto 2026, 30 richieste per endpoint, cache HTTP disabilitata, risposta JSON inclusa nel tempo. Archivio usato: 765 partite, 335 giocatori, 848 trasferimenti e 809 righe giocatore/stagione.

| Endpoint (50 righe) | p50 | p95 | risposta |
| --- | ---: | ---: | ---: |
| `/matches` | 1,42 ms | 4,09 ms | 45.543 byte |
| `/players` | 3,09 ms | 4,46 ms | 35.816 byte |
| `/transfers` | 1,07 ms | 1,52 ms | 37.552 byte |
| `/manual/matches` | 1,17 ms | 2,46 ms | 45.543 byte |

La misura è ripetibile con `npm run perf:pagination`. Le liste pubbliche e amministrative limitano `pageSize` a 100; filtri, ordinamento e pagina sono applicati prima di `LIMIT/OFFSET`. La dashboard usa l’aggregato dedicato `/dashboard` e non scarica la lista completa delle partite.
