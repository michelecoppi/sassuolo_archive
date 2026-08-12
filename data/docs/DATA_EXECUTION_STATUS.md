# Stato di esecuzione del piano dati

Aggiornamento: 12 agosto 2026, dopo l'import della Coppa Italia 2014/15.

## Contesto stagionale generale — tranche 2024/25

È registrato il candidato `season-context-serie-b-2024-25`, limitato a una stagione e una competizione. Contiene Domenico Berardi come capitano della Serie B 2024/25, attestato dalla Lega Serie B e verificato sul sito ufficiale del club. Lo staff tecnico 2024/25 è stato aggiunto all'archivio strutturato e viene ora mostrato nella scheda stagione insieme agli intervalli degli allenatori già presenti.

Il candidato è `imported`: Domenico Berardi conserva 29 presenze e 6 gol e ha `captain=1`. L'import è stato protetto dal backup #59 e l'importatore preserva con `COALESCE` tutte le statistiche non incluse nella tranche.

Le Coppe Italia 2013/14 e 2014/15 sono importate con fonti incrociate. Il checkout ufficiale OpenFootball verificato contiene `cup.txt` soltanto dal 2020/21 al 2024/25, correggendo la precedente indicazione di copertura dal 2013/14. Le edizioni 2015/16–2019/20 e 2008/09–2012/13 richiedono quindi fonti storiche alternative e riconciliazioni separate.

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

Alla prossima sessione non ricominciare dalle classifiche, dal contesto 2024/25, dai match-details Serie B 2008/09 o dalle Coppe Italia 2013/14–2014/15. La prossima tranche consigliata è **Coppa Italia 2015/16** con fonti alternative incrociate; in alternativa proseguire sui dettagli strutturati delle gare storiche.

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
- Serie B 2008/09: pacchetto `match-details`, 42 partite importate.
- Coppa Italia 2013/14: 2 fixture importate, backup #68, import run #34, 22 riferimenti di provenienza; ZIP `data/reconciliation/packages/matches-coppa-italia-2013-14.zip` con checksum affiancato.
- Coppa Italia 2014/15: 3 fixture STANDARD importate, backup #72, import run #36, 49 riferimenti di provenienza; aggregato stagionale 3 gare, 2 vittorie, 1 sconfitta, 6–3 gol e Nicola Sansone capocannoniere (3), backup #73, import run #37 e 11 riferimenti. I nove gol sono ora eventi strutturati; i tre di Sansone puntano al giocatore canonico #3312 e la sua PlayerSeason di coppa conserva `goals=3` con le altre statistiche non note a `NULL` (backup #74, import run #38, 10 riferimenti). ZIP fixture ed eventi con checksum affiancati sotto `data/reconciliation/packages/`.

## Audit conclusivo

- Audit run: `#30`.
- Generato: `2026-08-12T16:23:07.534Z`.
- Report: `data/reconciliation/audits/audit-full-2026-08-12T16-23-07-534Z.json`.
- SHA-256: `3db446ea001f3a5af407b860b8cf38a1752caaac70083cd652f841492f707f59`.
- Esito: nessuna violazione FK, fixture duplicata, PlayerSeason invalida, evento invalido o trasferimento duplicato; nessun problema bloccante.
- Unico conflitto registrato: risolto.
- Residuo non bloccante: tre news RSS con lo stesso titolo normalizzato.

Conteggi principali al checkpoint: 770 partite, 336 giocatori canonici, 809 PlayerSeason, 350 righe classifica, 848 trasferimenti, 26 candidati censiti, 73 backup e 29 audit.

## Copertura e lavoro ancora aperto

- Le 14 classifiche della tranche 2008/09–2021/22 sono complete.
- Le cinque stagioni di Serie B 2008/09–2012/13 hanno 42/42 partite e PlayerSeason riconciliate; il 2008/09 ha anche stadio e arbitro per 42/42, mentre le stagioni successive non hanno ancora dettagli partita strutturati.
- Le stagioni Serie A 2013/14–2021/22 hanno 38/38 partite e classifica completa, ma dettagli, formazioni e statistiche partita sono quasi interamente assenti.
- Le Coppe Italia 2013/14 e 2014/15 sono complete a livello fixture; per il 2014/15 sono presenti anche parziali, marcatori, stadi, arbitri, presenze e gli angoli disponibili. Le edizioni 2015/16–2019/20 e 2008/09–2012/13 richiedono fonti storiche alternative e restano da ricercare/importare sistematicamente.
- Le 837 righe trasferimenti sono presenti, ma la provenienza puntuale resta da migliorare.
- Non trasformare valori sconosciuti in zero: `N/D` deve restare `NULL` finché non esiste una fonte verificabile.

## Procedura per riprendere

1. Aprire questo file e l'ultimo audit indicato sopra.
2. Eseguire `npm.cmd run data:registry` per riallineare i candidati presenti su disco.
3. Scegliere una sola nuova tranche, preferibilmente Coppa Italia 2015/16 o `match_details` Serie B 2009/10.
4. Preparare un pacchetto candidato con `data.csv`, `manifest.json`, `SOURCES.md` e discrepanze esplicite.
5. Seguire `validate → review → approve → backup → import → audit` dal Data Manager.

## Note tecniche

- I documenti `DATA_*` sono ordinati sotto `data/docs/`; il test automatico impedisce che tornino nella root.
- La fonte autorevole per gli stati operativi è SQLite: `research_candidates`, `import_runs`, `audit_runs` e `backup_runs`.
- La cartella `data/reconciliation/candidates/` conserva i pacchetti riproducibili anche dopo l'import.
