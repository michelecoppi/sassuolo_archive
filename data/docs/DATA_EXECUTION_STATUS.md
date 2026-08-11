# Stato di esecuzione del piano dati

Aggiornamento: 10 agosto 2026, dopo l'import della classifica Serie A 2021/22.

## Allineamento piattaforma P0 — 11 agosto 2026

La ricerca storica resta un processo separato e incrementale. La procedura autorevole è [`research/GUIDA_AUTONOMA_RICERCA_E_IMPORT.md`](research/GUIDA_AUTONOMA_RICERCA_E_IMPORT.md): una sola tranche per volta, pacchetto ZIP riproducibile, revisione, checksum, backup, import e audit. Non avviare nuovamente la tranche PlayerSeason Serie B 2008/09–2012/13, già conclusa; il prossimo lavoro consigliato resta il dettaglio partita storico o la Coppa Italia.

La piattaforma di supporto è stata portata allo schema versione 5:

- matrice canonica generata dal database e condivisa da API `/coverage`, Metodologia, Data Manager e audit completo;
- 18.348 riferimenti campo-per-campo ricostruiti esclusivamente dai metadati già presenti, con backup verificato `#57` prima del backfill;
- conflitti con motivazione, revisore, timestamp, riapertura e change log;
- backup con integrità SQLite, SHA-256, dimensione, conferma esplicita e snapshot di sicurezza prima del restore;
- migrazioni versionate, autenticazione delle scritture in produzione, rate limit, audit di sicurezza e pipeline CI bloccante;
- dataset golden di regressione per H2H, streak, competizioni e semantica `NULL`.

Audit di verifica: run `#24`, `2026-08-11T14:08:58.013Z`, zero problemi bloccanti e zero conflitti aperti. Report: `data/reconciliation/audits/audit-full-2026-08-11T14-08-58-013Z.json`.

## Punto di ripartenza

La tranche **PlayerSeason Serie B 2008/09–2012/13** e la tranche **classifiche storiche 2008/09–2021/22** sono concluse. Tutti i pacchetti elencati sotto risultano `imported` nel database e dispongono di backup pre-import.

Alla prossima sessione non ricominciare dalle classifiche già trattate. La priorità consigliata è la copertura storica dei **dettagli partita** (eventi, formazioni e statistiche), iniziando dalla Serie B 2008/09; in alternativa si può completare la Coppa Italia storica.

## Importazioni completate

### PlayerSeason — Serie B

| Stagione | Righe importate | Stato |
| --- | ---: | --- |
| 2008/09 | 25 | imported, reconciled |
| 2009/10 | 27 | imported, reconciled |
| 2010/11 | 33 | imported, reconciled |
| 2011/12 | 27 | imported, reconciled |
| 2012/13 | 23 | imported, reconciled |

Le riconciliazioni comprendono i gol/autogol discussi durante la revisione. Per il 2012/13, 76 gol attribuiti ai giocatori più gli autogol avversari di Alex Valentini e Carlo Alberto Ludi riconciliano i 78 gol di squadra.

### Classifiche complete

| Competizione | Stagioni | Righe |
| --- | --- | ---: |
| Serie B | 2008/09–2012/13 | 110 (22 per stagione) |
| Serie A | 2013/14–2021/22 | 180 (20 per stagione) |

Il database contiene inoltre classifiche complete già presenti per Serie A 2022/23 e 2023/24 e Serie B 2024/25. Il totale attuale di `season_standings` è 350 righe.

### Altri pacchetti

- Europa League 2016/17: pacchetto `match-details`, 10 partite importate.

## Audit conclusivo

- Audit run: `#22`.
- Generato: `2026-08-10T01:48:15.776Z`.
- Report: `data/reconciliation/audits/audit-full-2026-08-10T01-48-15-776Z.json`.
- SHA-256: `fd0ec2c0fa6a59509572d1d3a5780b5d10ffde4025eee42575c5c0856fad5a65`.
- Esito: nessuna violazione FK, fixture duplicata, PlayerSeason invalida, evento invalido o trasferimento duplicato; nessun problema bloccante.
- Unico conflitto registrato: risolto.
- Residuo non bloccante: tre news RSS con lo stesso titolo normalizzato.

Conteggi principali al checkpoint: 726 partite, 469 giocatori, 808 PlayerSeason, 350 righe classifica, 837 trasferimenti, 22 candidati censiti, 20 candidati importati, 35 backup e 22 audit.

## Copertura e lavoro ancora aperto

- Le 14 classifiche della tranche 2008/09–2021/22 sono complete.
- Le cinque stagioni di Serie B 2008/09–2012/13 hanno 42/42 partite e PlayerSeason riconciliate, ma non hanno ancora dettagli partita strutturati.
- Le stagioni Serie A 2013/14–2021/22 hanno 38/38 partite e classifica completa, ma dettagli, formazioni e statistiche partita sono quasi interamente assenti.
- Le competizioni di Coppa Italia precedenti al 2020/21 restano da ricercare/importare in modo sistematico.
- Le 837 righe trasferimenti sono presenti, ma la provenienza puntuale resta da migliorare.
- Non trasformare valori sconosciuti in zero: `N/D` deve restare `NULL` finché non esiste una fonte verificabile.

## Procedura per riprendere

1. Aprire questo file e l'ultimo audit indicato sopra.
2. Eseguire `npm.cmd run data:registry` per riallineare i candidati presenti su disco.
3. Scegliere una sola nuova tranche, preferibilmente `match_details` Serie B 2008/09.
4. Preparare un pacchetto candidato con `data.csv`, `manifest.json`, `SOURCES.md` e discrepanze esplicite.
5. Seguire `validate → review → approve → backup → import → audit` dal Data Manager.

## Note tecniche

- I documenti `DATA_*` sono ordinati sotto `data/docs/`; il test automatico impedisce che tornino nella root.
- La fonte autorevole per gli stati operativi è SQLite: `research_candidates`, `import_runs`, `audit_runs` e `backup_runs`.
- La cartella `data/reconciliation/candidates/` conserva i pacchetti riproducibili anche dopo l'import.
