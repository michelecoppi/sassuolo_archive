# ADR-0002 — Semantica di NULL e N/D

- Stato: Accettato
- Data: 2026-08-13
- Decisori: manutentori del progetto
- Sostituisce: nessuno

## Contesto

Nei dati storici un valore assente non equivale quasi mai a zero. Convertirlo implicitamente altererebbe statistiche, classifiche e percezione della copertura.

## Decisione

Un dato sconosciuto si conserva come `NULL` nel database e si mostra come `N/D` nell’interfaccia. Zero è ammesso soltanto quando la fonte lo dichiara o quando una formula documentata lo determina. Import e API non applicano fallback numerici silenziosi.

## Conseguenze

Le viste e le metriche devono gestire esplicitamente i valori mancanti. La copertura risulta più onesta, anche se alcune aggregazioni richiedono controlli aggiuntivi.
