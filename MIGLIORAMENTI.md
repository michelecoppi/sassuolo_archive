# Roadmap miglioramenti — Sassuolo History & Stats

Ultimo riordino: 11 agosto 2026.

Questo documento è la fonte operativa per ciò che manca al progetto. Le voci non ancora concluse sono ordinate per priorità e area; quelle terminate sono raccolte in fondo per non confondere il lavoro futuro con quanto è già disponibile.

## Quando l'applicativo può dirsi davvero completo

Il progetto ha raggiunto il vero salto di qualità quando:

- ogni stagione e competizione dichiarata ha una copertura misurabile, fonti consultabili e lacune esplicite;
- ogni numero mostrato è riconducibile alla fonte e alla regola di calcolo, senza trasformare dati mancanti in zeri;
- import, correzioni, conflitti, backup e ripristino sono ripetibili e verificabili;
- archivio storico, stagione corrente, ricerca, confronti e schede di dettaglio formano un'esperienza coerente anche su mobile e con tecnologie assistive;
- test, audit, sicurezza, prestazioni e monitoraggio permettono una pubblicazione affidabile.

## Legenda e regole di stato

- **P0 — bloccante:** affidabilità, perdita dati, sicurezza o impossibilità di pubblicare.
- **P1 — essenziale:** contenuto o funzione necessaria per considerare completo il prodotto.
- **P2 — importante:** qualità d'uso, prestazioni e operatività.
- **P3 — evolutivo:** rifinitura o ampliamento successivo.
- `[ ]` indica lavoro non concluso; `[x]` indica lavoro verificato e spostato nella sezione **Completati**.
- Gli ID sono permanenti: non riutilizzarli e non rinumerarli.

Una voce è conclusa solo se soddisfa il relativo criterio di accettazione, non soltanto perché esiste una pagina o una prima implementazione.

## Da fare

### P0 — integrità dei dati e pubblicazione affidabile

- [ ] **DATA-01 — Proseguire il completamento storico una tranche alla volta (processo continuativo, escluso dalla tranche tecnica P0).** PlayerSeason Serie B 2008/09–2012/13, classifiche 2008/09–2021/22, contesto/capitano 2024/25, match-details Serie B 2008/09 e fixture Coppa Italia 2013/14–2014/15 risultano già concluse: non ripeterle. Ripartire dalla Coppa Italia 2015/16 o da dettagli partita strutturati seguendo [`data/docs/DATA_EXECUTION_STATUS.md`](data/docs/DATA_EXECUTION_STATUS.md) e [`data/docs/research/GUIDA_AUTONOMA_RICERCA_E_IMPORT.md`](data/docs/research/GUIDA_AUTONOMA_RICERCA_E_IMPORT.md). **Stato parziale 12 agosto 2026:** `matches-coppa-italia-2014-15` importato con backup #72, 3 fixture STANDARD e 49 riferimenti di provenienza; aggregato stagionale con backup #73 e 11 riferimenti; nove gol strutturati e Nicola Sansone collegato al giocatore canonico #3312 con backup #74, import run #38 e 10 riferimenti. Pacchetti ZIP/checksum disponibili; audit run #30 concluso senza errori bloccanti, duplicati o conflitti. OpenFootball contiene `cup.txt` soltanto dal 2020/21, quindi le edizioni precedenti richiedono fonti alternative incrociate. **Accettazione per ogni tranche:** un solo perimetro stagione/competizione, pacchetto ZIP riproducibile, manifest e checksum, fonti puntuali, discrepanze risolte, preview approvata, backup, import idempotente e audit senza regressioni. `Owner: processo dati separato`

### P1 — completezza dell'archivio storico


### P1 — esperienza utente e scoperta dei contenuti

- [x] **UX-03 — Potenziare ricerca e navigazione esplorativa.** La ricerca globale tollera refusi e alias censiti, si apre con `Ctrl/Cmd+K` o `/`, conserva le cinque ricerche recenti e applica filtri trasversali per anno iniziale/finale e competizione. I link a giocatore, stagione, partita e avversario mantengono query, filtri e pagina di provenienza nel contesto URL. **Completato: 2026-08-11 · Evidenza:** `server/routes/api.ts`, `src/components/GlobalSearch.tsx`, `tests/ux-enhancements.test.ts` · **Verifica:** check, 54 test, build e prova browser del refuso “Beradi” a 390 px senza overflow.
- [x] **UX-04 — Evolvere i confronti.** Giocatori e stagioni espongono valori assoluti e normalizzati per 90 minuti, presenza o partita, filtro competizione, copertura, data di verifica e avviso esplicito sui perimetri non omogenei. Selezioni e competizione restano nell'URL; la pagina include definizioni delle formule e collegamenti ai profili correlati. **Completato: 2026-08-11 · Evidenza:** `server/routes/api.ts`, `src/pages/Compare.tsx`, `tests/ux-enhancements.test.ts` · **Verifica:** check, 54 test, build e confronto browser Berardi–Defrel in Serie A con azioni export e console pulita.
- [x] **UX-05 — Rendere esportabili le viste.** Giocatori, Partite e Confronti offrono CSV/JSON della vista filtrata e ordinata, stampa e copia del link condivisibile. Ogni export dichiara filtri, ordinamento, URL, provider fonte, unità, data ISO di generazione e conserva i dati assenti come `NULL`; il riepilogo metadati compare anche in stampa. **Completato: 2026-08-11 · Evidenza:** `src/components/ViewActions.tsx`, `src/pages/Players.tsx`, `src/pages/Matches.tsx`, `src/pages/Compare.tsx`, `src/index.css`, `tests/ux-enhancements.test.ts` · **Verifica:** check, 54 test, build e controllo browser desktop/mobile delle quattro azioni senza overflow.

### P2 — import, amministrazione e qualità operativa

- [x] **ADM-01 — Completare import preview e validazione.** L’anteprima espone mapping origine/campo canonico, esito e azione per riga, valide/scartate, duplicati, conflitti e impatto; il contenuto è correggibile nel Data Manager e può essere rieseguito prima dell’applicazione con checksum, backup e blocco dei contenuti già importati. **Completato: 2026-08-11 · Evidenza:** `server/services/controlledImport.ts`, `src/pages/DataManager.tsx`, `tests/controlled-import.test.ts`.
- [x] **ADM-02 — Creare una dashboard qualità dati.** Lacune, conflitti, identità sospette, fonti obsolete e stagioni incomplete sono ordinate per severità e arricchite con stato persistente, responsabile, nota, azione suggerita e link al record/flusso interessato. **Completato: 2026-08-11 · Evidenza:** `server/db/database.ts`, `server/routes/api.ts`, `src/pages/DataManager.tsx`, `tests/admin-enhancements.test.ts`.
- [x] **ADM-03 — Automatizzare sync e aggiornamenti controllati.** I job persistenti per partite correnti, rosa e news usano chiavi d’idempotenza, lease/lock atomico, retry con backoff esponenziale, soglia quota, storico esecuzioni e avvisi azionabili; lo scheduler parte con l’API e può essere gestito dal Data Manager. **Completato: 2026-08-11 · Evidenza:** `server/services/syncScheduler.ts`, `server/services/adminScheduler.ts`, `server/index.ts`, `tests/admin-enhancements.test.ts`.
- [x] **ADM-04 — Documentare il contratto API.** `/api/openapi.json` pubblica OpenAPI 3.1 con versione, schemi, filtri, limiti/paginazione, errori ed esempi; il client TypeScript usa Zod ed è verificato contro l’app Express reale con `npm run test:api-contract`. **Completato: 2026-08-11 · Evidenza:** `server/openapi.ts`, `src/services/adminApiClient.ts`, `tests/admin-enhancements.test.ts`.

### P2 — prestazioni e robustezza frontend


### P3 — rifinitura e diffusione

- [ ] **POLISH-01 — Migliorare condivisione e indicizzazione.** Aggiungere title/description specifici, Open Graph, sitemap e dati strutturati dove appropriati. **Accettazione:** schede giocatore, stagione e partita generano anteprime comprensibili e URL canonici.
- [ ] **POLISH-02 — Preparare localizzazione e formati.** Centralizzare testi, date, numeri e nomi delle competizioni, mantenendo l'italiano come lingua primaria. **Accettazione:** nessun formato locale è hardcoded nei componenti principali e una seconda lingua può essere aggiunta senza riscriverli.
- [ ] **POLISH-04 — Creare una pagina stato e changelog pubblico.** Comunicare aggiornamenti del dataset, nuove fonti, correzioni e incidenti. **Accettazione:** ogni release dati ha data, sintesi, copertura interessata e collegamento alle modifiche verificabili.

## Completati

Le voci seguenti risultavano già completate al momento del riordino. Mantenerle come storico sintetico; se una regressione le rende nuovamente incomplete, creare una nuova voce con un nuovo ID nella sezione **Da fare** e collegarla a quella originaria.

### Dati, import e affidabilità

- [x] **DATA-02 — Matrice di copertura canonica.** Un'unica matrice generata dai dati reali alimenta API `/coverage`, pagina Metodologia, Data Manager e audit completo. **Completato: 2026-08-11 · Evidenza:** `server/services/coverage.ts`, `src/pages/Methodology.tsx`, `src/pages/DataManager.tsx` · **Verifica:** check, 27 test, build, audit run #24.
- [x] **DATA-03 — Provenienza campo-per-campo consultabile.** Import run, provider, trasformazione, valore originale e fonte sono esposti dal Data Manager; il backfill locale ha creato 18.348 riferimenti usando solo metadati esistenti, dopo backup verificato #57. **Completato: 2026-08-11 · Evidenza:** `source_references`, `scripts/backfill-provenance.ts`, API `/data/provenance/:entity/:id` · **Verifica:** `data:provenance`, audit run #24.
- [x] **DATA-04 — Ciclo completo dei conflitti.** Risoluzione e riapertura richiedono motivazione e revisore, conservano timestamp/evidenza e alimentano il change log; l'audit segnala soltanto i conflitti aperti. **Completato: 2026-08-11 · Evidenza:** `server/routes/api.ts`, `data_conflicts`, Data Manager · **Verifica:** test integrazione resolve/reopen e audit con zero conflitti aperti.
- [x] **OPS-01 — Migrazioni SQLite versionate.** Schema alla versione 7 con ledger `schema_migrations` e comando `db:migrate`. **Completato: 2026-08-11 · Evidenza:** `server/db/database.ts`, `scripts/migrate-db.ts` · **Verifica:** test schema su database isolato e migrazione del database locale.
- [x] **OPS-02 — Backup e ripristino verificato.** Ogni snapshot registra integrità, SHA-256 e dimensione; il restore richiede conferma del checksum e crea prima un nuovo snapshot di sicurezza. **Completato: 2026-08-11 · Evidenza:** `createBackupSnapshot`, `restoreBackupSnapshot`, Data Manager · **Verifica:** test automatico di modifica e restore su database isolato.
- [x] **OPS-03 — Pipeline CI di release.** Check segreti, TypeScript, test, build, migrazioni e audit bloccante, con report audit conservato come artefatto. **Completato: 2026-08-11 · Evidenza:** `.github/workflows/ci.yml`, `scripts/check-secrets.ts` · **Verifica:** tutti gli stessi passaggi eseguiti localmente; il primo run remoto partirà al prossimo push/PR.
- [x] **OPS-04 — Rendere release e disaster recovery ripetibili.** L'applicazione serve il frontend compilato in produzione, dispone di immagine container immutabile, volume SQLite persistente, health check, workflow GHCR su tag, backup esterno con checksum/integrity check, restore drill e runbook di rollback. **Completato: 2026-08-11 · Evidenza:** `Dockerfile`, `compose.production.yml`, `.github/workflows/release.yml`, `scripts/export-backup.ts`, `scripts/restore-drill.ts`, `docs/RELEASE_AND_RECOVERY.md` · **Verifica:** route SPA e health 200 in runtime production; backup esterno #69 verificato con 35 tabelle e 767 partite. La build Docker effettiva resta affidata alla CI perché Docker non è installato sulla workstation.
- [x] **SEC-01 — Funzioni amministrative protette.** In produzione tutte le scritture richiedono bearer token; sono attivi CORS allowlist, rate limit, security header, limite payload, audit delle operazioni e configurazione admin per scheda browser. **Completato: 2026-08-11 · Evidenza:** `server/app.ts`, `.env.example`, `security_audit_log` · **Verifica:** test lettura anonima, scrittura negata, ruolo admin, rate limit e conflict workflow.
- [x] **QA-01 — Dataset golden di regressione.** Fixture deterministica separa Serie A/Coppa Italia e congela H2H, streak, Hall of Fame e `NULL`; i casi duplicati, omonimi, conflitti e override restano coperti dalle suite P0 già presenti. **Completato: 2026-08-11 · Evidenza:** `tests/fixtures/golden-archive.json`, `tests/golden-regression.test.ts` · **Verifica:** suite completa verde.
- [x] **QA-02 — Aggiungere test end-to-end e visuali.** Playwright copre ricerca con refuso, filtri e pagine nell'URL, confronto, import preview, conflitti, editor, risposta API fallita e breakpoint desktop/mobile; usa un database SQLite temporaneo e la CI conserva report HTML, trace, screenshot e video sugli errori. **Completato: 2026-08-11 · Evidenza:** `playwright.config.ts`, `e2e/critical-flows.spec.ts`, `.github/workflows/ci.yml` · **Verifica:** 16 E2E passati e 2 baseline non applicabili saltate intenzionalmente; baseline Chromium verificata.
- [x] **QA-03 — Verificare compatibilità e resilienza.** La matrice dichiara Chromium desktop/mobile, WebKit e Firefox in CI Linux; route dirette, refresh, rete lenta, stato offline e fallimenti API sono testati, mentre un error boundary impedisce pagine bianche. Il runtime Firefox Playwright è escluso soltanto sul runner Windows locale per un blocco di avvio documentato. **Completato: 2026-08-11 · Evidenza:** `docs/QA_COMPATIBILITY.md`, `src/App.tsx`, `src/components/Ui.tsx`, `e2e/critical-flows.spec.ts` · **Verifica:** Chromium desktop 6 test, Chromium mobile 5 test e WebKit 5 test verdi; Firefox configurato nella CI Ubuntu.

- [x] **DONE-DATA-01** Dichiarazioni TypeScript locali per `better-sqlite3` e CSS corrette; check e build nuovamente eseguibili.
- [x] **DONE-DATA-02** Test automatizzati aggiunti per importer e servizi statistici, inclusi duplicati con orari diversi, alias squadra, righe manuali protette, H2H, streak e Hall of Fame.
- [x] **DONE-DATA-03** Identità logica delle fixture protetta sia a livello applicativo sia tramite vincolo SQLite.
- [x] **DONE-DATA-04** Conflitti di punteggio/data tra provider salvati in `data_conflicts` e revisionabili nel Data Manager.
- [x] **DONE-DATA-05** Indicatore di copertura per stagione aggiunto al Data Manager con partite, rose, statistiche giocatore e ultimo audit.
- [x] **DONE-DATA-06** Blocco delle partite concluse con stagione incoerente e segnalazione di record futuri/non giocati.
- [x] **DONE-DATA-07** Dataset distinti individuati per Serie C1 2007/08, Coppa Italia ed Europa League, mantenendo separate competizioni e copertura.
- [x] **DONE-DATA-08** Allenatori, stadio e capocannonieri verificati aggiunti alle cinque stagioni di Serie B con relativa fonte.
- [x] **DONE-DATA-09** Anagrafica giocatore normalizzata tramite ID di fonte oltre al nome.
- [x] **DONE-DATA-10** Livelli di completezza gara `BASIC`, `STANDARD` e `DETAILED` introdotti e visibili.
- [x] **DONE-DATA-11** Bootstrap Football-Data esteso alla Serie B 2008/09–2012/13.
- [x] **DONE-DATA-12** Recuperate cinque rose storiche e 106 giocatori unici pre-Serie A tramite bootstrap ripetibile.
- [x] **DONE-DATA-13** Comando `data:audit` aggiunto per copertura, doppioni e dati mancanti.
- [x] **DONE-DATA-14** Risolti 38 duplicati fixture 2025/26 con backup SQLite e normalizzazione di Milan, Roma e Verona.
- [x] **DONE-DATA-15** Import protetti dai duplicati tra provider con timestamp formattati diversamente.
- [x] **DONE-DATA-16** Avanzamento dettagliato per import e sincronizzazioni con conteggio di inseriti, aggiornati, ignorati e scartati.

### Prodotto ed esperienza utente

- [x] **UX-06 — Aggiungere una modalità offline di sola lettura.** Le GET pubbliche salvano snapshot JSON versionati con data, usano il dato locale soltanto quando la rete fallisce e distinguono esplicitamente l'assenza di cache; il service worker conserva app shell e asset senza intercettare le API. **Completato: 2026-08-11 · Evidenza:** `src/services/api.ts`, `src/context/ExperienceContext.tsx`, `public/sw.js`, `public/manifest.webmanifest` · **Verifica:** test unitario, E2E online→errore rete e matrice Chromium/WebKit/mobile.
- [x] **UX-07 — Completare accessibilità e navigazione da tastiera.** Aggiunti skip link, landmark e stati ARIA, focus del contenuto, controlli espansi/attivi, riduzione movimento di sistema/applicativa e contrasto AA dei testi secondari; axe blocca le rotte principali. **Completato: 2026-08-11 · Evidenza:** `src/layouts/AppLayout.tsx`, `src/index.css`, `e2e/critical-flows.spec.ts`, `docs/ACCESSIBILITY_AUDIT.md` · **Verifica:** axe WCAG 2/2.1/2.2 AA senza violazioni sulle cinque rotte principali, tastiera, 21 E2E verdi e 6 skip intenzionali di matrice.
- [x] **POLISH-03 — Aggiungere preferiti e raccolte personali esportabili.** Ogni pagina può essere aggiunta/rimossa dalla raccolta locale; la pagina Preferiti permette navigazione, export JSON, import e cancellazione completa senza account ed è compatibile con gli snapshot offline. **Completato: 2026-08-11 · Evidenza:** `src/pages/Favorites.tsx`, `src/context/ExperienceContext.tsx`, `src/layouts/AppLayout.tsx` · **Verifica:** flusso E2E e prova browser sulla vista Coppa Italia 2013/14.

- [x] **UX-08 — Distinguere e strutturare le schede per competizione.** Serie A, Serie B, Coppa Italia ed Europa League hanno temi cromatici riconoscibili; la Coppa Italia usa un tabellone responsive e l’Europa League 2016/17 separa qualificazioni e girone, espone classifica, traguardo del Sassuolo e quadro della fase finale. I risultati europei e gli aggregati incoerenti sono stati corretti da fonti UEFA dopo backup verificato #60. **Completato: 2026-08-11 · Evidenza:** `src/pages/SeasonDetail.tsx`, `src/pages/Seasons.tsx`, `data/competition-profiles/europa-league-2016-17.json`, `scripts/correct-europa-league-2016-17.ts` · **Verifica:** check, 51 test, build con budget bundle, audit dati, controllo browser desktop/mobile a 390×844 senza overflow o errori console.
- [x] **UX-02 — Trasformare la stagione corrente in un centro aggiornato.** Ultima/prossima gara, classifica, forma, rosa, indisponibili, calendario e freschezza sono riuniti nella stessa vista; gli aggiornamenti per provider vengono registrati separatamente con errori consultabili e il contratto resta limitato alla stagione configurata. **Completato: 2026-08-11 · Evidenza:** `server/services/currentSeason.ts`, `server/routes/api.ts`, `src/pages/CurrentSeason.tsx`, `tests/current-season-center.test.ts` · **Verifica:** check, 47 test, build con budget bundle, controllo manuale desktop e mobile a 390×844 senza overflow o errori console.
- [x] **ARCH-01 — Dichiarare e completare il perimetro storico.** Il manifesto versionato copre senza interruzioni il periodo 2007/08–2026/27 e separa campionati, playoff, coppe nazionali, Supercoppa di Serie C ed Europa League; `/coverage` mostra anche competizioni senza record con una motivazione esplicita. **Completato: 2026-08-11 · Evidenza:** `data/historical-scope.json`, `server/services/historicalScope.ts`, `server/services/coverage.ts`, `src/pages/Methodology.tsx` · **Verifica:** `npm.cmd run check`, 38 test, build con budget bundle, `npm.cmd run data:audit`, controllo manuale desktop e mobile a 390 px.
- [x] **ARCH-02 — Completare le schede stagione.** Le schede espongono piazzamento e punti senza fallback a zero, competizioni anche solo dichiarate, rosa, marcatori, capitano, stadio, allenatori con intervalli strutturati o `N/D`, provenienza, lacune e affidabilità; una stagione priva di record resta consultabile senza valori inventati. Corretta inoltre la stagione 2026/27 allineando Alberto Aquilani alla fonte ufficiale dopo backup verificato #58. **Completato: 2026-08-11 · Evidenza:** `server/routes/api.ts`, `src/pages/SeasonDetail.tsx`, `src/types/index.ts`, `tests/season-profile.test.ts` · **Verifica:** `npm.cmd run check`, 40 test, build con budget bundle, `npm.cmd run data:audit`, verifica manuale 2011/12, 2007/08 e 2026/27 su desktop/mobile a 390 px, console senza errori.
- [x] **ARCH-03 — Completare il centro partita.** Il dettaglio deriva la copertura effettiva `BASIC`, `STANDARD` o `DETAILED`, espone risultato, intervallo, supplementari/rigori, marcatori ed eventi, formazioni e sostituzioni, arbitro, stadio, spettatori e statistiche quando presenti; i moduli senza dati non vengono renderizzati. **Completato: 2026-08-11 · Evidenza:** `server/routes/api.ts`, `server/db/database.ts`, `server/services/kickoffSync.ts`, `src/pages/MatchDetail.tsx`, `tests/archive-profiles.test.ts` · **Verifica:** check, 42 test, build con budget bundle, `data:audit`, controllo manuale BASIC/DETAILED desktop e assenza di pannelli vuoti.
- [x] **ARCH-04 — Rendere complete le schede giocatore.** Il profilo riunisce identità e relativi conflitti aperti, biografia essenziale, totali canonici generali e per competizione, stagioni, presenze, titolarità, minuti, gol, assist, disciplina, trasferimenti e fonti; tutti gli aggregati derivano dalle stesse righe `player_seasons` senza trasformare `NULL` in zero. **Completato: 2026-08-11 · Evidenza:** `server/routes/api.ts`, `src/pages/PlayerDetail.tsx`, `src/types/index.ts`, `tests/archive-profiles.test.ts` · **Verifica:** check, 42 test, build con budget bundle, `data:audit`, controllo manuale desktop/mobile a 390 px; warning React sulle chiavi fonte rilevato e corretto.
- [x] **ARCH-05 — Aggiungere archivio allenatori e staff tecnico.** Gli incarichi 2007/08–2026/27 sono periodi espliciti collegati alle stagioni, con fonti, gare/risultati derivati, moduli disponibili, traguardi, interim ed esoneri; i due incarichi di Di Francesco restano distinti. Lo staff ufficiale 2025/26 e 2026/27 è consultabile per ruolo. **Completato: 2026-08-11 · Evidenza:** `data/technical-staff.json`, `server/services/clubArchive.ts`, `src/pages/Coaches.tsx` · **Verifica:** check, 46 test, build, audit e controllo manuale desktop/mobile a 390 px.
- [x] **ARCH-06 — Completare trasferimenti e movimenti rosa.** I movimenti distinguono acquisto/cessione, prestito, rientro, svincolo e rilascio, espongono club, sessione, costo con valuta/fonte e stato di riconciliazione dell’identità; filtri e URL restano sincronizzati. **Completato: 2026-08-11 · Evidenza:** migrazione schema 7, `server/services/apiFootballSync.ts`, `src/pages/Transfers.tsx`, `src/pages/ManualEditor.tsx` · **Verifica:** check, test d’integrazione filtri/costo/identità, build e verifica a 390 px senza overflow.
- [x] **ARCH-07 — Costruire una sezione storia del club autorevole.** Palmarès, promozioni, retrocessione, stadi, presidenti, proprietà, maglie e ricorrenze hanno fonti puntuali; `/club-history`, pagina Club e Timeline leggono lo stesso dataset strutturato. **Completato: 2026-08-11 · Evidenza:** `data/club-history.json`, `server/services/clubArchive.ts`, `src/pages/Club.tsx`, `src/pages/Timeline.tsx` · **Verifica:** test di uguaglianza Club/Timeline, build, controllo fonti e date civili desktop/mobile.
- [x] **ARCH-09 — Offrire segnalazioni e correzioni documentate.** Il modulo pubblico richiede entità, campo, valore, spiegazione e URL fonte; la proposta resta separata dai dati pubblici in `correction_requests`, entra nella coda del Data Manager e approvazione/rifiuto richiedono revisore e nota alimentando il change log. **Completato: 2026-08-11 · Evidenza:** migrazione schema 7, API `/corrections`, `src/pages/Corrections.tsx`, coda in `src/pages/DataManager.tsx` · **Verifica:** test pubblico/admin/change log, build, controllo mobile a 390 px e console senza errori.
- [x] **ARCH-08 — Gestire record e Hall of Fame in modo dichiarativo.** Formule, spareggi, soglie, competizioni e limiti sono centralizzati e restituiti dalle API con copertura, filtri e ultimo ricalcolo; ogni classifica visibile espone “Come è calcolato”. I perimetri vuoti restano `N/D`. **Completato: 2026-08-11 · Evidenza:** `server/services/statDefinitions.ts`, `server/services/stats.ts`, `src/components/CalculationDisclosure.tsx`, `src/pages/Records.tsx`, `src/pages/HallOfFame.tsx` · **Verifica:** check, 36 test, build, controllo manuale desktop/mobile di filtri, soglie e disclosure.
- [x] **UX-01 — Pubblicare Fonti e metodologia complete.** Copertura, priorità dei provider, conflitti, correzioni manuali, `N/D`, livelli partita e formule sono documentati; badge di fonte, completezza e stato rimandano alle rispettive definizioni. **Completato: 2026-08-11 · Evidenza:** `src/pages/Methodology.tsx`, `src/components/Ui.tsx`, `src/components/MatchTable.tsx`, `src/pages/MatchDetail.tsx` · **Verifica:** check, 34 test, build, controllo manuale desktop/mobile e navigazione badge.
- [x] **DONE-UX-01** Onboarding leggero su copertura, `N/D`, livelli di completezza e differenza tra dati verificati e importati.
- [x] **DONE-UX-02** Ricerca globale con risultati raggruppati per giocatori, stagioni, partite e avversari.
- [x] **DONE-UX-03** Breadcrumb e collegamenti contestuali tra stagione, partita, giocatore, rosa e competizione.
- [x] **DONE-UX-04** Prima funzione di confronto tra due stagioni o due giocatori con indicazione della copertura.
- [x] **DONE-UX-05** Viste preferite, ultimo contesto di navigazione e ripristino filtri.
- [x] **DONE-UX-06** Stati di caricamento, errore e assenza dati con skeleton, messaggi e azione “Riprova”.
- [x] **DONE-UX-07** Viste condivisibili via URL con filtri, tab e query di ricerca, incluse route aperte direttamente.
- [x] **DONE-UX-08** Timeline delle stagioni con promozioni, retrocessioni, debutto europeo, trofei e cambi di allenatore.
- [x] **DONE-UX-09** Tema chiaro/scuro, riduzione animazioni e resa mobile delle tabelle come card.
- [x] **DONE-UX-10** Mojibake corretto e UTF-8 senza BOM adottato per sorgenti, CSV e documenti.
- [x] **DONE-UX-11** Filtri Giocatori per ruolo, nazionalità e stagione, con `N/D` distinto dallo zero.
- [x] **DONE-UX-12** Badge di provenienza e data di verifica su stagioni, partite e statistiche con link esterno.
- [x] **DONE-UX-13** Distinzione nella rosa storica tra “in rosa” e “ha giocato”, con contatori e tooltip di copertura.
- [x] **DONE-UX-14** Ricerca H2H con autocomplete e normalizzazione visibile degli alias avversari.
- [x] **DONE-UX-15** Dashboard e Records filtrabili per competizione e intervallo stagionale.
- [x] **DONE-UX-16** Grafici per posizione, vittorie/pareggi/sconfitte, gol fatti/subiti, punti cumulati e progressione, con serie nascoste in assenza della base dati.

### Prestazioni e robustezza frontend

- [x] **PERF-01 — Introdurre paginazione server-side e aggregati dedicati.** Partite, giocatori, trasferimenti e liste dell'editor amministrativo espongono `rows`, `total`, `page` e `pageSize` con limite 100; filtri, ordinamento, ricerca e pagina restano nell'URL, mentre la dashboard continua a usare il proprio aggregato dedicato. **Completato: 2026-08-11 · Evidenza:** `server/routes/api.ts`, `src/pages/Players.tsx`, `src/pages/Transfers.tsx`, `src/pages/ManualEditor.tsx`, `docs/PERFORMANCE_BASELINE.md` · **Verifica:** 61 test, build, E2E e benchmark su 765 partite/335 giocatori/848 trasferimenti con p95 massimo 4,46 ms.
- [x] **PERF-02 — Ridurre il bundle iniziale.** Le rotte sono caricate in modo lazy e Recharts resta nel chunk Dashboard; il manifest Vite alimenta budget bloccanti di 300 KiB per il JavaScript iniziale e 400 KiB per ogni chunk. **Completato: 2026-08-11 · Evidenza:** `src/App.tsx`, `vite.config.ts`, `bundle-budgets.json`, `scripts/check-bundle-budget.ts` · **Verifica:** check, 28 test, build; entrypoint 250,9 KiB rispetto ai circa 669 kB iniziali, chunk massimo 362,5 KiB.
- [x] **PERF-03 — Aggiungere cache HTTP e invalidazione consapevole.** Le GET pubbliche usano cache server con TTL, `ETag` e revalidation obbligatoria; ogni mutazione riuscita invalida la cache e una generazione impedisce di memorizzare risposte concorrenti ormai superate. **Completato: 2026-08-11 · Evidenza:** `server/services/operations.ts`, `server/app.ts`, `src/services/api.ts` · **Verifica:** check, 30 test, build; test automatico MISS/HIT/304 e invalidazione dopo scrittura.
- [x] **PERF-04 — Definire una policy per immagini e asset remoti.** Le immagini HTTPS passano da un proxy con allowlist, richiesta AVIF/WebP, limite 5 MB, cache 24 ore e fallback SVG; il componente condiviso dichiara dimensioni, lazy loading, decoding asincrono e alt contestuale. **Completato: 2026-08-11 · Evidenza:** `server/app.ts`, `src/components/Ui.tsx`, `docs/QA_COMPATIBILITY.md`, `.env.example` · **Verifica:** test fallback per host/URL non disponibile, check, build ed E2E visuale senza layout rotto.

### Osservabilità

- [x] **OBS-01 — Aggiungere osservabilità e health check reali.** `/api/health` espone integrità e dimensione totale SQLite, durata del controllo, tempi/errori API, metriche cache, ultimo sync, stato provider e durata degli import recenti; gli errori vengono limitati e ripuliti da token. **Completato: 2026-08-11 · Evidenza:** `server/services/operations.ts`, `server/routes/api.ts`, `tests/operations.test.ts` · **Verifica:** check, 30 test, build; test stato degradato, metriche operative e redazione dei segreti.

## Procedura obbligatoria per gli agenti futuri

### Prima di iniziare

1. Scegliere una sola voce o un gruppo strettamente collegato e dichiararne l'ID nel piano di lavoro.
2. Verificare codice, database, documentazione e test esistenti: la presenza di un file o di una route non prova il completamento.
3. Annotare nella voce `Owner: <agente/sessione>` mentre il lavoro è in corso. Se il lavoro viene interrotto, rimuovere l'owner o aggiungere una breve nota sul blocco.
4. Per dati storici, seguire sempre `PROJECT_SPEC.md`, `data/SOURCES.md` e le regole di riconciliazione; non inventare valori per riempire una lacuna.

### Quando un miglioramento è completato

1. Verificare integralmente il criterio di accettazione e aggiungere test proporzionati alla modifica.
2. Eseguire almeno `npm.cmd run check` e `npm.cmd run test`; eseguire anche `npm.cmd run build` per modifiche frontend/build e `npm.cmd run data:audit` per modifiche a dati, import o statistiche.
3. Effettuare una verifica manuale dell'interfaccia quando cambiano flussi, responsive layout, accessibilità o contratto API.
4. Spostare la voce, senza cambiarne l'ID, dalla sezione **Da fare** a **Completati** e trasformare `[ ]` in `[x]`.
5. Aggiungere alla voce completata: `Completato: YYYY-MM-DD · Evidenza: <PR/commit o file principali> · Verifica: <comandi/test eseguiti>`.
6. Aggiornare README, specifica, fonti, API e changelog quando interessati dalla modifica.

### Lavoro parziale, regressioni e nuove idee

- Se solo una parte del criterio è soddisfatta, la voce resta aperta: aggiungere una nota `Stato parziale` con ciò che manca oppure dividerla in sotto-voci mantenendo il legame con l'ID originale.
- Non segnare una voce come completata quando test, audit o build richiesti falliscono; documentare il blocco in modo riproducibile.
- Una regressione genera una nuova voce con nuovo ID e riferimento alla voce completata originaria; lo storico non va riscritto.
- Una nuova proposta deve includere priorità, ID univoco, risultato atteso e criterio di accettazione osservabile. Evitare duplicati e formulazioni generiche come “migliorare la UI”.
- Non inserire segreti, database locali, backup o fonti non redistribuibili nel repository.

### Modello per una nuova voce

```md
- [ ] **AREA-NN — Titolo orientato al risultato.** Descrizione dello scopo. **Accettazione:** condizioni osservabili e testabili. `Owner: —`
```
