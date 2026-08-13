# Integrazione richiesta — Sassuolo Serie B 2010/11

Il pacchetto ricevuto è correttamente marcato `conflict_review_required` e non deve essere importato.

## Stato verificato

- StatsCrew: 33 giocatori, 41 gol individuali, 42 gol squadra, 462 titolarità.
- WorldFootball è accessibile al revisore selezionando `Serie B - 2010/2011` e mostra una tabella completa di 33 giocatori.
- Il link diretto può inizialmente mostrare `Friendlies Clubs - 2026`: occorre usare il selettore stagione e scegliere esplicitamente `Serie B - 2010/2011`.
- Resta da identificare il gol non attribuito: possibile autogol avversario o differenza di fonte.

## Nuovo incarico, unico e circoscritto

Non ricostruire nuovamente il pacchetto completo. Cerca esclusivamente la causa della differenza:

```text
42 gol squadra - 41 gol giocatori Sassuolo = 1 gol
```

Esamina partita per partita le 42 gare di Serie B 2010/11 e individua:

- un autogol avversario a favore del Sassuolo;
- oppure un gol attribuito diversamente fra StatsCrew e i referti;
- oppure un errore documentabile nel totale della fonte.

## Evidenza richiesta

Per chiudere servono obbligatoriamente:

- partita;
- data;
- risultato;
- autore del gol/autogol;
- squadra del giocatore;
- minuto, se disponibile;
- almeno un URL puntuale al tabellino/referto;
- preferibilmente una seconda URL di conferma.

Fonti preferite:

1. referto Lega Serie B/FIGC o archivio ufficiale;
2. ESPN match page;
3. Transfermarkt match report;
4. BeSoccer/Soccerway/WorldFootball come conferma;
5. cronaca giornalistica contemporanea.

Non risolvere il divario per deduzione. Se non trovi prova puntuale, restituisci un elenco delle 42 partite controllate e mantieni `unverified`.

## Consegna

```text
player-season-2010-11-goal-resolution/
  goal-resolution.csv
  SOURCES.md
  manifest.json
```

`goal-resolution.csv`:

```csv
date,season,competition,home_team,away_team,home_score,away_score,scoring_team,player_name,event_type,minute,source_provider,source_url,confirmation_url,last_verified_at,note
```

`event_type` deve essere `opponent_own_goal`, `player_goal_correction` oppure `source_error`.

Il manifest può essere `reconciled` soltanto se il gol viene dimostrato. Non procedere al 2009/10.
