# ADR-0001 — SQLite e approccio local-first

- Stato: Accettato
- Data: 2026-08-13
- Decisori: manutentori del progetto
- Sostituisce: nessuno

## Contesto

L’archivio deve essere consultabile e modificabile da una piccola redazione, funzionare senza dipendere da servizi cloud e poter essere copiato integralmente.

## Decisione

SQLite è il database canonico. Import, migrazioni e correzioni operano localmente e in transazione; la produzione monta il file su volume persistente. I provider esterni arricchiscono il database ma non sono necessari per le letture pubbliche.

## Conseguenze

Deploy e backup restano semplici e portabili. Scritture concorrenti e scalabilità orizzontale sono intenzionalmente limitate; un passaggio a un database di rete richiederà un nuovo ADR e un piano di migrazione verificato.
