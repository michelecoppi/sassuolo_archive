# Policy di riconciliazione dati

## Fonte ufficiale dello stato

Lo stato operativo è registrato in SQLite nelle tabelle `import_runs`, `audit_runs` e `research_candidates`. Gli allegati vivono tutti in `data/reconciliation/`: pacchetti sotto `candidates/`, report sotto `audits/` e registro macchina in `registry.json`.

Il database conserva il valore importato. Le correzioni curate sono registrate con fonte, autore e data tramite `source_references`, `change_log` e, quando disponibile, override a livello di campo.

## Flussi ammessi

### Provider corrente

- KickoffAPI: fixture e dettagli della Serie A coperti dal provider.
- API-Football: rose, PlayerSeason, classifiche, statistiche squadra, trasferimenti e coach.
- Una stagione e competizione alla volta; quota e coverage devono essere salvate.

### Pacchetto candidato

I dati storici non coperti dai provider arrivano come `data.csv` o `data.json`, con `manifest.json` e `SOURCES.md`. Il pacchetto non modifica SQLite finché non è stato validato, confrontato e approvato.

## Regole di qualità

- `NULL` significa non disponibile o non verificato; non va convertito in zero.
- Campionato, Coppa Italia ed Europa League restano separati.
- Non si fondono giocatori soltanto per nome quando esiste un ID provider.
- Non si importano fixture duplicate per data, casa e trasferta.
- Eventi con minuto o punteggio incompatibile vengono rifiutati.
- Una classifica è accettabile solo se completa per quella competizione.
- Ogni modifica distruttiva richiede backup, diff e audit successivo.

## Stati

`discovered` → `candidate` → `validated` → `in_review` → `approved` → `imported`.

Gli esiti alternativi sono `rejected`, `superseded` e `rolled_back`.
