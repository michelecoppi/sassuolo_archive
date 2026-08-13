# Compatibilità dello schema SQLite

La versione corrente dello schema è la **9**. È supportato e verificato automaticamente l’upgrade dalla versione immediatamente precedente, attualmente la **8**.

La fixture dichiarativa `tests/fixtures/schema/v8.sql` trasforma un database appena inizializzato nella forma precedente e aggiunge un record sentinella. `tests/schema-compatibility.test.ts` verifica:

- migrazione alla versione corrente e secondo avvio idempotente;
- `PRAGMA integrity_check` e integrità referenziale;
- conservazione del record sentinella e presenza delle nuove colonne;
- ripristino dei dati della versione 8 dentro lo schema corrente tramite backup con checksum.

Quando viene aggiunta una migrazione, la versione che diventa “precedente” deve ricevere una fixture equivalente prima di rimuovere quella più vecchia. Database più vecchi della finestra supportata vanno prima aggiornati con una release intermedia oppure ripristinati seguendo `RELEASE_AND_RECOVERY.md`.
