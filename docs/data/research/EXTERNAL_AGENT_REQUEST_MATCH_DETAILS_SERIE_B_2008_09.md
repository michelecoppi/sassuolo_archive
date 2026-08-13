# Richiesta ricerca esterna — dettagli partite Sassuolo Serie B 2008/09

## Contesto e punto di ripartenza

Il database contiene già le **42 fixture concluse** del Sassuolo nella stagione regolare di Serie B 2008/09. La stagione e i risultati non devono essere ricreati né modificati. Mancano invece i dettagli strutturati delle singole gare.

Questa è la prossima tranche prioritaria del progetto. Il lavoro deve produrre esclusivamente un pacchetto dati riproducibile; **non modificare il progetto, il database o altri file locali**.

## Consegna

Generare:

`match-details-serie-b-2008-09-resolution.zip`

e salvarlo in:

`C:\Users\Coppi\Downloads\match-details-serie-b-2008-09-resolution.zip`

Struttura obbligatoria:

```text
match-details-serie-b-2008-09-resolution/
  data.csv
  discrepancies.csv
  aliases.csv
  manifest.json
  SOURCES.md
  source-files/
    README.md
```

## Obiettivo della prima tranche

Documentare tutte le 42 partite di regular season con i dettagli verificabili disponibili:

- data civile della partita;
- squadra di casa e squadra ospite;
- stadio/venue, quando verificato;
- arbitro, quando verificato;
- URL diretto del referto o della pagina fonte;
- provider e data di verifica.

Non includere Coppa Italia, playoff o playout. Non inventare dati mancanti: usare campo vuoto/`NULL` e annotare il motivo in `SOURCES.md` o `discrepancies.csv`.

## `data.csv`

CSV UTF-8 con separatore virgola e questa intestazione esatta:

```csv
match_date,home_team,away_team,stadium,referee,source_provider,source_url,last_verified_at
```

Regole:

1. Esattamente 42 righe dati.
2. `match_date` in formato `YYYY-MM-DD`.
3. `home_team` e `away_team` devono corrispondere alle fixture esistenti; Sassuolo deve comparire in ogni riga.
4. Nessun duplicato della coppia `match_date + home_team + away_team`.
5. Usare denominazioni canoniche o documentarle in `aliases.csv`.
6. `source_url` deve essere un URL diretto e puntuale per la partita, non solo la home page di un sito.
7. Se una fonte non espone arbitro o stadio, lasciare il campo vuoto, senza dedurlo da un’altra gara.
8. Risultati e punteggi non sono colonne di questo pacchetto: non alterare le fixture esistenti.

## Fonti richieste

Usare almeno due fonti indipendenti per il controllo delle fixture e almeno una fonte puntuale per i dettagli di ciascuna riga, quando disponibile. Preferire:

- fonte ufficiale o archivio federale/lega;
- WorldFootball, Soccerway, RSSSF, calcio-seriea.net o equivalente storico affidabile;
- archivio di referti con arbitro e stadio.

Wikipedia è ammessa solo come supporto, non come fonte unica. Gli URL devono essere riportati integralmente.

## `discrepancies.csv`

Intestazione obbligatoria:

```csv
match_date,home_team,away_team,field,source_a_value,source_b_value,source_a_url,source_b_url,resolution,status,notes
```

Registrare ogni conflitto su data, denominazione, stadio o arbitro. Usare `resolved` o `unresolved`. Se non ci sono conflitti, lasciare solo l’intestazione.

## `aliases.csv`

Intestazione obbligatoria:

```csv
source_name,selected_team_name,source_provider,notes
```

Inserire, per esempio, abbreviazioni o denominazioni storiche diverse da `Sassuolo` e dai club canonici presenti nelle fixture.

## `manifest.json`

Il manifest deve contenere almeno:

```json
{
  "package_type": "match_details_resolution",
  "area": "match_details",
  "season": "2008/09",
  "competition": "Serie B",
  "source_provider": "FONTE PRINCIPALE + CONTROLLO INCROCIATO",
  "source_url": "URL DIRETTO O INDICE AUTOREVOLE",
  "verified_at": "YYYY-MM-DD",
  "file": "data.csv",
  "row_count": 42,
  "records_total": 42,
  "records_discarded": 0,
  "validation": {
    "status": "reconciled",
    "fixtures_matched": 42,
    "duplicate_fixtures": 0,
    "unresolved_conflicts": []
  },
  "files": {
    "data.csv": { "sha256": "SHA256_REALE" }
  }
}
```

Calcolare davvero lo SHA-256 dopo aver chiuso il CSV. Non usare valori segnaposto.

## Controlli obbligatori prima della consegna

1. 42 righe e 42 fixture Sassuolo della Serie B 2008/09.
2. Tutte le date nel formato corretto.
3. Nessuna fixture duplicata o appartenente a Coppa/playoff.
4. Nomi squadra riconciliati e alias documentati.
5. URL diretti presenti quando la fonte è disponibile.
6. Conflitti espliciti e risolti o marcati `unresolved`.
7. Nessun `TODO`, `UNKNOWN`, dato inventato o zero usato per indicare informazione sconosciuta.
8. ZIP apribile con tutti i file richiesti e checksum reale.

## Nota sulla fase successiva

Eventi, formazioni e statistiche numeriche avanzate non devono essere stimati in questo pacchetto. Se le fonti li rendono disponibili, descriverli in `SOURCES.md` e proporli come tranche separata, mantenendo separati dettagli base, eventi, lineups, team stats e player stats.

`SOURCES.md` deve indicare per ogni fonte: titolo, provider, URL, data di verifica, campi estratti, copertura e limiti.
