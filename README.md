# Sassuolo History & Stats

Archivio locale U.S. Sassuolo Calcio: React + TypeScript + Tailwind, backend Express e database SQLite.

La documentazione completa è organizzata nell’[indice `docs/`](docs/README.md); roadmap e specifica tecnica non sono più disperse nella root.

Il progetto è **local-first**: i dati storici vengono salvati nel database locale e gli aggiornamenti esterni servono solo ad aggiungere o arricchire dati. I valori mancanti restano `NULL` e nell'interfaccia sono mostrati come `N/D`.

## Avvio rapido

Richiede Node.js 22–24.

```bash
npm install
npm run setup
npm run dev
```

Apri `http://localhost:5173`.

## Sviluppo locale e Docker sono alternativi

Non occorre avviare Docker prima di `npm run dev`. Le due modalità servono a scopi diversi e, nella configurazione locale attuale, usano copie separate del database.

| Modalità | Avvio | Indirizzo | Database | Quando usarla |
| --- | --- | --- | --- | --- |
| Sviluppo | `npm run dev` | `http://localhost:5173` | `server/db/sassuolo.db` | Modificare codice e completare i dati ogni giorno |
| Docker locale | `docker start sassuolo-history-local` | `http://localhost:8788` | volume `sassuolo_history_local_data` | Verificare build e comportamento simili alla produzione |

Docker offre un ambiente Linux ripetibile, isola le dipendenze e permette di verificare in anticipo il container destinato a un futuro server. Non sostituisce il normale flusso di sviluppo e non sincronizza automaticamente il suo SQLite con `server/db/sassuolo.db`.

Il container locale è stato creato con la politica `unless-stopped`: se Docker Desktop parte con Windows e il container non è stato fermato manualmente, viene riavviato automaticamente. Comandi utili:

```powershell
docker start sassuolo-history-local
docker stop sassuolo-history-local
docker logs -f sassuolo-history-local
```

Non eliminare il volume `sassuolo_history_local_data`: contiene il database della modalità Docker. Per il lavoro editoriale ordinario usare una sola copia canonica, attualmente `server/db/sassuolo.db`, e provare periodicamente in Docker tramite un nuovo backup verificato.

La versione pubblicabile serve frontend e API dallo stesso processo Express. Container, volume SQLite persistente, backup esterno e rollback sono descritti nella [guida release e recovery](docs/operations/RELEASE_AND_RECOVERY.md).

Le letture pubbliche riuscite vengono conservate come snapshot locali versionati. Se la rete dati cade, le pagine già consultate usano l'ultima copia indicando la data; il service worker mantiene l'app shell. La pagina **Preferiti** salva raccolte locali senza account e consente import, export e cancellazione JSON.

La pagina **Stato e novità** espone versione e checksum del dataset, conteggi e copertura, nuove fonti, correzioni e incidenti senza mostrare dettagli operativi privati. La stessa cronologia è disponibile come feed RSS; ogni release deve dichiarare sintesi, perimetro e almeno un collegamento verificabile prima di superare la CI.

Il contratto API OpenAPI 3.1 è disponibile a `http://localhost:8787/api/openapi.json`. Documenta versione, filtri, limiti/paginazione, errori, import controllati, workflow qualità e job di sincronizzazione. Il client TypeScript validato a runtime è in `src/services/adminApiClient.ts`; `npm run test:api-contract` lo verifica contro gli endpoint Express reali.

Nel **Data Manager**:

- **Candidati** mostra mapping colonne, righe valide/scartate, duplicati, conflitti e impatto; il file può essere corretto e rieseguito prima dell’applicazione protetta da checksum e backup.
- **Qualità dati** ordina le anomalie per severità e conserva stato, responsabile e nota operativa.
- **Provider** espone job pianificati con lock, chiave d’idempotenza, retry/backoff, controllo quota e avvisi azionabili.

`npm run setup` importa già il riepilogo verificato delle 13 stagioni concluse 2013/14–2025/26 e crea la voce 2026/27. Per aggiungere tutte le singole partite usa il bootstrap descritto sotto.

## Importare lo storico Sassuolo

È incluso un importer dedicato che scarica i CSV gratuiti di Football-Data e importa **tutte le partite di campionato del Sassuolo dalla stagione 2013/14 alla 2025/26**.

Copertura:

- 2013/14 → 2023/24: Serie A
- 2024/25: Serie B
- 2025/26: Serie A
- 2026/27: stagione corrente predisposta nel database; nessun risultato viene inventato prima che le partite siano disponibili

La pagina **Partite e calendario** è il centro della stagione corrente: mostra ultima e prossima gara, forma recente, classifica, rosa, infortuni/squalifiche e calendario operativo. Il riquadro di freschezza indica l'ultimo sync riuscito e rende consultabili gli errori dei provider; **Aggiorna dati** registra ogni tentativo nel ledger degli import senza usare una sync incompleta per modificare le stagioni storiche.

Per le gare concluse, **Statistiche e voti** apre un editor basato sulla rosa: accetta compilazione rapida, CSV/TSV e un modello scaricabile. Il **Sassuolo Archive Rating** viene calcolato localmente senza copiare rating esterni; ogni voto conserva formula, confidenza e bonus/malus applicati. Metodo e limiti sono descritti in [`docs/data/PLAYER_RATINGS.md`](docs/data/PLAYER_RATINGS.md).

### Metodo 1 — dal sito

1. Avvia `npm run dev`.
2. Vai in **Data Manager**.
3. Premi **Importa storico 2013/14 → 2025/26**.
4. Attendi il riepilogo con numero di stagioni/partite importate ed eventuali errori.

L'importer salva anche una copia normalizzata in:

```text
data/matches/sassuolo-league-history.json
data/seasons/sassuolo-league-history.json
```

Questi file rimangono disponibili anche offline per gli import successivi.

### Metodo 2 — da terminale

```bash
npm run history:bootstrap
```

Poi, quando vuoi reimportare i file già presenti senza riscaricare:

```bash
npm run import:all
```

L'import storico è idempotente: la stessa partita non viene duplicata.

## Cosa viene importato automaticamente

Dal CSV di campionato, quando disponibile:

- data
- stagione
- competizione
- squadra casa/trasferta
- risultato finale
- risultato primo tempo
- arbitro
- tiri
- tiri in porta
- corner
- falli
- cartellini aggregati
- xG se la colonna è presente nella fonte

Dalle partite vengono poi calcolati localmente:

- partite, vittorie, pareggi e sconfitte della stagione
- gol fatti/subiti
- punti
- record casa/trasferta
- posizione finale stimata dalla classifica ricostruita
- Head to Head
- serie di risultati e record disponibili dalle partite

> Nota: questo bootstrap è per il **campionato**. Coppa Italia, Europa League, marcatori/assist delle singole partite e dati giocatore completi richiedono dataset aggiuntivi e possono essere importati separatamente.

## Leggere fonti e copertura

La pagina **Fonti e metodo** documenta la matrice di copertura per stagione e competizione, l'ordine di priorità dei provider, la gestione dei conflitti e delle correzioni manuali, la semantica di `N/D` e le formule statistiche. Il perimetro storico versionato parte dal 2007/08 e separa campionati, playoff/playout e coppe: anche le competizioni ancora prive di record compaiono nella matrice con una lacuna motivata. I badge `BASIC`, `STANDARD` e `DETAILED` rimandano direttamente alla definizione del relativo livello; i badge di provenienza aprono la spiegazione metodologica e l'icona esterna apre la fonte puntuale quando disponibile.

Le schede stagione espongono inoltre affidabilità, allenatori e relativi intervalli quando documentati, stadio, capitano, provenienza dei record e lacune puntuali. Una stagione dichiarata nel perimetro resta consultabile anche quando non possiede ancora record: in quel caso i campi rimangono `N/D` e la scheda spiega cosa manca.

Le pagine **Club** e **Timeline** condividono `data/club-history.json`, che raccoglie palmarès, passaggi di categoria, stadi, proprietà, presidenti, maglie e ricorrenze con fonti. **Allenatori e staff** usa incarichi espliciti da `data/technical-staff.json`: i cambi in corsa e i ritorni multipli non vengono inferiti dal campo testuale della stagione.

I **Trasferimenti** sono filtrabili per stagione, sessione e tipo di movimento; costo, valuta e fonte restano campi distinti e l’interfaccia evidenzia le identità non riconciliate. Da **Segnala correzione** chiunque può proporre un valore con una fonte: la proposta non modifica il dato pubblico e viene approvata o rifiutata dalla coda del Data Manager, alimentando il change log.

Il centro partita deriva il livello effettivo dai blocchi disponibili: `BASIC` limita la vista al risultato, `STANDARD` aggiunge metadati documentati, `DETAILED` indica almeno un blocco avanzato tra eventi, formazioni e statistiche. Intervallo, supplementari, rigori, arbitro, stadio e spettatori compaiono solo quando presenti; non vengono renderizzate sezioni vuote.

Le schede giocatore usano `player_seasons` come base canonica per totali generali e per competizione. Mostrano biografia, titolarità, minuti, gol, assist, disciplina, trasferimenti e provenienza; gli identificativi di fonte sono riuniti nello stesso profilo e gli eventuali conflitti d'identità aperti restano evidenziati.

Records e Hall of Fame mostrano inoltre il perimetro effettivo del calcolo, la data dell'ultimo ricalcolo e, per ogni classifica, formula, spareggio e soglia minima. Queste regole sono centralizzate in `server/services/statDefinitions.ts`: una nuova metrica non va aggiunta soltanto al frontend, ma deve avere una definizione dichiarativa e test dello spareggio.

## Modificare i dati a mano

Dal sito apri:

**Data Manager → Modifica dati**

Puoi creare, modificare ed eliminare:

- stagioni
- partite
- giocatori
- statistiche di un giocatore per stagione

Quando salvi dall'editor, `source_provider` viene impostato a `manual`.

**Le correzioni manuali hanno priorità:** `npm run import:all` e l'import storico non sovrascrivono automaticamente le righe marcate come manuali.

Per i dati che non conosci lascia il campo vuoto: verrà salvato come `NULL` / `N/D`.

## Import JSON/CSV personalizzati

Cartelle supportate:

```text
data/
  seasons/
  matches/
  players/
  player-seasons/
```

Puoi importarli in tre modi:

1. **Data Manager → Carica un JSON/CSV dal browser**: scegli il tipo di dato e seleziona il file;
2. copia uno o più file `.json`/`.csv` nella cartella corretta e premi **Importa cartelle data/**;
3. da terminale:

```bash
npm run import:all
```

I file caricati dal browser vengono anche salvati nella cartella `data/` corrispondente, quindi restano disponibili per i successivi avvii.

### Stagioni

Esempio CSV:

```csv
season,competition,final_position,matches,wins,draws,losses,goals_for,goals_against,points,manager,source_provider,source_url
2025/26,Serie A,,,,,,,,,,,manual,
```

### Partite

Esempio CSV:

```csv
date,season,competition,round,home_team,away_team,home_score,away_score,halftime_score,referee,shots_home,shots_away,shots_on_target_home,shots_on_target_away,corners_home,corners_away,fouls_home,fouls_away,xg_home,xg_away,source_provider,source_url
2026-01-01,2025/26,Serie A,,U.S. Sassuolo Calcio,Avversario,,,,,,,,,,,,,,,manual,
```

### Giocatori

È incluso `data/players/template.csv`.

Campi principali:

```text
name,nationality,birth_date,position,shirt_number,first_appearance,last_appearance,current_squad,source_provider,source_url
```

### Statistiche giocatore per stagione

È incluso `data/player-seasons/template.csv`.

Campi supportati:

```text
player_name,season,competition,appearances,starts,minutes,goals,assists,yellow_cards,red_cards,clean_sheets,source_provider
```

L'importer riconosce anche diverse intestazioni comuni della tabella Standard di FBref:

```text
Player, MP, Starts, Min, Gls, Ast, CrdY, CrdR
```

Dopo l'import, i totali nella scheda giocatore vengono ricalcolati dalle righe `player_seasons`.

## Database

File SQLite:

```text
server/db/sassuolo.db
```

Tabelle principali:

- `teams`
- `team_aliases`
- `seasons`
- `matches`
- `players`
- `player_seasons`
- `news_articles`
- `sync_state`
- `data_conflicts`
- `schema_migrations`
- `source_references`
- `backup_runs`
- `import_runs`
- `security_audit_log`

## Provider e modalità senza chiavi

Copia `.env.example` in `.env` solo se vuoi attivare provider API aggiuntivi.

```env
PORT=8787
FOOTBALL_DATA_API_KEY=
API_FOOTBALL_KEY=
API_FOOTBALL_SASSUOLO_TEAM_ID=

ENABLE_FOOTBALL_DATA=true
ENABLE_API_FOOTBALL=true
ENABLE_THESPORTSDB=true
ENABLE_RSS=true
```

Lo storico Football-Data implementato da `history:bootstrap`, SQLite, gli import JSON/CSV, l'editor manuale e gli RSS funzionano senza chiavi API.

## Comandi

```bash
npm run dev                # frontend + backend
npm run setup              # crea DB + importa file locali
npm run history:bootstrap  # scarica/importa lo storico campionato Sassuolo
npm run import:all         # importa file JSON/CSV presenti in data/
npm run db:init            # inizializza/migra SQLite
npm run db:migrate         # applica e mostra la versione delle migrazioni
npm run data:provenance    # backup + backfill delle fonti già presenti
npm run data:audit:full    # audit bloccante e report JSON
npm run check              # TypeScript check
npm run check:secrets      # cerca credenziali nei file tracciati
npm run check:bundle       # verifica i budget sui file già generati in dist/
npm run build              # check + build Vite + budget bundle
npm start                  # avvia solo API
```

`GET /api/health` fornisce lo stato operativo di database, cache, richieste, provider e import recenti. Le letture pubbliche supportano `ETag`; dopo ogni import o correzione riuscita la cache server viene invalidata automaticamente.

Le liste di partite, giocatori, trasferimenti e dell’editor amministrativo supportano `page` e `pageSize` (massimo 100) e mantengono pagina e filtri nell’URL. La baseline ripetibile è documentata in `docs/quality/PERFORMANCE_BASELINE.md` tramite `npm run perf:pagination`.

I test browser si eseguono con `npm run test:e2e`: Playwright avvia API e Vite su porte isolate, crea un database temporaneo, copre Chromium, Firefox, WebKit e viewport mobile e conserva trace, screenshot e video in caso di errore. Matrice e policy immagini sono in `docs/quality/QA_COMPATIBILITY.md`.

## Affidabilità dei dati

- Nessuna statistica mancante viene inventata.
- Gli update falliti non cancellano i dati già presenti.
- Le partite usano chiavi stabili per evitare duplicati.
- Le modifiche manuali sono protette dagli import automatici.
- È sempre consigliato compilare `source_url` quando aggiungi una correzione manuale importante.

## Sicurezza e pubblicazione

Le letture API ordinarie restano pubbliche; Data Manager, qualità dati, candidati e identità richiedono una sessione amministrativa. In produzione il curatore usa `ADMIN_API_TOKEN` una sola volta nella schermata di accesso: il server rilascia un cookie di sessione `HttpOnly`, `Secure` e `SameSite=Strict`, mentre ogni scrittura richiede anche un token CSRF. Nulla viene conservato nello storage JavaScript del browser. `POST /api/corrections` resta pubblico e limitato perché salva soltanto una proposta in attesa. Configurazione, modello di minaccia, logout e recupero accesso sono descritti nella [guida alla sicurezza amministrativa](docs/setup/ADMIN_SECURITY.md).

Ogni scrittura è soggetta a rate limit e viene registrata in `security_audit_log`. Copiare `.env.example` in `.env`, usare un token casuale lungo e non commettere mai il file `.env`.

---

# API-Football — configurazione v3

La v3 usa **API-Football / API-Sports** come provider principale per i dati strutturati che non sono presenti nel bootstrap CSV.

## 1. Ottenere la chiave

1. Crea un account sul dashboard API-Football/API-Sports.
2. Attiva il piano Free se vuoi iniziare senza pagare.
3. Copia la API key da **Account → My Access**.
4. Copia `.env.example` in `.env`:

```powershell
Copy-Item .env.example .env
```

5. Apri `.env` e inserisci:

```env
API_FOOTBALL_KEY=LA_TUA_CHIAVE
ENABLE_API_FOOTBALL=true
API_FOOTBALL_SASSUOLO_TEAM_ID=
```

Non serve conoscere l'ID del Sassuolo: se `API_FOOTBALL_SASSUOLO_TEAM_ID` è vuoto, **Data Manager → Test connessione** usa `/teams?search=Sassuolo`, sceglie il club italiano e salva l'ID in SQLite. Se preferisci, puoi inserire manualmente l'ID nel `.env`.

> La chiave non viene mai inviata al frontend React: resta nel processo Node/Express.

## 2. Prima sincronizzazione consigliata

Avvia:

```bash
npm run setup
npm run dev
```

Poi apri **Data Manager** e usa nell'ordine:

1. **Test connessione** — verifica chiave e identifica il Sassuolo;
2. **Aggiorna trasferimenti** — una chiamata può popolare lo storico mercato restituito dall'API;
3. seleziona una stagione e premi **Sincronizza stagione selezionata**;
4. ripeti per le stagioni che il tuo piano rende disponibili;
5. usa **Aggiorna stagione corrente** per rosa, giocatori/stats, classifica, team stats, trasferimenti e allenatore correnti.

Per ogni stagione il backend prova a recuperare:

- lega e coverage (`/leagues?team=...&season=...`)
- classifica completa (`/standings`)
- statistiche squadra (`/teams/statistics`)
- giocatori + statistiche stagionali paginati (`/players`)

La sincronizzazione della stagione salva tutto in SQLite e ricalcola automaticamente i totali dei giocatori e la Hall of Fame.

## 3. Dati collegati, non stringhe hardcoded

Il capocannoniere di una stagione viene calcolato da `player_seasons` e restituito come oggetto collegato a `players.id`.

Lo stesso modello alimenta:

- Hall of Fame
- pagina Giocatori
- profilo giocatore
- rosa stagionale
- rosa attuale
- top scorer / top assist di ogni stagione
- trasferimenti collegati al giocatore

I vecchi campi testuali `top_scorer` e `top_assists` restano nello schema solo per compatibilità con import precedenti, ma la UI v3 usa le relazioni `Player` / `PlayerSeason`.

## 4. Nuove tabelle v3

Oltre alle tabelle precedenti:

- `season_standings` — classifica completa di ogni stagione
- `team_season_stats` — statistiche aggregate del Sassuolo
- `transfers` — arrivi/partenze collegati ai Player
- `app_settings` — cache di ID provider e configurazione non sensibile

`players` include anche `api_football_id`, foto, altezza, peso e profilo. `player_seasons` include rating, tiri, passaggi chiave, tackle, duelli, dribbling, falli, cartellini e rigori quando disponibili.

## 5. Quota e storico del piano Free

Il Data Manager legge dagli header API-Sports la quota residua e la mostra nella UI. La sincronizzazione non viene eseguita quando navighi nelle pagine: le pagine leggono solo SQLite.

Al momento della preparazione della v3 (agosto 2026), il piano Free dichiara **100 richieste/giorno e 10 richieste/minuto** e può limitare **la profondità storica disponibile**. Se una stagione vecchia non è inclusa nel tuo piano, il sito conserva i dati locali già presenti e mostra l'errore di coverage/provider senza cancellare nulla. Puoi continuare a usare Football-Data/CSV e gli import manuali per colmare i periodi non accessibili.
