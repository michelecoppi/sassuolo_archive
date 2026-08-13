# Sicurezza dell’area amministrativa

## Modello di accesso

`ADMIN_API_TOKEN` è una credenziale di bootstrap nota soltanto al server e al curatore. Il browser la invia una sola volta a `POST /api/auth/login`; il server la confronta in tempo costante e restituisce una sessione casuale in un cookie `HttpOnly`, `SameSite=Strict` e, in produzione, `Secure`. La credenziale non viene salvata in `localStorage`, `sessionStorage` o in variabili JavaScript persistenti.

Le sessioni durano otto ore, risiedono soltanto nella memoria del processo e vengono quindi revocate anche a ogni riavvio. Ogni scrittura richiede inoltre `X-CSRF-Token`, separato dal cookie. Logout elimina la sessione immediatamente. Le letture del Data Manager, della qualità dati, dei candidati e delle identità richiedono a loro volta una sessione valida.

## Minacce considerate

- furto del token tramite JavaScript o storage del browser: il token non persiste e il cookie non è leggibile da JavaScript;
- richieste cross-site: `SameSite=Strict`, allowlist CORS e token CSRF indipendente;
- brute force: tentativi di login limitati per indirizzo e finestra temporale;
- sessioni dimenticate: scadenza automatica, logout e revoca completa al riavvio;
- cache accidentale di risposte amministrative: l’autenticazione precede la cache e le risposte auth usano `no-store`;
- attribuzione errata: il nome del curatore è conservato nella sessione server e alimenta l’audit, senza fidarsi di header scelti dal client.

Una vulnerabilità XSS può comunque operare con i privilegi della sessione aperta, pur senza leggere il cookie. Per questo restano necessari escaping React, CSP in fase di deployment, dipendenze aggiornate e logout al termine delle operazioni.

## Recupero accesso

1. Generare un nuovo valore lungo e casuale per `ADMIN_API_TOKEN` nel secret store del deployment.
2. Riavviare il processo: tutte le sessioni in memoria vengono invalidate.
3. Verificare un login e un logout dalla route diretta `/data-manager`.
4. Esaminare `security_audit_log` per tentativi o operazioni inattese.

Non inserire mai il token in URL, log, ticket o file del repository.
