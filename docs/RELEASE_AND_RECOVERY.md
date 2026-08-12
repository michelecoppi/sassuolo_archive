# Release e ripristino

## Prerequisiti

- volume persistente montato in `/data`;
- `ADMIN_API_TOKEN` e `CORS_ORIGINS` valorizzati fuori dal repository;
- destinazione esterna separata per `BACKUP_EXPORT_DIR`;
- monitor HTTP su `/api/health`, in allarme per stato `degraded` o `unhealthy`.

## Release

1. Il push di un tag `v*` esegue nuovamente check, test e build, quindi pubblica un'immagine immutabile su GHCR.
2. Sostituire `OWNER` in `compose.production.yml`, impostare `APP_VERSION` al tag e avviare `docker compose -f compose.production.yml up -d`.
3. Verificare `/api/health`, una route diretta frontend e una lettura archivio.
4. Non usare `latest` in produzione: conservare il tag precedente per il rollback.

## Backup esterno e prova di ripristino

Eseguire con scheduler esterno:

```bash
BACKUP_EXPORT_DIR=/mnt/offsite npm run ops:backup
npm run ops:restore-drill -- /mnt/offsite/sassuolo-scheduled-external-export-....db
```

Il primo comando crea uno snapshot SQLite consistente, lo copia senza sovrascrivere file esistenti, ripete checksum e `integrity_check` e salva il file `.sha256`. Conservare almeno una copia fuori dall'host applicativo.

## Rollback

1. Bloccare temporaneamente import e job pianificati.
2. Per rollback applicativo, ripristinare `APP_VERSION` al tag precedente e ricreare solo il container: il volume `/data` resta invariato.
3. Per rollback dati, verificare prima il backup con `ops:restore-drill`, quindi usare il flusso protetto del Data Manager; esso crea un ulteriore snapshot di sicurezza prima del ripristino.
4. Verificare health check, conteggi principali e audit completo; registrare l'incidente nel changelog pubblico.
