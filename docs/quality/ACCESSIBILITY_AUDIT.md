# Audit accessibilità WCAG 2.2 AA

Data: 11 agosto 2026. Aggiornato il 21 agosto 2026.

## Copertura automatica

Playwright + axe-core blocca la CI sulle rotte Panoramica, Partite, Giocatori, Stagioni, Preferiti e Stato e novità con tag WCAG 2 A/AA, 2.1 A/AA e 2.2 AA. Il flusso E2E verifica inoltre skip link, destinazione del focus, route dirette e breakpoint mobile; la pagina Stato controlla anche filtri persistenti nell’URL e assenza di overflow.

La Time Machine in Panoramica usa un `input[type=range]` con nome e valore stagionale accessibili, pulsanti precedente/successiva con stato disabilitato, aggiornamento `aria-live` non invasivo e un grafico SVG con `title`, `desc` e riepilogo testuale. Lo swipe è un'alternativa, non l'unico metodo di controllo. L'animazione della linea rispetta sia `prefers-reduced-motion` sia la preferenza applicativa.

Match Cinema è un dialogo fullscreen con nome accessibile, focus intrappolato e ripristinato alla chiusura, `Escape`, frecce, barra spaziatrice e controlli equivalenti visibili. La riproduzione parte in pausa e si ferma quando la scheda è nascosta. La decorazione SVG è esclusa dall'albero accessibile, il racconto resta testuale e la riduzione del movimento elimina reveal e pulsazioni. L'E2E apre direttamente un capitolo `DETAILED`, esegue axe sul dialogo e controlla anche il fallback `BASIC` e l'assenza di overflow mobile.

## Verifica manuale richiesta a ogni modifica strutturale

- tastiera: ordine logico, focus sempre visibile, nessun blocco e chiusura delle finestre con Escape;
- screen reader: landmark, titoli, breadcrumb, stato offline e messaggi asincroni annunciati una sola volta;
- zoom 200% e 400%: nessuna perdita di contenuto o controllo, salvo scorrimento bidimensionale delle tabelle dati;
- contrasto: testo e controlli verificati insieme all'audit axe, includendo hover, focus e stato disabilitato;
- movimento: media query di sistema e comando applicativo riducono animazioni e transizioni;
- mobile: tabelle con vista card ove prevista e controlli principali con target minimo di 40 px.

Le pagine amministrative dense richiedono una seconda revisione manuale prima di ogni variazione sostanziale dei modali o degli editor.
