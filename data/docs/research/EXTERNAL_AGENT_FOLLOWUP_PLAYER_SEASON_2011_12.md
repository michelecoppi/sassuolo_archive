# Correzione richiesta — PlayerSeason Sassuolo 2011/12

Il pacchetto `player-season-2011-12-resolution.zip` supera i controlli formali ma non può essere considerato `reconciled`.

## Problema verificato

La fonte WorldFootball citata nel pacchetto è direttamente accessibile e contiene una tabella completa per la Serie B 2011/12:

`https://www.worldfootball.net/teams/te13744/sassuolo-calcio/se7203/2011-2012/statistics-matches/`

La tabella pubblica per 27 giocatori:

- presenze;
- minuti;
- titolarità;
- ingressi;
- uscite;
- gol;
- gialli;
- giallo-rossi;
- rossi;
- posizione.

Il pacchetto afferma invece che WorldFootball conferma soltanto Pomini e che non esiste una seconda fonte completa accessibile. Questa affermazione va corretta.

## Differenze già osservate

Esempi verificati visivamente:

| Giocatore | Campo | StatsCrew/data.csv | WorldFootball |
| --- | --- | ---: | ---: |
| Alberto Pomini | cartellini gialli | 1 | 2 |
| Alessandro Longhi | minuti | 3460 | 3468 |
| Gianluca Sansone | minuti | 2980 | 2993 |
| Francesco Magnanelli | minuti | 2870 | 2871 |
| Isaac Cofie | presenze | 34 | 35 |
| Isaac Cofie | minuti | vuoto | 2581 |
| Richmond Boakye | presenze | 33 | 32 |
| Richmond Boakye | minuti | vuoto | 1650 |
| Alberto Vaccari | minuti | vuoto | 90 |
| Alberto Vaccari | posizione | vuoto | Midfield |
| Nicolò Consolini | posizione | vuoto | Defence |
| Alessandro Noselli | posizione | vuoto | Forward |

Esistono inoltre numerose differenze minori sui minuti. Non scegliere automaticamente una fonte: occorre confrontare tutte le 27 righe e spiegare la semantica delle differenze.

## Lavoro richiesto

1. Estrarre la tabella WorldFootball completa delle 27 righe.
2. Confrontarla campo per campo con StatsCrew.
3. Aggiungere a `discrepancies.csv` ogni differenza di:
   - presenze;
   - titolarità;
   - minuti;
   - gol;
   - cartellini;
   - posizione.
4. Verificare se StatsCrew conta le presenze in modo diverso, per esempio includendo una competizione o una gara che WorldFootball esclude.
5. Confermare che la pagina WorldFootball selezionata sia `Serie B - 2011/2012` e non playoff o Coppa Italia.
6. Non usare i valori WorldFootball per gli assist: quella tabella non pubblica assist.
7. Decidere per ogni campo quale fonte mantenere, con motivazione. Se non è possibile stabilire quale sia corretta, usare `source_conflict` e lasciare il pacchetto non riconciliato.
8. Ricalcolare somme presenze, titolarità, minuti, gol e cartellini per entrambe le fonti.
9. Aggiornare `SOURCES.md`, eliminando l'affermazione che WorldFootball non è accessibile o conferma soltanto Pomini.
10. Aggiornare manifest, `records_total` e SHA-256.

## Consegna

Restituire nuovamente:

```text
player-season-2011-12-resolution-v2/
  data.csv
  worldfootball.csv
  discrepancies.csv
  manifest.json
  SOURCES.md
  source-files/
```

`worldfootball.csv` deve avere:

```csv
player_name,season,competition,appearances,minutes,starts,substitutes_in,substitutes_out,goals,yellow_cards,yellow_red_cards,red_cards,position,source_provider,source_url,last_verified_at
```

Non impostare `manifest.validation.status = reconciled` finché tutte le differenze non sono elencate e risolte o motivate. La coincidenza dei 57 gol è positiva, ma non basta a riconciliare presenze, minuti e cartellini.
