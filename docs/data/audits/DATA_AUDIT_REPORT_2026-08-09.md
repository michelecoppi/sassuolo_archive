# Audit database e Data Manager — 9 agosto 2026

## Esito

Il nucleo storico dei risultati è solido: le 704 partite di campionato dal 2008/09 al 2025/26 sono tutte presenti e concluse, senza duplicati né incoerenze rispetto ai riepiloghi di stagione. Il database non ha violazioni di chiavi esterne.

L'archivio non è però completo in modo uniforme: rose e statistiche individuali, classifiche complete, statistiche squadra, dettagli partita e provenienza puntuale sono presenti solo in poche annate. Il Data Manager permette modifiche manuali di base, ma **non è ancora sicuro abbastanza per la curation**: non conserva uno storico, non ha backup/undo, non supporta eventi partita e applica la protezione `manual` all'intero record invece che al singolo campo.

Questo audit non ha cancellato, importato o modificato dati. L'unica modifica tecnica introdotta è un nuovo audit in sola lettura:

```powershell
npm.cmd run data:audit:full
```

## Stato del database

| Area | Stato rilevato | Valutazione |
| --- | ---: | --- |
| Stagioni/competizioni | 26 | Completo nel perimetro già dichiarato, inclusa 2026/27 vuota e preparata |
| Partite | 726 | 704 campionato + 12 Coppa Italia + 10 Europa League; nessuna partita duplicata |
| Giocatori | 381 | Anagrafiche parziali; 15 senza ID fonte e 15 con più ID fonte |
| PlayerSeason | 385 | Copertura reale soltanto per 2008/09–2012/13 come rosa senza rendimento e per 2022/23–2024/25 in modo parziale |
| Classifiche | 60 righe | Complete soltanto per Serie A 2022/23, Serie A 2023/24 e Serie B 2024/25 |
| Statistiche squadra | 4 righe | 2022/23 Serie A, 2023/24 Serie A e Coppa Italia, 2024/25 Serie B |
| Trasferimenti | 837 | Nessun doppione logico; tutti datati e collegati a un giocatore, ma senza URL puntuale di fonte |
| Dettagli partita | 43 match | 3 Coppa 2024/25, 2 Coppa 2025/26, 38 Serie A 2025/26 |
| Eventi / formazioni / stat match | 216 / 26 / 604 | Completi solo su 13 delle 43 partite dettagliate; nessun doppione o minuto impossibile persistito |
| News RSS | 104 | Cache funzionante; nessuna immagine e un titolo duplicato tre volte |

## Copertura stagionale

### Risultati e riepiloghi

- Serie B 2008/09–2012/13: **42/42** partite per ogni stagione.
- Serie A 2013/14–2023/24: **38/38** partite per ogni stagione.
- Serie B 2024/25 e Serie A 2025/26: **38/38** partite per stagione.
- Coppa Italia: 1 (2020/21), 2 (2021/22), 1 (2022/23), 3 (2023/24), 3 (2024/25), 2 (2025/26): tutte le fixture presenti nel perimetro attuale.
- Europa League 2016/17: **10/10** fixture presenti.
- 2026/27: nessuna gara né statistica. È corretto: è una stagione predisposta, non un buco da riempire.

I risultati aggregati per campionato riconciliano con partite, W/N/P, gol e punti del record `seasons`: non esistono discrepanze.

### Dove mancano dati

| Area | Stagioni/competizioni interessate | Tipo di assenza |
| --- | --- | --- |
| Statistiche individuali | 2008/09–2012/13 | 189 righe di rosa, ma zero presenze/minuti/gol/assist: **assenza corretta**, da non stimare |
| Statistiche individuali | 2013/14–2021/22 e 2025/26 | Nessuna riga PlayerSeason: recuperabile solo da export/dataset verificabile o API che confermi la coverage |
| Statistiche individuali | 2022/23–2024/25 | Copertura parziale; alcune righe hanno presenze ma non assist/gol, che devono restare `NULL` se la fonte non li dà |
| Classifiche complete | Tutte tranne 2022/23 A, 2023/24 A, 2024/25 B | Recuperabili con dataset di classifica completi; non deducibili dalle sole partite del Sassuolo |
| Team stats | Quasi tutte le 26 competizioni | Recuperabili soltanto dove provider o export espongono le statistiche aggregate |
| Dettagli evento/formazioni/stat match | Tutte le partite precedenti al 2024/25 e 30/38 della Serie A 2025/26 | In gran parte assenza di coverage provider, non un valore zero |
| Scorers/assist/cards testuali | 714/715/49 match senza valore | Da importare solo da match report o dataset con provenienza; non inferire dal risultato |
| xG | 718 match senza valore | Assenza normalmente corretta nel dataset storico Football-Data; non stimare |
| Stadio, presenza, arbitro | 713/726, 726/726, 726/726 null | Non disponibili nel dataset locale importato; una fonte diversa è necessaria |

## Dati sospetti e duplicati

### Integrità superata

- zero violazioni referenziali;
- zero fixture duplicate per giorno + casa + trasferta;
- zero quasi-duplicati di giocatore rilevati;
- zero varianti residue di nome avversario rilevate;
- zero statistiche giocatore negative/impossibili;
- zero eventi con minuto negativo/oltre soglia, sostituzioni sospette o goal incoerenti con il punteggio;
- zero trasferimenti duplicati.

### Da revisionare

1. Esiste un solo conflitto aperto: `match_event #134`, cartellino a Walid Cheddira, con minuto ricevuto dal provider `-5`. Il valore non è stato salvato nel record evento (ora è `NULL`), quindi il database non contiene il minuto impossibile. È un **dato assente ma potenzialmente recuperabile** da un match report; non va sostituito con un valore inventato.
2. Le 37 statistiche di Coppa Italia 2023/24 e la statistica squadra di quella competizione sono coerenti con le tre gare e non mostrano valori matematicamente impossibili. Non hanno però URL per singola riga: sono da considerare **importate, non ancora verificabili riga per riga**.
3. RSS contiene tre URL diversi con lo stesso titolo normalizzato (“Le ultime operazioni di mercato…”). È un vero duplicato editoriale da deduplicare per `normalized_title`/URL canonico, senza cancellazione automatica prima di una preview.
4. I trasferimenti sono numerosi e strutturalmente puliti, ma la tabella non ha `source_url`: sono **presenti ma con provenienza insufficiente** per una verifica manuale puntuale.

## Stato reale del Data Manager

### Funzioni presenti e verificate

- visualizza conteggi locali, copertura per stagione, provider, quote, ultimi successi/errori e conflitti;
- invoca aggiornamenti API-Football, Kickoff, storico, news e import locale tramite backend; nessuna chiave API è esposta al frontend;
- consente CRUD per stagioni, partite, giocatori, PlayerSeason e trasferimenti;
- marca le righe salvate come `source_provider = 'manual'` e gli importer rispettano il record manuale;
- le API di Record, Hall of Fame, metodologia, news e Data Manager rispondono correttamente;
- TypeScript, test e build passano.

### Limiti e bug rilevati

| Gravità | Problema | Evidenza / impatto |
| --- | --- | --- |
| Urgente | Conflitto evento non risolvibile dalla UI | La UI mostra tre decisioni per `match_event.minute`, ma l'endpoint accetta soltanto campi di `match`, `season` e `player`: il click restituisce un errore. |
| Urgente | Nessun editor per eventi, formazioni, statistiche match, classifiche, team stats o news | L'utente non può eseguire diverse correzioni richieste senza SQLite diretto. |
| Urgente | Nessun backup, undo, log o preview prima delle modifiche/import | Le cancellazioni CRUD sono immediate; eliminare una partita può cancellare i dettagli in cascata, eliminare un giocatore può cancellare PlayerSeason. |
| Urgente | Override solo a livello record | Modificare un solo campo marca l'intera riga `manual`, bloccando qualsiasi arricchimento futuro anche sui campi non toccati. |
| Importante | I form non raccolgono autore, nota, URL in ogni entità, motivo o flag “verificato” | Non è possibile dimostrare chi ha cambiato cosa e perché. `player_seasons` e `transfers` non offrono URL fonte. |
| Importante | Upload/import senza anteprima, convalida per riga o rollback | Il file viene salvato in `data/` e importato subito. Non sono supportati eventi e trasferimenti da upload. |
| Importante | Audit e dedup non sono azioni UI | Il Data Manager mostra solo la data dell'ultimo audit; non offre esecuzione, risultato, preview o backup della deduplicazione. |
| Importante | Avanzamento Kickoff fuorviante | Mostra solo il progresso della più recente Serie A (2026/27, attualmente vuota), non quello della stagione che l'utente seleziona. |
| Miglioramento | Errori provider poco leggibili | Espone JSON/HTTP 429 grezzo. API-Football ha errori di rate limit; Kickoff ha quota residua 15. |
| Miglioramento | Selettori duplicano la stessa annata per competizione | Il valore selezionato è solo la stagione; il backend sincronizza tutte le competizioni. Va reso esplicito (“tutte le competizioni”) o separato per competizione. |

Non sono stati premuti pulsanti che consumano quota o importano dati: lo stato provider osservato è API-Football rate-limited (HTTP 429 su players/leagues/team-stats) e Kickoff con quota residua 15.

## Piano di recupero dati

### Ordine operativo

1. **Prima sicurezza e tracciabilità.** Non avviare altri import massivi finché non esistono backup/versioni e override per campo.
2. **Recuperare i PlayerSeason 2008/09–2012/13.** Usare soltanto export Standard FBref archiviato localmente, con URL, data di verifica, file e checksum/manifest. Priorità: 2012/13, poi a ritroso. L'importatore dedicato esiste già.
3. **Controllare le sincronizzazioni API-Football.** Attendere il reset del rate limit, sincronizzare una singola annata per volta e salvare l'esito/coverage. Priorità: 2025/26 (rosa, PlayerSeason, classifica e team stats), poi 2021/22–2013/14 dove il piano restituisca dati.
4. **Completare i dettagli Kickoff solo dove `deepStatsSynced` è disponibile.** Le 30 partite 2025/26 senza blocchi avanzati non devono essere forzate in loop: il provider le dichiara prive di deep stats. Riprovare solo dopo una nuova coverage esplicita e con budget controllato.
5. **Classifiche storiche.** Importare una classifica completa solo da export di competizione (non derivarla dalle 38/42 partite del Sassuolo). Salvare fonte e data per ogni stagione.
6. **Coppe ed Europa.** Mantenere perimetri separati dal campionato. Per 2016/17 usare export UEFA con URL del match report; per le Coppe usare Lega Serie A/FIGC o dataset locale riproducibile. Non usare le gare di coppa per completare le metriche di lega.
7. **Rifinire RSS.** Aggiungere deduplicazione per titolo normalizzato/canonical URL e una policy immagini con `NULL` esplicito quando il feed non le fornisce.

### Regola fonti

- Football-Data: risultati e statistiche match aggregate, non xG/eventi/rose mancanti.
- FBref: riepiloghi e export statistici archiviati localmente; non scraping non riproducibile.
- Transfermarkt: appartenenza rosa e anagrafica compatibile, mai per dedurre performance.
- API-Football/Kickoff: solo backend, con quota, coverage e risultato import salvati.
- Fonti manuali: URL, nota curatoriale e data di verifica obbligatori prima di rendere un valore “verificato”.

Dopo ogni import eseguire `npm.cmd run data:audit:full`, salvare l'output con l'ID dell'import e bloccare l'operazione se crea duplicati, regressioni di copertura o conflitti aperti.

## Piano per modifiche manuali sicure

### Modello dati consigliato

1. Mantenere il valore importato come base e aggiungere una tabella `field_overrides`:
   - `entity_type`, `entity_id`, `field`, `value_json`, `source_provider='manual'`;
   - `source_url`, `note`, `verified_at`, `author`, `created_at`, `updated_at`;
   - stato `active/reverted` e vincolo unico sul campo attivo.
2. Creare `change_log` append-only con prima/dopo, autore, ragione, azione e `backup_id`.
3. Creare `import_runs` e `backup_runs`: manifest del file/provider, checksum, righe create/aggiornate/scartate, report audit e snapshot SQLite prima di operazioni distruttive.
4. Per cancellazioni usare soft-delete/tombstone o una pagina di impatto + backup, mai `DELETE` diretto come azione primaria.
5. Aggiungere `source_references` generico per entità e campo: risolve l'assenza di URL su PlayerSeason, trasferimenti ed eventi.

### Regole di merge

1. L'API legge il valore efficace: override manuale attivo, altrimenti importato.
2. Un import aggiorna soltanto i campi senza override; registra un conflitto se propone un valore diverso da un override.
3. L'utente può scegliere “mantieni manuale”, “usa nuovo importato” o “confronta”, sempre con preview.
4. Un conflitto su evento deve aprire l'editor evento, non il generico resolver di match.
5. Ogni batch distruttivo crea un backup e offre ripristino per `backup_id`.

### UX da implementare

- Hub “Qualità dati” con ultimo audit, differenze dal precedente, severità e pulsante solo-preview;
- editor guidati per partita, evento, rosa/PlayerSeason, trasferimento, classifica e statistica squadra;
- badge per campo/record: `Importato`, `Manuale`, `Verificato`, `Conflitto`, `N/D`;
- preview del diff, validazioni (minuti, punteggi, sostituzione entrante/uscente, stagione/data) e conferma descrittiva;
- pannello “Modifiche recenti” con annulla/ripristina e link alla fonte;
- import wizard: selezione file, validazione, righe scartate, dedup, diff, backup, conferma finale;
- pagina backup e storico import; audit/dedup visibili senza terminale;
- messaggi provider sintetici con azione suggerita e data/ora di nuovo tentativo.

## Priorità

### Urgente

1. Disabilitare/correggere le azioni del conflitto `match_event.minute` e creare editor eventi.
2. Backup + log + preview/impact prima di delete, import e dedup applicata.
3. Passare da protezione record a override per campo.
4. Esporre audit completo e dedup in sola preview nel Data Manager.

### Importante

1. Import wizard con validazione, rollback e supporto eventi/trasferimenti.
2. Correggere l'avanzamento Kickoff per la stagione scelta e chiarire la stagione futura 2026/27.
3. Aggiungere provenienza puntuale a PlayerSeason, transfer ed eventi.
4. Recuperare PlayerSeason pre-2013 da export verificati e riprovare API-Football senza superare il rate limit.
5. Deduplicare RSS e registrare URL canonico.

### Miglioramento futuro

1. Modellare anche le squadre avversarie come entità/alias persistenti, non soltanto stringhe in `matches`.
2. Versionare anche allegati/export locali e collegarli ai record verificati.
3. Aggiungere dashboard di copertura per campo, provider e freshness, con regressioni tra audit.
4. Recuperare classifiche complete e dettagli storici solo quando esiste un dataset riproducibile.
