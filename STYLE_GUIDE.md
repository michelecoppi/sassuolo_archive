# Sassuolo History & Stats — guida di stile

Questa guida definisce il linguaggio visuale dell'app. Ogni pagina e componente nuovo deve usare Tailwind e i componenti in `src/components/Ui.tsx` prima di introdurre classi o colori ad hoc.

## Identità

- Sfondo: `zinc-950` / `zinc-900`; superfici scure leggere e bordi `white/[0.08]`.
- Colore del prodotto: scala `neroverde` (Sassuolo), soprattutto `neroverde-400` per azioni e accenti.
- Testi: `white` per titoli, `zinc-200` per contenuto, `zinc-400` o `zinc-500` per metadati.
- Le card usano sempre la classe `card`; azioni primarie `btn-primary`, secondarie `btn-secondary`, campi `input`.
- Non inserire immagini decorative pesanti. Foto, stemmi e avatar ricevono dimensioni fisse, `object-cover`/`object-contain` e un fallback testuale o grafico.

## Competizioni

Usare `CompetitionBadge` per rendere leggibile il contesto e `competitionAccent()` per una card, un grafico o un header associato a una competizione.

| Competizione | Accento | Uso |
| --- | --- | --- |
| Serie A | smeraldo | badge, bordo laterale delle metriche, linee dei grafici |
| Serie B | azzurro | badge e dati di stagione |
| Serie C | rosa/rosso | badge e dati di stagione |
| Coppa Italia | ambra | badge, turni e riepiloghi a eliminazione |
| Europa / Conference / Champions | viola | badge e dati internazionali |

Per una nuova categoria, aggiungere un solo mapping in `competitionAccent` in `Ui.tsx`: il badge, l'accento card e il colore grafico devono rimanere associati.

## Componenti riutilizzabili

- `PageTitle`: header di ogni pagina, con titolo, contesto e azione eventuale.
- `SeasonHeader`: hero compatto per un dettaglio stagione.
- `StatCard`: numeri sintetici; passare `competition` quando il dato è filtrato/legato a una gara.
- `FilterBar`: contenitore per filtri, responsive a griglia.
- `DataTable`: wrapper accessibile per tabelle larghe e scroll orizzontale su mobile.
- `SectionTabs`: schede orizzontali scrollabili su piccoli schermi.
- `EmptyState` (alias di `Empty`): sempre per assenze di dati, mai una tabella vuota.
- `PlayerCard` e `MatchCard`: preview dense, con fallback sicuro per avatar e immagini.

## Tabelle e responsive

Usare `DataTable` o `table-wrap` con `table`: su mobile la tabella mantiene leggibilità tramite scroll orizzontale. Non comprimere colonne e valori numerici fino a renderli illeggibili. Le griglie delle metriche partono a due colonne e aumentano con `md:`/`xl:`.

Tutti gli elementi interattivi devono conservare il focus visibile tramite le classi `btn` o `input`. Testo normale minimo: `text-sm`; per metadati `text-xs` soltanto quando secondari.
