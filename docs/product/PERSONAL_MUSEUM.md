# Il mio Museo Neroverde

Il Museo Neroverde trasforma l’archivio pubblico in un percorso personale, senza introdurre un profilo sociale. Una partita, un giocatore o una stagione può diventare una memoria privata con il modo in cui è stata vissuta, l’emozione dominante, un’intensità da 1 a 5, un momento preferito e una nota libera.

## Confine di privacy

- Le memorie vivono esclusivamente nel `localStorage` del browser, sotto la chiave versionata `sassuolo-history-personal-museum:v1`.
- `MuseumContext` non importa il client API, non usa `fetch` e non invia eventi di telemetria.
- Il database SQLite, gli endpoint Express, i dataset e le statistiche pubbliche non ricevono note, emozioni o dedica.
- Il museo non offre condivisione, profili pubblici, classifiche tra utenti o URL contenenti il testo dei ricordi.
- Cancellare i dati del sito o usare un altro browser/dispositivo rende le memorie indisponibili se non è stato esportato un backup.

La telemetria tecnica generale può osservare la route normalizzata `/museum`, come qualsiasi altra pagina, ma non legge contenuto, query, storage o campi del museo. L’opt-out descritto nella pagina Metodologia continua ad applicarsi.

## Modello versionato

Ogni memoria usa la chiave stabile `<type>:<entityId>`, con `type` limitato a `match`, `player` o `season`. Il collegamento deve essere una route locale coerente (`/matches/`, `/players/` o `/seasons/`).

```json
{
  "version": 1,
  "profile": {
    "supporterSince": "2008",
    "dedication": "Una storia che continua."
  },
  "memories": [
    {
      "key": "match:8842",
      "type": "match",
      "entityId": "8842",
      "label": "Sassuolo – Milan",
      "url": "/matches/8842",
      "date": "2024-04-14T18:45:00.000Z",
      "season": "2023/24",
      "competition": "Serie A",
      "opponent": "Milan",
      "experience": "stadium",
      "emotion": "goosebumps",
      "intensity": 5,
      "favoriteMoment": "Il gol sotto la curva",
      "note": "Ero con mio padre.",
      "createdAt": "2024-04-14T21:00:00.000Z",
      "updatedAt": "2024-04-14T21:00:00.000Z"
    }
  ]
}
```

Limiti applicati all’ingresso: 500 memorie, 500 caratteri per la nota, 160 per momento preferito e dedica, 20 per l’anno/frase “Neroverde dal”, 160 per l’etichetta e 300 per la route. I valori enumerati e i timestamp devono essere validi; righe non riconoscibili nello storage vengono ignorate senza bloccare l’app.

## Backup, importazione e conflitti

L’esportazione produce JSON con `kind: sassuolo-personal-museum`, versione e data di generazione. L’importazione accetta file fino a 2 MB e solo il formato e la versione supportati, poi unisce il backup allo stato corrente:

1. la chiave entità elimina i duplicati;
2. vince la memoria con `updatedAt` più recente;
3. i campi profilo non vuoti del backup sostituiscono quelli locali;
4. un campo vuoto del backup non cancella una dedica locale;
5. il risultato è riordinato e riportato al limite massimo.

“Svuota il museo” richiede una conferma esplicita e non tocca preferiti, snapshot offline o dati dell’archivio.

## Tour e regole narrative

`buildMuseumRooms` genera sale soltanto dai dati locali:

- ingresso e sala finale esistono sempre, anche a museo vuoto;
- la linea del tempo ordina per data dell’entità e usa `createdAt` solo come fallback;
- partite, eroi e stagioni compaiono solo quando hanno almeno una memoria;
- la costellazione compare da due memorie e collega visualmente quelle con la stessa stagione;
- una partita può riaprire il Match Cinema, ma il museo non ricostruisce eventi o risultati.

Il dialogo fullscreen intrappola e ripristina il focus, supporta `Escape`, frecce e controlli visibili. Tutte le informazioni decorative hanno un equivalente testuale; la preferenza di movimento ridotto elimina reveal, pulsazioni e transizioni significative.

## Scelte escluse dalla v1

Foto e allegati non sono memorizzati in questa versione: riempirebbero rapidamente lo storage e renderebbero fragile il backup. Non sono previsti cloud sync o cifratura con password finché il progetto resta personale; se verranno introdotti, richiederanno consenso, threat model, migrazione di schema e un percorso di recupero separato.

## Verifica

`tests/personal-museum.test.ts` copre route ostili, limiti, fallback, round-trip Unicode, versioni incompatibili, righe corrotte, deduplica, tetto di 500 elementi, merge, statistiche verosimili, sale vuote/miste e assenza di dipendenze API/telemetria. Playwright verifica creazione, persistenza dopo reload, dedica, tour, tastiera, axe WCAG 2.2 AA e assenza di overflow mobile.
