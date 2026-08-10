# Fonti — dettagli partite Sassuolo Serie B 2008/09

Verifica eseguita: 2026-08-10

## Perimetro

- Stagione: `2008/09`
- Competizione: `Serie B`
- Oggetto: dettagli base delle 42 fixture di regular season del Sassuolo.
- Esclusioni: Coppa Italia, playoff, playout, amichevoli.
- Date e squadre sono state mantenute allineate alle fixture già presenti; sono stati aggiornati solo `stadium`, `referee`, `source_provider`, `source_url`.

## Fonti usate

### Workbook di ricerca fornito dall'utente

- File: `riesci a trovarmi queste informazioni sulla stagi....xlsx`
- Campi verificati: stadio e arbitro per 38 partite.
- Note: gli stadi sono stati normalizzati rimuovendo la città tra parentesi e aggiungendo il prefisso `Stadio`.

### Transfermarkt — Sassuolo schedule e match sheets 2008/09

- Provider: Transfermarkt
- URL indice: `https://www.transfermarkt.com/us-sassuolo/spielplan/verein/6574/saison_id/2008`
- URL match sheet esempio Sassuolo-Pisa: `https://www.transfermarkt.com/spielbericht/index/spielbericht/924235`
- URL match sheet Sassuolo-Parma: `https://www.transfermarkt.com/us-sassuolo_parma-fc/index/spielbericht/932443`
- Campi verificati: stadio, arbitro, data partita e competizione nei match sheet.
- Copertura usata nel pacchetto: controllo e integrazione di stadio/arbitro, inclusi i quattro match non presenti nel workbook.

### Sassuolo2000

- Provider: Sassuolo2000
- URL Salernitana-Sassuolo: `https://www.sassuolo2000.it/2008/08/25/calcio-serie-b-tim-la-prevendita-per-salernitana-sassuolo/`
- URL Sassuolo-Grosseto: `https://www.sassuolo2000.it/2008/09/09/sassuolo-grosseto-i-punti-vendita-dei-biglietti-a-grosseto-e-provincia/`
- URL Sassuolo-Pisa: `https://www.sassuolo2000.it/2008/09/16/calcio-i-convocati-per-sassuolo-pisa/`
- Campi verificati: sede/stadio per le prime partite interne/esterne disponibili.

### Gazzetta del Mezzogiorno

- Provider: La Gazzetta del Mezzogiorno
- URL: `https://www.lagazzettadelmezzogiorno.it/news/sport/81965/bari-brescia-all-internazionale-rosetti.html`
- Campi verificati: designazioni arbitrali della giornata, incluso Sassuolo-Grosseto con Renzo Candussio.

### WorldFootball.net — Serie B 2008/2009 round schedules

- Provider: WorldFootball.net
- URL modello: `https://www.worldfootball.net/schedule/ita-serie-b-2008-2009-spieltag/{round}/`
- Campi verificati: calendario, giornata, competizione, squadra casa e ospite.

### Sky Sports — Sassuolo results 2008/09

- Provider: Sky Sports
- URL: `https://www.skysports.com/sassuolo-results/2008-09`
- Campi verificati: calendario Sassuolo, date, casa/trasferta, separazione delle righe non campionato.

### RSSSF — Italy Second Level 2008/09

- Provider: RSSSF
- URL: `https://www.rsssf.org/tablesi/ital2-09.html`
- Campi verificati: perimetro Serie B 2008/09 e 42 partite di regular season.

## Copertura campi

| Campo | Copertura | Note |
| --- | ---: | --- |
| `match_date` | 42/42 | Mantenuta dalle fixture già riconciliate. |
| `home_team` | 42/42 | Mantenuta dalle fixture già riconciliate. |
| `away_team` | 42/42 | Mantenuta dalle fixture già riconciliate. |
| `stadium` | 42/42 | Normalizzato con prefisso `Stadio`; città tra parentesi rimosse. |
| `referee` | 42/42 | Inserito da workbook utente e fonti puntuali. |
| `source_url` | 42/42 | URL diretto o indice probatorio usato per la riga. |

## Normalizzazione stadi

- Tutti gli stadi usano il prefisso `Stadio`.
- Le città tra parentesi sono state rimosse.
- `Arena Garibaldi - R. Anconetani` è stato normalizzato a `Stadio Arena Garibaldi`.
- Date e squadre non sono state modificate.

## Tranche successive consigliate

- `match-events-serie-b-2008-09`: gol, autogol, cartellini e sostituzioni.
- `match-lineups-serie-b-2008-09`: titolari, panchina, allenatori e sostituzioni.
- `match-team-stats-serie-b-2008-09`: statistiche squadra solo se reperibili da fonti puntuali.
