# Documentazione dati

Questa cartella è l'unico punto di raccolta per i documenti `DATA_*`. I file importabili restano nelle cartelle dati dedicate e gli artefatti macchina restano in `data/reconciliation/`.

## Indice

| Documento | Tipo | Contenuto e perimetro | Entità | Qualità/stato | Azione |
| --- | --- | --- | --- | --- | --- |
| [`DATA_MASTER_PLAN.md`](DATA_MASTER_PLAN.md) | Markdown | Audit consolidato 2008/09–2026/27 | tutte | Piano attivo basato sull'audit JSON 2026-08-09 | mantenere aggiornato |
| [`DATA_EXECUTION_STATUS.md`](DATA_EXECUTION_STATUS.md) | Markdown | Avanzamento implementazione e input esterni richiesti | import, candidati, fonti | Stato operativo corrente | aggiornare a ogni tranche |
| [`audits/DATA_AUDIT_REPORT_2026-08-09.md`](audits/DATA_AUDIT_REPORT_2026-08-09.md) | Markdown | Snapshot DB e Data Manager | tutte | Snapshot utile, alcuni conteggi superati dall'audit successivo | archiviare come evidenza |
| [`research/DATA_RESEARCH_BRIEF_2026-08-09.md`](research/DATA_RESEARCH_BRIEF_2026-08-09.md) | Markdown | Lacune e regole di ricerca 2008/09–2026/27 | giocatori, statistiche, match, classifiche, trasferimenti | Brief ancora utile; non è un dataset | usare per pacchetti candidati |
| [`research/EXTERNAL_AGENT_DATA_REQUEST.md`](research/EXTERNAL_AGENT_DATA_REQUEST.md) | Markdown | Mandato autosufficiente per ricerca senza accesso al codice | PlayerSeason, classifiche, coppe, trasferimenti, dettagli match | Istruzioni operative attive | consegnare una tranche per volta |
| [`research/EXTERNAL_AGENT_REQUEST_PLAYER_SEASON_2011_12.md`](research/EXTERNAL_AGENT_REQUEST_PLAYER_SEASON_2011_12.md) | Markdown | Mandato dedicato alla prossima tranche | PlayerSeason Serie B 2011/12 | Pronto per agente esterno | richiedere ZIP di risoluzione |
| [`research/EXTERNAL_AGENT_FOLLOWUP_PLAYER_SEASON_2011_12.md`](research/EXTERNAL_AGENT_FOLLOWUP_PLAYER_SEASON_2011_12.md) | Markdown | Correzione richiesta dopo verifica della fonte WorldFootball | PlayerSeason Serie B 2011/12 | Bloccante | richiedere versione 2 |
| [`research/EXTERNAL_AGENT_REQUEST_PLAYER_SEASON_2010_11.md`](research/EXTERNAL_AGENT_REQUEST_PLAYER_SEASON_2010_11.md) | Markdown | Mandato completo per la tranche successiva | PlayerSeason Serie B 2010/11 | Pronto per agente esterno | richiedere pacchetto riconciliato |
| [`research/EXTERNAL_AGENT_FOLLOWUP_PLAYER_SEASON_2010_11.md`](research/EXTERNAL_AGENT_FOLLOWUP_PLAYER_SEASON_2010_11.md) | Markdown | Ricerca puntuale del gol non attribuito | Serie B 2010/11 | Bloccante | identificare 42° gol squadra |
| [`research/REVIEW_PLAYER_SEASON_2012_13_RESOLUTION.md`](research/REVIEW_PLAYER_SEASON_2012_13_RESOLUTION.md) | Markdown | Revisione del pacchetto esterno 2012/13 | PlayerSeason Serie B | Tecnicamente valido, riconciliazione incompleta | identificare il secondo gol |
| [`research/DATA_CUP_EUROPA_RESEARCH_2026-08-09.md`](research/DATA_CUP_EUROPA_RESEARCH_2026-08-09.md) | Markdown | Coppa Italia 2008/09–2025/26; Europa 2016/17 | match e dettagli | Ricerca parziale, fonti puntuali; nessun dato va importato dal Markdown | revisionare il candidato Europa |
| [`reconciliation/DATA_RECONCILIATION_POLICY.md`](reconciliation/DATA_RECONCILIATION_POLICY.md) | Markdown | Regole di qualità e stati del flusso | tutte | Policy attiva | applicare a ogni import |
| [`reconciliation/DATA_RECONCILIATION_REGISTER.md`](reconciliation/DATA_RECONCILIATION_REGISTER.md) | Markdown | Vista umana del registro | tutte | Snapshot operativo; SQLite/registry JSON prevalgono | rigenerare/aggiornare dopo audit |

## Regola di collocazione

- Nuovi audit narrativi: `data/docs/audits/`.
- Brief e risultati di ricerca: `data/docs/research/`.
- Policy e registri leggibili: `data/docs/reconciliation/`.
- Dataset candidati: `data/reconciliation/candidates/<area>-<stagione>/`.
- Report macchina: `data/reconciliation/audits/`.

Un Markdown non è mai una sorgente importabile. Ogni candidato deve avere `data.csv` o `data.json`, `manifest.json`, checksum e `SOURCES.md`.
