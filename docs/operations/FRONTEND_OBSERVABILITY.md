# Osservabilità frontend e privacy

L'app registra eccezioni non gestite, errori dei boundary, fallimenti dei chunk delle route e Web Vitals essenziali (CLS, FCP, INP, LCP e TTFB). Ogni evento contiene release, route normalizzata, stato online/offline e un contesto tecnico ristretto.

Non vengono inviati query string, termini di ricerca, token, email, IP applicativi o contenuti inseriti dagli utenti. Lo stack non è conservato: il server salva soltanto un hash SHA-256 dopo la redazione. Le chiavi di contesto ammesse sono `component`, `chunk`, `effectiveType` e `visibility`.

I Web Vitals sono campionati al 20%; errori e fallimenti route al 100%. Il database conserva al massimo 10.000 eventi e li elimina dopo 30 giorni. Il riepilogo è protetto ed è consultabile nel Data Manager o via `GET /api/telemetry/frontend/summary`.

L'utente può disattivare o riattivare la raccolta dalla sezione Privacy della pagina Metodologia. `Global Privacy Control` e `Do Not Track` disattivano sempre l'invio. La preferenza resta soltanto nel browser (`sassuolo-telemetry-opt-out`).
