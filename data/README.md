# Data import folders

- `seasons/`: una riga per stagione/competizione.
- `matches/`: partite Sassuolo.
- `players/`: anagrafica/totali giocatori.
- `player-seasons/`: statistiche giocatore divise per stagione.
- `reconciliation/`: registro macchina, candidati e report JSON di audit.
- `docs/`: documentazione dati indicizzata per audit, ricerca e riconciliazione.

Il punto di ingresso per la documentazione è [`docs/README.md`](docs/README.md); il piano operativo corrente è [`docs/DATA_MASTER_PLAN.md`](docs/DATA_MASTER_PLAN.md). I file `DATA_*` non devono essere aggiunti nella root del progetto.

Formati supportati: JSON e CSV.

## Import

```bash
npm run import:all
```

Oppure Data Manager → **Import JSON/CSV**.

## Bootstrap campionato

```bash
npm run history:bootstrap
```

Genera automaticamente `seasons/sassuolo-league-history.json` e `matches/sassuolo-league-history.json` dai CSV gratuiti Football-Data.

## Correzioni manuali

Per modifiche occasionali è più semplice usare Data Manager → **Modifica dati**. Le righe salvate dall'interfaccia sono marcate `manual` e non vengono sovrascritte dall'import automatico.
