# Piano dati Sassuolo History & Stats

Baseline: ultimo audit disponibile `audit-full-2026-08-09T20-22-09-704Z.json`. Questo documento descrive lo stato osservato; non autorizza import o cancellazioni.

## 1. Stato attuale

Il DB contiene 26 righe stagione/competizione, 726 partite, 469 giocatori, 807 PlayerSeason, 837 trasferimenti, 44 dettagli partita, 261 eventi, 28 formazioni, 28 statistiche squadra-match, 648 statistiche giocatore-match, 60 righe classifica e 4 riepiloghi squadra-stagione. La struttura raggruppa correttamente più competizioni nella stessa stagione tramite la coppia `season + competition`.

L'audit non rileva violazioni FK, fixture duplicate, quasi-duplicati giocatore, eventi invalidi o trasferimenti duplicati. Restano un conflitto registrato e tre news con titolo normalizzato duplicato. `import_runs=0` rende incompleta la tracciabilità degli import storici, anche se esistono 9 backup e 3 audit.

Provenienza debole: tutti gli 837 trasferimenti non hanno URL puntuale; 258/469 giocatori non hanno URL; 19 giocatori non hanno ID sorgente. I `NULL` più rilevanti nei match sono arbitro 726/726, presenza 726/726, stadio 712/726 e xG 718/726: non vanno trasformati in zero.

## 2. Stato dei documenti `DATA_*`

La mappa completa è nell'[indice](README.md). I cinque file prima in root sono stati classificati e spostati per funzione. Contengono documentazione, non righe da importare: non risultano duplicati del DB né conflitti applicabili record-per-record. Il report audit è uno snapshot da conservare; policy e brief restano attivi; il registro va riallineato allo stato macchina; la ricerca Coppa/Europa alimenta soltanto pacchetti candidati.

## 3–5. Matrice stagioni, lacune e dettaglio match

Legenda dettaglio `D/E/L/T/P`: match con details/eventi/formazioni/team stats/player stats. `PS a/b` = PlayerSeason con presenze valorizzate/totali. `Cl` = righe classifica; `TS` = riepiloghi squadra. La rosa è considerata presente quando esistono PlayerSeason, ma non “completa” finché identità e fonte non sono validate. I trasferimenti sono presenti globalmente, non attribuibili con affidabilità per stagione finché manca provenienza puntuale.

| Stagione | Competizione | Match | D/E/L/T/P | PS a/b | Cl/TS | Priorità e azione |
| --- | --- | ---: | --- | ---: | ---: | --- |
| 2008/09 | Serie B | 42/42 | 0/0/0/0/0 | 0/38 | 0/0 | P0: statistiche giocatore; poi classifica e dettagli |
| 2009/10 | Serie B | 42/42 | 0/0/0/0/0 | 0/36 | 0/0 | P0: statistiche giocatore; poi classifica e dettagli |
| 2010/11 | Serie B | 42/42 | 0/0/0/0/0 | 0/41 | 0/0 | P0: statistiche giocatore; poi classifica e dettagli |
| 2011/12 | Serie B | 42/42 | 0/0/0/0/0 | 0/41 | 0/0 | P0: revisionare candidato PlayerSeason |
| 2012/13 | Serie B | 42/42 | 0/0/0/0/0 | 0/33 | 0/0 | P0: revisionare candidato PlayerSeason |
| 2013/14 | Serie A | 38/38 | 0/4/0/0/0 | 38/38 | 0/0 | P1: classifica/team stats; dettaglio incompleto |
| 2014/15 | Serie A | 38/38 | 0/2/0/0/0 | 27/27 | 0/0 | P1: classifica/team stats; dettaglio incompleto |
| 2015/16 | Serie A | 38/38 | 0/1/0/0/0 | 26/26 | 0/0 | P1: classifica/team stats; dettaglio incompleto |
| 2016/17 | Serie A | 38/38 | 0/1/0/0/0 | 28/28 | 0/0 | P1: classifica/team stats; dettaglio incompleto |
| 2016/17 | Europa League | 10/10 | 0/0/0/0/0 | 28/28 | 0/0 | P0: revisionare candidato UEFA 10/10 |
| 2017/18 | Serie A | 38/38 | 0/2/0/0/0 | 29/29 | 0/0 | P1: classifica/team stats; dettaglio incompleto |
| 2018/19 | Serie A | 38/38 | 0/5/0/0/0 | 29/29 | 0/0 | P1: classifica/team stats; dettaglio incompleto |
| 2019/20 | Serie A | 38/38 | 0/2/0/0/0 | 31/31 | 0/0 | P1: aggiungere Coppa; classifica/team stats |
| 2020/21 | Serie A | 38/38 | 0/2/0/0/0 | 28/28 | 0/0 | P1: classifica/team stats; dettaglio incompleto |
| 2020/21 | Coppa Italia | 1/1 | 0/0/0/0/0 | 15/15 | 0/0 | P2: match report e provenienza |
| 2021/22 | Serie A | 38/38 | 0/1/0/0/0 | 29/29 | 0/0 | P1: classifica/team stats; dettaglio incompleto |
| 2021/22 | Coppa Italia | 2/2 | 0/0/0/0/0 | 19/19 | 0/0 | P2: match report e provenienza |
| 2022/23 | Serie A | 38/38 | 0/2/0/0/0 | 43/46 | 20/1 | P1: risolvere 3 PS parziali; dettaglio |
| 2022/23 | Coppa Italia | 1/1 | 0/0/0/0/0 | 16/16 | 0/0 | P2: match report e provenienza |
| 2023/24 | Serie A | 38/38 | 0/2/0/0/0 | 39/60 | 20/1 | P0: riconciliare 21 PS parziali/duplicati logici |
| 2023/24 | Coppa Italia | 3/3 | 0/0/0/0/0 | 37/37 | 0/1 | P2: match report e provenienza |
| 2024/25 | Serie B | 38/38 | 1/2/1/1/1 | 41/53 | 20/1 | P0: riconciliare 12 PS parziali; dettaglio |
| 2024/25 | Coppa Italia | 3/3 | 3/3/3/3/3 | 28/28 | 0/0 | P2: verificare completezza campo-per-campo |
| 2025/26 | Serie A | 38/38 | 38/10/8/8/8 | 28/28 | 0/0 | P0: classifica/team stats; 30 match senza deep stats |
| 2025/26 | Coppa Italia | 2/2 | 2/2/2/2/2 | 23/23 | 0/0 | P1: classifica N/A; verificare completezza |
| 2026/27 | Serie A | 0/— | — | 0/0 | 0/0 | predisposta: calendario futuro, nessun risultato inventato |

Le Coppe 2008/09–2019/20 non hanno righe stagione/competizione nella baseline: prima verificare se il Sassuolo partecipò e quante gare disputò, poi creare candidati separati. “Complete” deve essere calcolato solo quando tutti i blocchi richiesti e la loro provenienza sono presenti; oggi non è dimostrabile dal solo conteggio delle tabelle.

## 6. Incoerenze e duplicazioni principali

1. Copertura competizioni storiche incompleta: le Coppe anteriori al 2020/21 non sono modellate.
2. Il conteggio rosa non equivale a statistiche: 189 PlayerSeason Serie B hanno presenze `NULL`.
3. 2023/24 e 2024/25 hanno PlayerSeason parziali da riconciliare, senza assumere che siano duplicati fisici.
4. Dettaglio match molto scarso; alcuni eventi esistono anche senza `match_details`, quindi lo stato va calcolato per blocco.
5. Provenienza assente o troppo larga per trasferimenti e parte di giocatori/PlayerSeason.
6. Tre news duplicate per titolo; risolvere con canonical URL e preview.

## 7–8. Regole import CSV/JSON e dry-run

Ogni import segue `discover → validate → reconcile → preview → approve → backup → apply transaction → audit`. La validazione controlla schema/versione, UTF-8, date ISO, numeri, stagione e competizione esistenti, squadre/alias, identità giocatore, chiave fixture, minuti evento, compatibilità punteggio e fonte per riga.

La preview deve produrre checksum del file e conteggi `create/update/skip/conflict/error`, diff campo-per-campo, record non riconciliati e severità. Un errore critico blocca tutto. Il dry-run non apre transazioni di scrittura e salva un report leggibile. L'applicazione richiede conferma sullo stesso checksum, crea backup, usa una transazione atomica e registra `import_runs`; checksum già importato e chiavi naturali rendono il processo idempotente. Fallimento = rollback, esito visibile e nessun successo parziale silenzioso.

## 9. Riconciliazione identità

- Stagione: formato canonico `YYYY/YY`; competizione tramite tabella canonica, mai testo libero non validato.
- Squadra: ID canonico + alias normalizzato (case, spazi, punteggiatura); alias ambiguo produce conflitto.
- Match: `competition + season + local_date + home_team_id + away_team_id`; l'orario non identifica la gara.
- Giocatore: prima ID provider mappato, poi identificatori forti; il solo nome genera candidato, non merge automatico.
- Evento/statistica: FK al match riconciliato e, se disponibile, al giocatore; nomi irrisolti finiscono in conflitto.
- Trasferimento: giocatore + data/finestra + squadra origine/destinazione + tipo; stessa identità logica = skip/update controllato.

## 10. Protezione manuale e verificata

Ordine di autorità per campo: override manuale verificato > fonte ufficiale verificata > provider strutturato > candidato non revisionato. Un import non sovrascrive i primi due livelli: apre un conflitto con valori vecchio/nuovo, fonti e timestamp. Implementare `field_overrides`, `source_references` per campo e `change_log` append-only; cancellazioni tramite soft-delete o backup + impact preview. `NULL` resta “non noto”, mai zero implicito.

## 11. Piano Data Manager

Creare un hub “Qualità dati” con: matrice stagione/competizione e filtri; badge Basic/Events/Lineups/Team stats/Player stats/Complete/Unknown; inventario file/candidati; wizard dry-run; coda conflitti; editor override; record verificati/mancanti; log import e audit; backup/ripristino. Ogni errore deve mostrare riga, campo, codice, causa e azione suggerita. Dashboard iniziale: ultimo audit, regressioni, incompletezze prioritarie e operazioni in attesa di conferma.

## 12. Roadmap

1. **Fase 1 — audit e mappatura:** rendere ripetibile la matrice, inventariare ogni dataset/candidato e congelare la baseline.
2. **Fase 2 — normalizzazione:** entità competizione, alias squadre, identità giocatori, chiavi naturali e override per campo.
3. **Fase 3 — import controllato:** validatori versionati, dry-run, checksum, backup, transazione, log e rollback; pilotare sul candidato Europa.
4. **Fase 4 — completamento 2008/09–2025/26:** prima PlayerSeason Serie B e Coppe mancanti, poi classifiche/team stats, infine dettagli match in base alla fonte.
5. **Fase 5 — tracking 2026/27:** import calendario senza punteggi, aggiornamenti incrementali backend, freshness e stato provider; risultati solo dopo evento verificato.
6. **Fase 6 — UI/UX:** portare audit, diff, conflitti, backup e ripristino nel Data Manager con linguaggio comprensibile.

## 13. Primi task pratici

1. Aggiungere una scansione CI che fallisca se un nuovo `DATA_*` compare nella root.
2. Estendere l'audit con stato dettagliato per singolo match e matrice esportabile.
3. Implementare `import_runs` reale e il contratto universale del report dry-run.
4. Implementare override per campo e blocco di overwrite manuale/verificato.
5. Revisionare, in dry-run, il candidato Europa League 2016/17.
6. Revisionare i candidati PlayerSeason 2012/13 e 2011/12, risolvendo identità e coverage.
7. Censire le partecipazioni di Coppa 2008/09–2019/20 senza creare fixture non verificate.
8. Deduplicare le tre news soltanto dopo preview e backup.
