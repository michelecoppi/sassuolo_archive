# Guida autonoma — ricerca, revisione e importazione dei dati storici

Questa guida consente di usare un altro modello AI solo per la ricerca e la preparazione dei file. Il modello non deve mai modificare il progetto o il database. La revisione finale resta manuale.

## Regola fondamentale

L’altro modello deve restituire un pacchetto ZIP, non testo libero e non SQL.

Ogni pacchetto deve avere questa struttura:

```text
nome-candidato/
  data.csv
  discrepancies.csv
  aliases.csv
  manifest.json
  SOURCES.md
  source-files/
    README.md
```

Il pacchetto deve contenere una sola stagione e una sola competizione. Non mischiare Serie A, Serie B, Coppa Italia ed Europa League.

## Prompt da dare all’altro modello

```text
Sei un ricercatore di dati calcistici storici. Devi preparare un pacchetto dati per Sassuolo History.

Non modificare codice, database o repository. Non restituire SQL. Restituisci solo uno ZIP con:
data.csv, discrepancies.csv, aliases.csv, manifest.json, SOURCES.md e source-files/README.md.

Usa fonti dirette e URL completi. Verifica ogni riga con almeno due fonti quando possibile. Non inventare dati: informazione non verificata = campo vuoto/NULL, mai zero. Documenta ogni conflitto.

Prima della consegna controlla conteggi, date ISO, duplicati, identità delle squadre, chiavi naturali, checksum SHA-256 e assenza di TODO/UNKNOWN.

Segui esattamente il file di richiesta specifico che ti allego per stagione, competizione, colonne e controlli.
```

## Dove mettere il pacchetto

1. Scaricare lo ZIP, per esempio in `C:\Users\Coppi\Downloads`.
2. Estrarlo in:

```text
C:\Users\Coppi\Desktop\sassuolo-history-v3\data\reconciliation\candidates\nome-candidato\
```

3. Verificare che `manifest.json` sia direttamente dentro `nome-candidato`, non in una sottocartella doppia.
4. Non sovrascrivere un candidato già importato: usare un nuovo nome con suffisso `-v2`.

Esempio per il pacchetto attuale:

```text
data/reconciliation/candidates/match-details-serie-b-2008-09-resolution/
```

## Registrazione del candidato

Dalla root del progetto eseguire PowerShell:

```powershell
npm.cmd run data:registry
```

Questo aggiorna `research_candidates` e il registro operativo. Non importa ancora i dati nelle tabelle principali.

## Revisione manuale obbligatoria

Prima dell’approvazione controllare:

- `manifest.json`: stagione, competizione, area, numero righe e `validation`;
- `data.csv`: intestazione esatta, codifica UTF-8, date ISO, valori numerici validi;
- corrispondenza con le fixture già nel database;
- nessun duplicato;
- fonti dirette per ogni riga o motivazione dell’assenza;
- `discrepancies.csv`: ogni conflitto deve essere `resolved`, oppure il candidato non va approvato;
- `SOURCES.md`: fonti, copertura e limiti devono corrispondere davvero ai dati;
- nessun dato stimato, copiato senza fonte o trasformato da sconosciuto a zero.

Per i dettagli partita, attenzione: l’importatore attuale riconcilia la partita principalmente tramite la data. Se nella stessa giornata esistono più partite Sassuolo o una data è errata, l’import va bloccato e il CSV corretto prima dell’approvazione.

## Avvio dell’applicazione e controllo candidato

Dalla root:

```powershell
npm.cmd run dev
```

Aprire l’interfaccia locale indicata da Vite e usare il Data Manager. Il candidato deve essere esaminato in anteprima; controllare conteggi `created`, `updated`, `skipped`, `conflicts` ed `errors`.

In alternativa, l’API è disponibile su:

```text
http://localhost:8787/api
```

Il candidato deve risultare prima `in_review`, poi `approved`. Non usare direttamente endpoint di importazione senza aver controllato l’anteprima.

## Sequenza sicura di importazione

```text
ZIP
  ↓
estrazione in data/reconciliation/candidates/
  ↓
npm.cmd run data:registry
  ↓
revisione manuale
  ↓
preview/dry-run
  ↓
approvazione
  ↓
backup automatico
  ↓
import transazionale
  ↓
npm.cmd run data:audit:full
```

L’importazione è ammessa solo se l’anteprima non contiene errori critici, conflitti irrisolti o fixture non riconciliate. Il sistema crea il backup prima della scrittura e registra `import_runs` e `change_log`.

## Dopo l’importazione

Eseguire:

```powershell
npm.cmd run data:audit:full
```

Controllare che:

- l’audit abbia zero violazioni FK;
- non siano comparsi duplicati;
- il numero di righe importate corrisponda al pacchetto;
- `research_candidates.status` sia `imported`;
- esista un backup pre-import;
- l’audit sia stato scritto in `data/reconciliation/audits/`.

Se l’audit fallisce o l’import ha aggiornato righe inattese, fermarsi. Non correggere cancellando righe manualmente: conservare il backup e usare il rollback disponibile dal Data Manager per quel candidato.

## Stati validi

```text
discovered → candidate → validated → in_review → approved → imported
```

Stati alternativi: `rejected`, `superseded`, `rolled_back`.

`reconciled` nel manifest indica che il ricercatore considera il pacchetto riconciliato; non sostituisce la revisione manuale dell’utente.

## Regole per i pacchetti futuri

- Un pacchetto = una tranche piccola e verificabile.
- Prima completare i dettagli base, poi eventi, formazioni, statistiche squadra e statistiche giocatori in pacchetti separati.
- Non importare dati da Markdown o da una risposta chat: solo CSV/JSON accompagnati da manifest e fonti.
- Non usare nomi come chiave se esiste una chiave più forte; per le partite usare data + casa + trasferta e verificare contro il database.
- Mantenere `NULL` per valori non verificati.
- Non modificare `data/docs/` con risultati di ricerca: i pacchetti vanno solo in `data/reconciliation/candidates/`.
