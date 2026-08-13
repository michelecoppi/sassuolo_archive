# Fonti — POC StatsBomb Serie A 2015/16

Pacchetto limitato a **Sassuolo–Milan del 6 marzo 2016** (StatsBomb match ID `3879771`).

- Repository e condizioni d'uso: <https://github.com/hudl/open-data>
- Metadata stagione/partita: <https://raw.githubusercontent.com/hudl/open-data/master/data/matches/12/27.json>
- Eventi: <https://raw.githubusercontent.com/hudl/open-data/master/data/events/3879771.json>
- Formazioni: <https://raw.githubusercontent.com/hudl/open-data/master/data/lineups/3879771.json>

Il file normalizzato conserva stadio, arbitro, due formazioni e soltanto gli eventi editorialmente utili alla scheda partita (gol, cartellini e sostituzioni). L'intero stream evento resta archiviato in `source-files/` e non viene riversato integralmente nell'interfaccia. Nessun dato assente viene trasformato in zero.
