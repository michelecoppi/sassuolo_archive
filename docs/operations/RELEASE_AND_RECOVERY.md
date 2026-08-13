# Release e ripristino

## Prerequisiti

- volume persistente montato in `/data`;
- `ADMIN_API_TOKEN` e `CORS_ORIGINS` valorizzati fuori dal repository;
- destinazione esterna separata per `BACKUP_EXPORT_DIR`;
- monitor HTTP su `/api/health`, in allarme per stato `degraded` o `unhealthy`.

## Release

1. Il push di un tag `v*` esegue nuovamente check, test e build, quindi pubblica un'immagine immutabile su GHCR.
2. La stessa immagine, identificata dal digest e non ricostruita, viene avviata in staging su un volume dati isolato: startup e migrazioni ne preparano una copia separata dalla produzione. `npm run ops:smoke` controlla health, manifest dataset, archivio paginato e una route SPA diretta.
3. Solo dopo tutti gli smoke riusciti il job protetto dall'environment GitHub `production` sposta il tag `production` su quel digest. Un errore impedisce automaticamente la promozione.
4. In installazioni esterne a GitHub Actions, impostare `APP_VERSION` a un tag o digest verificato e avviare `docker compose -f compose.production.yml up -d`.
5. Non usare `latest` in produzione: annotare il digest precedente per il rollback.

## Backup esterno e prova di ripristino

Obiettivi operativi: **RPO 24 ore**, **RTO 60 minuti**. La destinazione deve essere un volume esterno cifrato; in produzione lo script richiede `BACKUP_ENCRYPTED=1`, almeno 512 MiB liberi e conserva almeno 14 copie, eliminando soltanto backup gestiti più vecchi di 30 giorni.

Eseguire con scheduler esterno:

```bash
BACKUP_EXPORT_DIR=/mnt/offsite npm run ops:backup
npm run ops:restore-drill -- /mnt/offsite/sassuolo-scheduled-external-export-....db
```

Il primo comando crea uno snapshot SQLite consistente, lo copia senza sovrascrivere file esistenti, ripete checksum e `integrity_check` e salva il file `.sha256`. Conservare almeno una copia fuori dall'host applicativo.

Le unità in `deploy/systemd/` eseguono il job ogni giorno e recuperano le esecuzioni perse. Monitorare l’esito del timer e allertare se non esiste una copia più recente di 26 ore. `BACKUP_DRILL_FILE` indica una copia esportata: il drill la apre isolatamente e non modifica il database attivo.

## Rollback

1. Bloccare temporaneamente import e job pianificati.
2. Per rollback applicativo, ripristinare `APP_VERSION` al digest precedente e ricreare solo il container: il volume `/data` resta invariato. Eseguire `npm run ops:smoke` sul servizio ripristinato.
3. Per rollback dati, verificare prima il backup con `ops:restore-drill`, quindi usare il flusso protetto del Data Manager; esso crea un ulteriore snapshot di sicurezza prima del ripristino.
4. Verificare health check, conteggi principali e audit completo; registrare l'incidente nel changelog pubblico.
