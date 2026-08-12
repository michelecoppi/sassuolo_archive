# Matrice di compatibilità e resilienza

Ultima verifica: 11 agosto 2026.

| Ambiente | Copertura automatica | Stato |
| --- | --- | --- |
| Chromium desktop (ultime 2 versioni) | flussi critici, route dirette, refresh, visual regression | supportato |
| Firefox desktop (ultime 2 versioni) | flussi critici, route dirette, refresh nella CI Linux; escluso su Windows per il blocco di avvio del runtime Playwright locale | supportato in CI |
| WebKit / Safari corrente | flussi critici, route dirette, refresh | supportato |
| Chromium mobile, 393×851 | navigazione, filtri, editor, assenza overflow | supportato |

La suite `npm run test:e2e` usa `.tmp/e2e-sassuolo.db`, conserva trace, screenshot e video solo in caso di errore e non legge né modifica il database dell’archivio. Le pagine hanno un error boundary di route, quindi un errore circoscritto non lascia una pagina bianca.

Il proxy immagini accetta solo HTTPS e host esplicitamente ammessi, richiede formati moderni al provider, limita ogni asset a 5 MB e applica cache per 24 ore. Se il processo server non può raggiungere un host già autorizzato, risponde con un redirect controllato allo stesso URL affinché sia il browser a tentare il caricamento; URL non ammessi e risposte remote non valide conservano il segnaposto SVG. Host aggiuntivi per immagini RSS possono essere dichiarati con `IMAGE_PROXY_HOSTS`, separati da virgola. Ogni immagine deve dichiarare dimensioni, testo alternativo utile quando informativa e fallback stabile.
