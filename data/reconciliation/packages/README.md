# Pacchetti di riconciliazione

Gli archivi `.zip` in questa cartella sono artefatti di consegna rigenerabili e non vengono salvati nella normale cronologia Git. I file `.sha256` restano versionati per identificare l’ultima build verificata; gli ZIP possono essere conservati localmente o pubblicati come asset di una GitHub Release.

I dataset canonici, i manifest, le fonti, le licenze e gli script necessari a ricostruire i pacchetti restano nelle rispettive cartelle `data/reconciliation/candidates/`. Le fonti grezze di grandi dimensioni sono archiviate tramite Git LFS.
