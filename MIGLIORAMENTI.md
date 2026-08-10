# Miglioramenti — Sassuolo History & Stats

Backlog mantenuto dopo l'audit del 9 agosto 2026. Ogni voce deve avere un owner, un criterio di accettazione e test prima di passare a completata.

## Nuove priorità per l'esperienza utente

- [x] Aggiungere un onboarding leggero: spiegare copertura, `N/D`, livelli di completezza e differenza tra dati verificati e importati.
- [x] Rendere la ricerca globale il punto di ingresso principale, con risultati raggruppati per giocatori, stagioni, partite e avversari.
- [x] Aggiungere breadcrumb e collegamenti contestuali tra stagione, partita, giocatore, rosa e competizione.
- [x] Introdurre una funzione "Confronta" per due stagioni o due giocatori, indicando anche la copertura disponibile.
- [x] Salvare viste preferite e ultimo contesto di navigazione, con comando per ripristinare i filtri.
- [x] Migliorare stati di caricamento, errore e assenza dati con skeleton, messaggi chiari e azione "Riprova".
- [x] Rendere condivisibili le viste tramite URL con filtri, tab e query di ricerca; verificare il refresh diretto delle route.
- [x] Aggiungere una timeline delle stagioni con promozioni, retrocessioni, debutto europeo, trofei e cambi di allenatore.
- [ ] Mostrare "Come è calcolato" per punti, posizione, streak, record e Hall of Fame, con data dell'ultimo ricalcolo.
- [ ] Creare una pagina Fonti e metodologia con copertura, priorità tra provider, regole di conflitto e correzioni manuali.
- [ ] Supportare una modalità offline di sola lettura con cache dell'ultimo dataset e data di aggiornamento visibile.
- [x] Aggiungere avanzamento dettagliato per import e sincronizzazioni, con riepilogo di inseriti, aggiornati, ignorati e scartati.
- [ ] Introdurre paginazione server-side e risposte aggregate dedicate ai grafici per migliorare tempi e stabilità.
- [x] Aggiungere tema chiaro/scuro, riduzione animazioni e layout mobile delle tabelle come card.

## P0 — affidabilità dei dati e release

- [x] Corrette la dichiarazione locale di `better-sqlite3` e quella CSS TypeScript. Verificare in CI che `npm.cmd run check` e `npm.cmd run build` restino verdi.
- [x] Aggiungere test automatizzati per importer e servizi statistiche: fixture duplicate con orari diversi, alias squadra, righe manuali protette, H2H, streak e Hall of Fame.
- [x] Imporre in SQLite una strategia di identità per le fixture (giorno + casa + trasferta normalizzate) oppure una tabella di collegamento provider. L'attuale protezione applicativa va mantenuta ma un vincolo DB renderebbe impossibili regressioni.
- [x] Salvare i conflitti di score/data tra provider in `data_conflicts` e renderli revisionabili nel Data Manager; non scegliere silenziosamente una fonte.
- [x] Mostrare nel Data Manager un indicatore di copertura per stagione: partite attese/trovate, rose, righe PlayerSeason con statistiche e ultimo audit.
- [x] Bloccare l'inserimento di match conclusi con stagione incoerente rispetto alla data e segnalare i record futuri/non giocati.

## P1 — completezza dell'archivio

- [ ] Importare statistiche individuali pre-2013 solo da un export riproducibile e verificabile (ad esempio tabelle Standard FBref archiviate con data/fonte). Priorità: 2012/13, poi 2011/12–2008/09. Importatore e manifest sono pronti; manca l'export verificabile da archiviare.
- [x] Cercare dataset affidabili per Serie C1 2007/08 e, separatamente, per Coppa Italia ed Europa League. Tenere tornei e copertura distinti dal campionato.
- [x] Aggiungere allenatori, stadio e capocannonieri verificati alle cinque stagioni di Serie B; ogni valore deve citare la fonte.
- [x] Normalizzare l'anagrafica giocatore su un ID di fonte oltre al nome, per evitare collisioni omonime e varianti diacritiche.
- [x] Introdurre un livello di completezza per gara (`BASIC`, `STANDARD`, `DETAILED`) visibile in lista e dettaglio.

## P1 — prodotto e UX

- [x] Correggere tutte le stringhe con mojibake (sequenze U+00C3/U+00C2/U+00E2) e adottare UTF-8 senza BOM in sorgenti, CSV e documenti.
- [x] Rendere i filtri Giocatori completi (ruolo, nazionalità, stagione) e mostrare chiaramente `N/D` invece di ordinare valori nulli come zero.
- [x] Aggiungere badge di provenienza e data di verifica su stagioni, partite e statistiche, con link alla fonte esterna.
- [x] Separare nella rosa storica “in rosa” da “ha giocato”, con contatori espliciti e tooltip sulla copertura.
- [x] Aggiungere ricerca H2H con suggerimenti/autocomplete e normalizzazione visibile degli alias avversari.
- [x] Rendere Dashboard e Records filtrabili per competizione/intervallo stagionale per non mescolare Serie A e Serie B senza contesto.
- [x] Completare grafici utili: posizione, W/N/P, gol fatti/subiti, punti cumulati e progressione punti; nascondere una serie quando manca la base dati.

## P2 — accessibilità, operatività e performance

- [ ] Testare tastiera, focus, contrasto, screen reader e layout mobile delle tabelle; aggiungere etichette accessibili ai controlli icona.
- [ ] Virtualizzare o paginare liste lunghe di partite e aggiungere filtri persistenti nell'URL.
- [ ] Ridurre il bundle iniziale (attualmente circa 669 kB minificati) con route lazy-loaded e code splitting dei grafici Recharts.
- [ ] Aggiungere export CSV/JSON filtrato e import preview con validazione, righe scartate e rollback.
- [ ] Introdurre backup/versionamento esplicito degli import oltre al backup della deduplicazione.
- [ ] Aggiungere CI con check, build, test e controllo di segreti; bloccare il deploy se l'audit dati fallisce.
- [ ] Definire una policy di immagini: cache locale/proxy, `alt` utile e fallback quando un URL storico non è più disponibile.

## Già completato nell'audit corrente

- [x] Esteso il bootstrap Football-Data alla Serie B 2008/09–2012/13.
- [x] Recuperate cinque rose storiche e 106 giocatori unici pre-Serie A tramite bootstrap ripetibile.
- [x] Aggiunto `data:audit` per copertura, doppioni e dati mancanti.
- [x] Risolti 38 duplicati di fixture 2025/26 con backup SQLite, normalizzando Milan/Roma/Verona.
- [x] Aggiunta protezione import contro duplicati tra provider con timestamp formattati diversamente.
