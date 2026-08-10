# Registro riconciliazione dati

Aggiornamento iniziale: 2026-08-09.

Questo documento è la vista umana del registro operativo. Gli allegati sono raccolti in `data/reconciliation/`; il dettaglio aggiornato degli import, degli audit e dei candidati è in SQLite. Per riallineare i pacchetti candidati eseguire:

```powershell
npm.cmd run data:registry
```

## Perimetri

| Area | Perimetro | Canale | Stato | Prossima azione |
| --- | --- | --- | --- | --- |
| Match/results | 26 stagioni, 726 fixture | Archivio locale + provider corrente | Stabile | Non reimportare senza discrepanza |
| Serie A corrente | stagione attiva | KickoffAPI | Operativo | Sincronizzare giornalmente con budget |
| PlayerSeason | Serie B 2012/13 e 2011/12 candidati | Pacchetti verificabili | In revisione | Risolvere coverage e discrepanze |
| PlayerSeason | Serie A 2013/14–2021/22 | Ricerca/export | Da ricercare | Una stagione alla volta |
| Classifiche | stagioni non ancora complete | Export completo | Da ricercare | Non derivare dalle sole gare Sassuolo |
| Team stats | combinazioni storiche mancanti | Provider/export | Da ricercare | Importare solo campi espliciti |
| Match details | storico precedente alla coverage provider | Match report | Da ricercare | Procedere per competizione |
| Coppa Italia | 2008/09–2025/26 | Lega Serie A/FIGC + archivio cross-check | Da ricercare per annata | Partire da 2008/09, poi 2009/10; separare risultato, match report ed eventi |
| Europa League | 2016/17, 10 fixture | UEFA matchinfo/press kit | Candidato pronto | Revisionare e importare `match-details-europa-league-2016-17` |

## Comandi ufficiali

```powershell
npm.cmd run data:registry       # registra/aggiorna i manifest candidati
npm.cmd run data:audit:full     # salva report JSON e audit_run
npm.cmd run check               # controllo TypeScript
npm.cmd test                    # test automatici
npm.cmd run build               # build completa
```

## Criterio di chiusura

Un blocco è chiuso solo quando esistono fonte puntuale, manifest/checksum, diff approvato, backup, import riuscito e audit senza regressioni.
