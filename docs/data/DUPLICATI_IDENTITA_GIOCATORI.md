# Analisi del problema delle identità giocatore

## Sintesi

Il problema non è soltanto la presenza di due grafie dello stesso nome. Nel database l’identità del giocatore è ancora trattata in più punti come testo libero (`players.name`, `player_seasons` collegato da `player_id`, trasferimenti con `player_id` e `player_name`, eventi e statistiche partita con nome denormalizzato). Di conseguenza la stessa persona può essere divisa in più righe quando cambia:

- accento o carattere speciale: `Rogério` / `Rogerio`;
- traslitterazione: `Šime Vrsaljko` / `Sime Vrsaljko`;
- apostrofo o entità HTML: `M'Bala Nzola` / `M&amp;apos;Bala Nzola`;
- nome abbreviato: `D. Berardi` / `Domenico Berardi`;
- errore ortografico: `Mert Muldur` / `Mert Müldür`;
- nome completo leggermente diverso: `Gianmarco Ferrari` / `Gian Marco Ferrari`.

Al controllo del database risultano 335 giocatori e 4 gruppi di duplicati ancora identificabili con una chiave accent-insensitive:

| Persona probabile | Record | Dati distribuiti |
|---|---|---|
| Dejan Lazarević | `Dejan Lazarevic`, `Dejan Lazarević` | 1 stagione + 1 trasferimento |
| Hamed Junior Traorè | `Hamed Junior Traore`, `Hamed Junior Traorè` | 5 stagioni + 1 stagione |
| Rogério | `Rogerio`, `Rogério` | 5 stagioni + 5 stagioni, 3 trasferimenti, eventi e statistiche partita |
| Šime Vrsaljko | `Sime Vrsaljko`, `Šime Vrsaljko` | 2 stagioni + 2 trasferimenti |

Questi quattro gruppi richiedono ancora una scelta del nome canonico e una fusione controllata.

## Perché il problema si ripete

### 1. Il nome è una chiave tecnica in alcuni flussi

La tabella `players` ha `name UNIQUE`. Gli importer usano ancora confronti come:

```sql
WHERE lower(name)=lower(?)
```

`lower()` non rimuove gli accenti e non corregge spazi, apostrofi, entità HTML o traslitterazioni. Per SQLite, quindi, `Müldür`, `Muldur` e `MÜLDÜR` non sono necessariamente la stessa stringa.

### 2. Esistono più identità di fonte

`player_source_ids` è il meccanismo corretto per collegare l’ID stabile del provider, ma non tutti i dataset lo valorizzano. I dati storici locali e alcuni import StatBunker arrivano senza `source_external_id`; in quei casi il sistema ricade sul nome.

### 3. Il nome è duplicato nelle tabelle di dettaglio

Le tabelle partita conservano sia `player_id` sia una copia testuale (`player_name`, `assist_name`). Questa copia serve per la provenienza e per mostrare il payload originale, ma può diventare incoerente dopo una fusione se non viene aggiornata insieme al collegamento.

### 4. Le abbreviazioni non sono sempre errori

I record iniziali possono essere:

- una versione abbreviata della stessa persona;
- l’unica identità disponibile per un giocatore giovane o appena importato;
- una persona diversa con lo stesso cognome.

Per questo non è sicuro trasformare automaticamente ogni `A. Cognome` nel primo nome che condivide il cognome.

## Danni possibili

- statistiche stagionali divise tra due profili;
- trasferimenti presenti su una scheda ma non sull’altra;
- collegamenti partita mancanti o assegnati al giocatore sbagliato;
- doppioni nella ricerca e nella Hall of Fame;
- import successivi che ricreano una scheda già eliminata;
- conteggi aggregati non riproducibili in base alla fonte importata per ultima.

## Correzioni già eseguite

Sono state già fuse e rimosse diverse famiglie di duplicati, tra cui:

- `Armand Laurienté` / `A. Laurienté` / `Armand Lauriente`;
- `Nicolás Schiappacasse`;
- `Nicola Sansone`;
- `Marcello Trotta`;
- `Mert Müldür`;
- `Maxime Lopez`;
- `Gian Marco Ferrari`;
- `Francesco Caputo`;
- `Antonino Ragusa`;
- `Filip Djuricic` / `Filip Đuričić`.

Durante le fusioni sono stati trasferiti i record mancanti, preservati i dati già presenti sul record canonico e creati backup prima delle modifiche.

## Soluzione tecnica consigliata

### A. Separare identità e visualizzazione

Il nome visualizzato non deve essere la chiave dell’identità. La chiave primaria deve restare `players.id`; quando disponibile, va associato anche l’ID del provider.

Serve una tabella esplicita di alias:

```sql
CREATE TABLE player_name_aliases (
  id INTEGER PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  alias_normalized TEXT NOT NULL UNIQUE,
  source_provider TEXT,
  note TEXT,
  created_at TEXT NOT NULL
);
```

Gli alias eliminati non vanno semplicemente dimenticati: vanno registrati e risolti verso il giocatore canonico. Questo impedisce che un import futuro ricrei il duplicato.

### B. Usare una normalizzazione unica

La normalizzazione dovrebbe:

1. decodificare `&apos;`, `&#39;` e `&#x27;`;
2. applicare Unicode NFD;
3. rimuovere i diacritici solo per il confronto;
4. convertire in minuscolo;
5. uniformare apostrofi e spazi;
6. gestire eventualmente `Muldur`/`Müldür` e grafie equivalenti.

Il nome canonico visualizzato deve invece mantenere accenti e apostrofi corretti. Non bisogna salvare la forma normalizzata al posto del nome reale.

### C. Risoluzione a più livelli durante l’import

Ordine consigliato:

1. `source_provider + source_player_id`;
2. alias esatto normalizzato;
3. nome canonico normalizzato;
4. corrispondenza sicura per nome completo e cognome;
5. abbreviazione + iniziale solo se esiste una sola possibilità;
6. altrimenti bloccare l’import e creare un conflitto da revisionare.

Un import non dovrebbe mai creare automaticamente un nuovo giocatore quando trova un alias già censito.

### D. Fusione idempotente e verificabile

Ogni fusione dovrebbe essere una transazione che:

- crea un backup;
- registra la coppia origine/destinazione;
- sposta o combina `player_seasons` senza duplicare la chiave stagione/competizione;
- sposta trasferimenti, eventi, infortuni e statistiche partita;
- aggiorna i nomi denormalizzati solo dove il nome deve rappresentare il canonico;
- conserva il nome originale nel JSON/payload di fonte quando serve audit;
- registra un `change_log`;
- inserisce l’origine nella tabella alias;
- verifica che il record sorgente non abbia più collegamenti prima della cancellazione.

## Piano operativo proposto

1. Approvare i 4 gruppi accent-insensitive elencati sopra.
2. Creare `player_name_aliases` e popolarla con tutte le fusioni già fatte.
3. Implementare un resolver comune usato da importer, sincronizzazione API, editor manuale e associazione eventi partita.
4. Aggiungere un audit che segnali:
   - duplicati normalizzati;
   - abbreviazioni senza alias;
   - giocatori con stesso provider ID;
   - dettagli partita con `player_id` nullo ma nome risolvibile;
   - nomi denormalizzati diversi dal canonico.
5. Correggere i 4 gruppi residui dopo conferma.
6. Analizzare gli abbreviati ancora senza un nome completo a sistema usando fonti e ID, senza deduzione automatica dal solo cognome.
7. Aggiungere test di regressione per accenti, apostrofi, alias, duplicati di stagione e nomi abbreviati.

## Nota sui nomi ancora abbreviati

Nel database restano molti nomi del tipo `A.`, `D.`, `M.` e simili. Non tutti hanno una versione completa locale; alcuni possono essere giocatori diversi con lo stesso cognome. La correzione corretta richiede una fonte identificativa o una revisione manuale. La strategia sicura è quindi censire l’alias e il `source_player_id`, non indovinare il nome dal cognome.

## Conclusione

La soluzione robusta non è fare altre sostituzioni manuali isolate. Serve un registro degli alias, una normalizzazione usata solo per il confronto e un resolver centralizzato basato prima sugli ID di fonte. Le fusioni già eseguite hanno ridotto i duplicati più evidenti, ma i quattro gruppi residui dimostrano che il problema strutturale è ancora presente negli import senza ID e nei campi testuali denormalizzati.
