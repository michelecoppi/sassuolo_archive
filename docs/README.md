# Documentazione di Sassuolo History

Questo è il punto di ingresso unico per la documentazione del progetto. Il `README.md` nella root resta la guida rapida; specifiche, procedure, verifiche e ricerca sono raccolte qui per area.

## Prodotto

- [Specifica tecnica](product/PROJECT_SPEC.md) — architettura, modello dati e regole di contributo.
- [Roadmap](product/ROADMAP.md) — priorità, criteri di accettazione e storico dei miglioramenti.
- [Guida di stile](product/STYLE_GUIDE.md) — regole visuali, linguistiche e di interazione.

## Architettura

- [Indice degli ADR](architecture/README.md) — decisioni su database, dati, sicurezza e privacy.
- [Modello ADR](architecture/template.md) — struttura da usare per le nuove decisioni.

## Configurazione e accesso

- [API-Football](setup/API_FOOTBALL.md) — configurazione del provider in locale.
- [Sicurezza amministrativa](setup/ADMIN_SECURITY.md) — sessioni, CSRF, credenziali e recupero accesso.

## Operazioni e pubblicazione

- [Release e recovery](operations/RELEASE_AND_RECOVERY.md) — container, backup, restore e rollback.
- [Supply chain](operations/SUPPLY_CHAIN.md) — dipendenze, licenze, SBOM e attestazioni.
- [Osservabilità frontend](operations/FRONTEND_OBSERVABILITY.md) — telemetria, privacy, retention e opt-out.

## Qualità

- [Compatibilità e resilienza](quality/QA_COMPATIBILITY.md)
- [Accessibilità](quality/ACCESSIBILITY_AUDIT.md)
- [Prestazioni](quality/PERFORMANCE_BASELINE.md)
- [Compatibilità dello schema](quality/SCHEMA_COMPATIBILITY.md)

## Dati e ricerca

- [Indice della documentazione dati](data/README.md)
- [Sassuolo Archive Rating](data/PLAYER_RATINGS.md) — formula autonoma, confidenza e flusso di acquisizione delle statistiche per partita.
- [Stato pubblico e changelog](data/PUBLIC_CHANGELOG.md) — contratto delle voci, release atomiche e feed RSS.
- [Piano dati](data/DATA_MASTER_PLAN.md) e [stato di esecuzione](data/DATA_EXECUTION_STATUS.md)
- [Registro dei duplicati e delle identità](data/DUPLICATI_IDENTITA_GIOCATORI.md)
- [Perimetro archivio P1](data/P1_ARCHIVE.md)
- [Catalogo delle fonti](../data/SOURCES.md)
- [Guida ai dataset](../data/README.md) e [riconciliazione](../data/reconciliation/README.md)

I README e i file `SOURCES.md` che descrivono un dataset o un pacchetto restano accanto all’artefatto cui si riferiscono. Tutta la documentazione generale o narrativa nuova va invece inserita nella categoria appropriata sotto `docs/` e collegata da questo indice.
