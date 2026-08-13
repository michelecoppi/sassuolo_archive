# Probe SofaScore per DATA-01

Data: 2026-08-13. Perimetro: sola verifica di disponibilità, senza scraping massivo.

Fonte tecnica accreditata: [SofaScore Scraper di Tuncay Eşsiz](https://github.com/tunjayoff/sofascore_scraper), licenza MIT. Il progetto usa le API HTTP pubbliche di SofaScore, dichiara di non essere affiliato a SofaScore e raccomanda frequenze ragionevoli e rispetto dei termini applicabili.

Endpoint verificato: `https://www.sofascore.com/api/v1/unique-tournament/23/seasons` (Serie A). Due richieste a basso volume — user-agent identificativo e intestazioni browser standard — hanno entrambe restituito HTTP 403. Non sono stati tentati aggiramenti, proxy o richieste massive.

Esito: **fonte non importabile automaticamente nell'ambiente attuale**. Nessun dato SofaScore è stato inserito nel database. Il connettore resta una fonte opzionale per colmare lacune soltanto dopo accesso conforme e una nuova revisione di termini, disponibilità e provenienza.
