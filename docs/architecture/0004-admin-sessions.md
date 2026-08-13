# ADR-0004 — Sessioni amministrative

- Stato: Accettato
- Data: 2026-08-13
- Decisori: manutentori del progetto
- Sostituisce: nessuno

## Contesto

Il Data Manager modifica il database canonico. Inserire il token amministrativo in ogni richiesta o salvarlo nel browser aumenterebbe l’esposizione delle credenziali.

## Decisione

Il token configurato lato server serve solo al login. Una sessione breve viene poi mantenuta in cookie `HttpOnly`, `SameSite=Strict` e `Secure` in produzione; le mutazioni richiedono inoltre un token CSRF. Le letture operative dettagliate sono amministrative, mentre l’health pubblico non espone provider o errori.

## Conseguenze

Client e test devono eseguire login e propagare CSRF. Non esiste recupero password applicativo: la rotazione avviene nella configurazione del deploy.
