# Contesto stagione Serie B 2024/25

## Perimetro

La tranche copre una sola stagione e una sola competizione: Sassuolo, `2024/25`, `Serie B`. Il campo importabile è esclusivamente il capitano stagionale. Allenatore e staff sono conservati nell'archivio tecnico strutturato, senza duplicare dati in `player_seasons`.

## Fonti

- Lega Serie B, **Il Sassuolo alza la Coppa Nexus**: https://www.legab.it/news/il-sassuolo-alza-la-coppa-nexus — fonte istituzionale che identifica esplicitamente Berardi come capitano durante la premiazione del 9 maggio 2025.
- U.S. Sassuolo Calcio, **Sassuolo Campione della Serie BKT 24/25**: https://www.sassuolocalcio.it/prima-squadra/sassuolo-campione-della-serie-bkt-24-25-alzata-al-cielo-la-coppa-nexus/ — conferma ufficiale del club: Berardi riceve e alza la coppa insieme ai compagni.
- U.S. Sassuolo Calcio, **La rinascita**: https://www.sassuolocalcio.it/club/la-nostra-storia/la-rinascita/ — riepilogo ufficiale della stagione, dell'allenatore Fabio Grosso, del primo posto e dei principali risultati.
- TuttomercatoWeb, **Sassuolo, lo staff tecnico di Grosso**: https://www.tuttomercatoweb.com/serie-b/sassuolo-lo-staff-tecnico-di-grosso-raffaele-longo-sara-il-vice-c-e-paolo-orlandoni-1989879 — trascrive l'elenco dello staff pubblicato dal club durante il ritiro 2024/25. È usata per lo staff perché la pagina ufficiale originaria non è più indicizzata; questa limitazione è dichiarata e non viene nascosta.

## Decisioni

- `captain=1` significa capitano stagionale attestato, non semplice presenza con fascia in una singola gara.
- Nessuna statistica già presente viene riscritta: i campi non coperti dalla tranche restano vuoti nel CSV e l'import usa aggiornamenti `COALESCE`.
- Lo staff non viene importato nel database statistico: resta in `data/technical-staff.json`, con una fonte puntuale e visibile nella scheda stagione.
