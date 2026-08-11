# Sassuolo History & Stats — specifica tecnica e guida per nuovi contributori

Questo documento descrive il progetto nello stato attuale. Deve essere letto prima di modificare codice o dati. L'obiettivo è permettere a un'altra AI o a uno sviluppatore di capire rapidamente architettura, modello dati, flussi di importazione e regole per aggiungere informazioni verificabili.

## 1. Scopo e principi

Sassuolo History & Stats è un archivio locale e consultabile della storia dell'U.S. Sassuolo Calcio.

- Frontend: React, TypeScript, Vite, Tailwind e Recharts.
- Backend: Node.js, Express e `better-sqlite3`.
- Persistenza: `server/db/sassuolo.db`.
- API: solo Express locale, con prefisso `/api`.
- Il frontend non chiama direttamente provider esterni.
- Gli aggiornamenti sono aggiuntivi/idempotenti: un errore esterno non deve cancellare dati locali validi.
- Un dato non verificato resta `NULL` e viene mostrato come `N/D`; non si devono inventare statistiche.
- Le modifiche manuali hanno priorità sugli import automatici.

Il perimetro storico moderno va dalla Serie C1 2007/08 alla stagione corrente. Il manifesto versionato [`data/historical-scope.json`](data/historical-scope.json) dichiara senza interruzioni campionato, playoff/playout effettivamente disputati, coppe nazionali, Supercoppa di Serie C ed Europa League. La matrice `/coverage` unisce questo perimetro ai record reali: una competizione attesa rimane quindi visibile anche quando non ha ancora dati, insieme alla motivazione della lacuna.

## 2. Struttura del repository

```text
src/                         React: pagine, componenti, servizi API
server/index.ts              avvio Express
server/routes/api.ts         endpoint REST e operazioni Data Manager
server/db/database.ts        schema SQLite, migrazioni leggere e utilità dati
server/services/             import, provider, sincronizzazioni e statistiche
server/providers/             adattatori per fonti esterne
scripts/                     bootstrap, import, audit, deduplicazione
data/seasons/                JSON/CSV di riepilogo stagioni
data/matches/                dataset locali di partite
data/players/                anagrafiche giocatori
data/player-seasons/         statistiche giocatore per stagione
data/reconciliation/         candidati, manifest, fonti e audit di riconciliazione
server/db/backups/           backup SQLite creati prima delle modifiche rilevanti
tests/                       test automatici
```

File da leggere per orientarsi:

1. `README.md`: avvio e procedure utente.
2. `server/db/database.ts`: schema reale, vincoli e funzioni di audit.
3. `server/services/importer.ts`: import dei file locali e ricalcolo dei totali.
4. `server/services/controlledImport.ts`: import dal Data Manager con anteprima.
5. `server/routes/api.ts`: contratto API usato dal frontend.
6. `data/SOURCES.md`: fonti e limiti di affidabilità.
7. `STYLE_GUIDE.md`: regole visuali e linguistiche.

## 3. Flusso dei dati

```text
JSON/CSV locali o provider
        ↓
parser + normalizzazione + validazione
        ↓
upsert SQLite con chiavi stabili
        ↓
audit, conflitti, log e backup quando necessari
        ↓
API Express /api/*
        ↓
React: pagine e componenti
```

Le statistiche di dashboard, record, testa a testa e Hall of Fame vengono calcolate dalle tabelle locali. Non aggiungere numeri hard-coded nelle pagine. Le metriche pubbliche di Records e Hall of Fame devono essere registrate in `server/services/statDefinitions.ts` con formula, spareggio e soglia; le relative API devono restituire anche perimetro, copertura e data dell'ultimo ricalcolo.

## 4. Modello dati essenziale

- `teams`, `team_aliases`: nomi canonici e alias degli avversari.
- `seasons`: una riga per coppia `season + competition`; contiene il riepilogo.
- `matches`: fixture, risultato e statistiche aggregate. L'identità deve essere stabile usando data normalizzata, casa, trasferta e competizione/stagione quando disponibile.
- `players`: una persona unica. Il nome è un'etichetta, non una chiave affidabile.
- `player_source_ids`: collega l'identità locale agli ID dei provider.
- `player_seasons`: appartenenza/statistiche di una persona per stagione e competizione; unicità `player_id + season + competition`.
- `season_standings`: classifica completa.
- `team_season_stats`: statistiche aggregate di squadra.
- `transfers`: movimenti collegati a `players` quando l'identità è nota.
- `match_details`, `match_events`, `match_lineups`, `match_team_stats`, `match_player_stats`, `match_injuries`: blocchi avanzati della partita.
- `news_articles`: articoli RSS con cache e deduplicazione.
- `sync_state`, `import_runs`, `audit_runs`, `change_log`, `backup_runs`, `data_conflicts`, `research_candidates`: tracciabilità operativa.
- `app_settings`: configurazione/cache non sensibile, ad esempio ID dei provider.

Prima di aggiungere una colonna o una tabella, verificare lo schema in `database.ts` e aggiornare anche i tipi in `src/types/index.ts`, l'importer e gli endpoint che la espongono.

## 5. Come aggiungere nuove informazioni

### Caso A — dati verificati in JSON/CSV

1. Scegliere l'entità corretta: `seasons`, `matches`, `players` o `player-seasons`.
2. Salvare il file nella cartella `data/` corrispondente.
3. Usare intestazioni coerenti con gli esempi del `README.md` e includere `source_provider`, `source_url` e, se possibile, `last_verified_at`.
4. Eseguire `npm.cmd run import:all`.
5. Eseguire `npm.cmd run data:audit` e controllare duplicati, copertura e conflitti.
6. Verificare la pagina interessata e aggiungere/aggiornare un test se il nuovo dato introduce una regola.

### Caso B — correzione puntuale

Usare `Data Manager → Modifica dati` oppure l'import controllato dal browser. L'operazione crea una modifica `manual`, registra la fonte e protegge la riga dagli import successivi. Prima di correggere dati importanti deve essere creato un backup.

### Caso C — nuovo dataset candidato

Per dati ancora da validare usare `data/reconciliation/candidates/<nome>/` con:

- `data.csv` o `data.json`;
- `manifest.json` con perimetro, chiavi e stato;
- `SOURCES.md` con URL, data di consultazione e discrepanze.

Un candidato non è automaticamente dato editoriale: va confrontato, validato e importato solo dopo l'audit.

### Caso D — nuovo provider

Creare un adattatore in `server/providers/` o un servizio in `server/services/`, normalizzare la risposta nel modello locale e registrare provider, ID esterno, URL/data di verifica e stato della sincronizzazione. La chiave deve restare nel backend e non va mai committata.

## 6. Regole per i dati

- Non dedurre presenze, minuti, gol, assist, eventi, formazioni o xG dalla sola appartenenza a una rosa.
- Non sostituire `NULL` con zero: zero significa valore verificato pari a zero.
- Normalizzare date in `YYYY-MM-DD` quando possibile e nomi delle squadre tramite gli alias.
- Conservare la competizione corretta; non mescolare Serie A, Serie B e Coppa Italia.
- Collegare i giocatori tramite ID provider o identità già verificata, non solo tramite nome simile.
- In caso di conflitto, conservare entrambe le evidenze e registrare il conflitto; non scegliere silenziosamente.
- Gli import devono essere ripetibili e non duplicare righe.

## 7. Comandi di sviluppo e manutenzione

```powershell
npm.cmd install
npm.cmd run setup
npm.cmd run dev
npm.cmd run check
npm.cmd run test
npm.cmd run build
npm.cmd run import:all
npm.cmd run history:bootstrap
npm.cmd run history:pre-serie-a
npm.cmd run data:audit
npm.cmd run data:audit:full
npm.cmd run data:provenance
npm.cmd run db:migrate
npm.cmd run check:secrets
npm.cmd run matches:dedupe
npm.cmd run matches:dedupe:apply
```

`matches:dedupe:apply` modifica il database: eseguire prima la modalità anteprima e verificare il backup creato. Per i test usare `SASSUOLO_DB_PATH` verso un database isolato.

In produzione le scritture API richiedono `ADMIN_API_TOKEN`; le letture rimangono pubbliche. L’unica scrittura pubblica è `POST /api/corrections`: accetta una proposta documentata, soggetta a rate limit, e la mantiene separata dai dati pubblicati finché un amministratore non la revisiona. Le migrazioni sono registrate in `schema_migrations`. Un ripristino completo è ammesso solo da un file sotto la directory backup, dopo verifica d'integrità e conferma del checksum SHA-256; prima del restore viene creato un ulteriore snapshot di sicurezza.

## 8. API principali

Gli endpoint sono definiti in `server/routes/api.ts`. Tra quelli principali: `/health`, `/dashboard`, `/seasons`, `/seasons/:season`, `/matches`, `/matches/:id`, `/players`, `/players/:id`, `/squad/current`, `/transfers`, `/club-history`, `/timeline`, `/coaches`, `/corrections`, `/h2h/:opponent`, `/records`, `/hall-of-fame`, `/news`, `/coverage`, `/data/provenance/:entity/:id` e `/data-manager`. `/transfers` supporta `season`, `session`, `movement` e `direction`; ogni riga espone anche lo stato di riconciliazione del giocatore. `POST /corrections` è pubblico, mentre lettura e revisione della coda seguono la protezione amministrativa generale. Il dettaglio `/seasons/:season` restituisce anche `profile`, con copertura, affidabilità, termini degli allenatori, capitano, lacune e riepilogo delle fonti; per le competizioni dichiarate ma ancora vuote restituisce un record `declared_only` con valori nulli. `/matches/:id` espone `outcome` e `modules`, così il frontend rende soltanto i blocchi coperti e deriva `BASIC`, `STANDARD` o `DETAILED` dai dati reali. `/players/:id` restituisce gli stessi aggregati canonici della lista, i totali per competizione, identità, conflitti aperti e fonti collegate.

Le GET pubbliche restituiscono `ETag` e richiedono revalidation (`Cache-Control: public, max-age=0, must-revalidate`); il backend conserva per 30 secondi le risposte serializzate per evitare di ripetere query identiche. Una scrittura HTTP riuscita invalida l'intera cache prima della lettura successiva. Le richieste con `Authorization` e `/health` non vengono memorizzate.

`GET /health` restituisce `healthy`, `degraded` o `unhealthy` insieme a integrità/dimensione SQLite, durata del controllo, metriche richieste e cache, ultimo sync, stato dei provider e durata degli ultimi import. Non espone chiavi o configurazioni sensibili; gli eventuali token presenti nei messaggi di errore sono redatti.

Per aggiungere un endpoint: validare query e parametri, usare query parametrizzate, restituire `404` per entità mancanti, non esporre `raw_json` o segreti, e aggiornare il client in `src/services/api.ts` e i tipi frontend.

## 9. Verifica prima di consegnare una modifica

```text
[ ] fonte e URL documentati
[ ] NULL/zero e competizione controllati
[ ] import ripetibile e senza duplicati
[ ] manual override rispettato
[ ] audit eseguito
[ ] npm.cmd run check
[ ] test/build eseguiti se il codice è cambiato
[ ] UI verificata se cambia il contratto API o il modello dati
[ ] nessun segreto, database locale o backup accidentale aggiunto al commit
```

Quando il dato non è abbastanza affidabile, fermarsi a un candidato documentato o lasciare `NULL`: la completezza apparente non è un requisito superiore alla tracciabilità.
