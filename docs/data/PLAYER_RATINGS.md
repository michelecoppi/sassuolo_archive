# Sassuolo Archive Rating

## Obiettivo

Il Sassuolo Archive Rating (SAR) assegna un voto riproducibile ai giocatori della stagione corrente senza copiare il rating di un provider. I dati grezzi possono provenire da un referto ufficiale, da una tabella statistica esportata o dall'inserimento manuale; la formula resta interna, versionata e verificabile.

La prima versione è `sar-1.0.0`. Il voto usa la scala **3,0–10,0**, parte da **6,0** e viene arrotondato a un decimo. Un giocatore con meno di 10 minuti resta `N/D`, salvo gol, assist, rigore parato o espulsione.

## Formula 1.0

| Blocco | Regola principale |
| --- | --- |
| Risultato | +0,15 vittoria; −0,15 sconfitta |
| Gol | +1,40 portiere; +1,15 difensore; +0,95 centrocampista; +0,80 attaccante |
| Assist | +0,55 |
| Autogol | −1,00 |
| Tiro | +0,06 per tiro in porta; −0,025 per tiro fuori, entro i limiti dichiarati nel codice |
| Creazione | +0,08 per passaggio chiave, massimo +0,40 |
| Passaggi | Scostamento dalla soglia del ruolo, applicato solo con almeno 10 passaggi; massimo ±0,35 |
| Difesa | Tackle +0,06; blocco/intercetto +0,08; massimo +0,55 |
| Duelli | Scostamento dal 50% di successi, massimo ±0,35 |
| Dribbling | +0,08 riuscito; −0,03 fallito, entro −0,20/+0,35 |
| Disciplina | Giallo −0,15; rosso −1,00; fallo commesso −0,06 |
| Rigori | Procurato +0,35; causato −0,65; sbagliato −0,75; parato +1,10 |
| Portiere | +0,12 per parata; −0,25 per gol subito |
| Clean sheet | Con almeno 60 minuti: +0,45 portiere, +0,30 difensore, +0,15 centrocampista |

I limiti e i pesi effettivi sono definiti da `calculateArchiveRating` in `server/services/archivePlayerRatings.ts`. Ogni risultato salva:

- versione della formula;
- livello dati `BASIC`, `STANDARD` o `DETAILED`;
- confidenza da 0 a 1;
- elenco dei bonus e malus applicati.

Un cambio futuro dei pesi deve creare una nuova versione: i voti storici non vanno reinterpretati silenziosamente.

## Acquisizione delle statistiche

Il flusso consigliato per ogni partita conclusa è:

1. registrare risultato ed eventi nel Centro stagione;
2. aprire **Statistiche e voti** dalla riga della partita;
3. usare la rosa precompilata e selezionare chi è sceso in campo;
4. copiare una tabella CSV/TSV oppure scaricare e ricompilare il modello CSV;
5. indicare l'URL puntuale della fonte;
6. salvare e controllare voto, livello dati e spiegazione.

La pagina partita ufficiale della [Lega Serie A](https://www.legaseriea.it/serie-a) è la fonte primaria consigliata per risultato, formazioni, eventi e statistiche disponibili. [FBref](https://fbref.com/en/comps/11/Serie-A-Stats) può essere usato come riscontro o come tabella esportabile. Non viene effettuato scraping automatico di endpoint interni o non documentati: l'importazione tabellare evita dipendenze fragili e conserva l'URL usato dal curatore.

## Aggregato stagionale

Il voto mostrato nella Rosa attuale è la media dei SAR di partita pesata per i minuti, con peso minimo 15 per non annullare le prestazioni brevi ma valide. Accanto alla media sono mostrati numero di gare coperte e confidenza media.

Le statistiche stagionali già verificate non vengono cancellate. Se i dati per partita coprono più gare del riepilogo stagionale, presenze, titolarità, minuti, gol, assist e cartellini possono essere letti dall'aggregato locale; il SAR ha priorità soltanto per la colonna voto.

## Validazione e calibrazione

La suite automatica usa scenari calcistici verosimili per verificare sia il valore finale sia i fattori mostrati nella spiegazione:

| Scenario di controllo | Esito atteso con `sar-1.0.0` |
| --- | --- |
| Portiere, 90 minuti, 7 parate, 1 rigore parato e 1 gol subito | 7,7–8,1 |
| Difensore, 90 minuti, clean sheet e volume difensivo alto | 7,2–7,6 |
| Centrocampista, 90 minuti, 1 assist e 4 passaggi chiave | 7,2–7,6 |
| Attaccante, 86 minuti, doppietta con alcune inefficienze | 7,5–8,0 |
| Difensore con autogol, rosso e rigore causato | limite minimo 3,0 |
| Subentro di 6 minuti senza evento decisivo | `N/D` |

Sono inoltre verificati limite massimo e minimo, sensibilità al ruolo, aggiornamento idempotente, precompilazione da eventi, fonte obbligatoria e rifiuto di minuti o rapporti statistici impossibili.

Dopo le prime **10 partite reali** con copertura almeno `STANDARD` va eseguita una revisione di calibrazione:

1. controllare distribuzione, mediana e valori anomali separatamente per ruolo;
2. rileggere gli estremi insieme a referto, eventi e statistiche sorgente;
3. verificare che un singolo gruppo di dati non domini sistematicamente il voto;
4. annotare eventuali modifiche proposte con esempi riproducibili;
5. se cambiano i pesi, pubblicare `sar-1.1.0` (o versione successiva) senza riscrivere silenziosamente i voti `sar-1.0.0`.

La calibrazione non usa voti copiati da API esterne come verità di riferimento: serve a controllare coerenza interna, stabilità tra ruoli e aderenza agli eventi verificabili della partita.

## Limiti noti

- Il voto misura ciò che è presente nei dati: errori individuali non codificati, movimenti senza palla e qualità tattica possono mancare.
- `BASIC` non deve essere confrontato come se avesse la stessa profondità di `DETAILED`.
- La formula non sostituisce una valutazione editoriale. Un'eventuale valutazione umana va conservata in un campo distinto, mai sovrascrivendo il SAR.
