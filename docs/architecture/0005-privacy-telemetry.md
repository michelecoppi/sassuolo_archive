# ADR-0005 — Telemetria rispettosa della privacy

- Stato: Accettato
- Data: 2026-08-13
- Decisori: manutentori del progetto
- Sostituisce: nessuno

## Contesto

Errori frontend e prestazioni devono essere osservabili senza trasformare un archivio pubblico in uno strumento di tracciamento degli utenti.

## Decisione

La telemetria è first-party, aggregata e limitata a errori tecnici e Web Vitals. Non registra identità, indirizzi completi, contenuti inseriti, fingerprint o dati di navigazione cross-site. Applica minimizzazione, retention dichiarata e opt-out locale.

## Conseguenze

Il debugging non dispone di replay o profili individuali. Le informazioni raccolte sono però proporzionate allo scopo operativo e possono essere cancellate senza dipendenze esterne.
