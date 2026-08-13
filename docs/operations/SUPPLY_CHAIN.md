# Supply chain e release

Il progetto usa versioni npm esatte e un lockfile committato. Node supportato: 22–24; CI e release usano Node 22. `npm ci` è l'unica installazione ammessa nei workflow.

## Controlli

- `npm run check:supply-chain` verifica versioni esatte, coerenza manifest/lockfile, licenze ammesse ed eccezioni non scadute.
- `npm run check:supply-chain:audit` aggiunge `npm audit` sulle dipendenze di produzione e blocca vulnerabilità `critical`.
- `npm run ops:sbom` genera `sbom.cdx.json` in formato CycloneDX.
- Dependabot raggruppa gli aggiornamenti runtime, sviluppo, Actions e immagine Docker.

Le eccezioni vanno aggiunte a `supply-chain-policy.json` con pacchetto, advisory, motivazione e una data ISO futura in `expiresAt`. Una scadenza superata rende il controllo rosso.

## Artefatti di release

Ogni tag `v*` pubblica l'immagine su GHCR, espone il digest immutabile nel riepilogo del workflow, allega SBOM e provenance BuildKit e crea un'attestazione GitHub verificabile. Per il deploy usare il riferimento `ghcr.io/...@sha256:...`, non un tag mobile.
