# Archivio P1: fonti e riproducibilità

## Statistiche individuali pre-2013

Usare esclusivamente un export Standard FBref salvato localmente:

```powershell
npm run history:fbref -- --input C:\exports\sassuolo-2012-13-standard.csv --season 2012/13 --source-url https://fbref.com/en/squads/e2befd26/2012-2013/Sassuolo-Stats
npm run import:all
```

Lo script salva righe PlayerSeason e `fbref-standard-manifest.json` con URL, data di verifica, file di origine e numero di righe. Non scarica né stima dati dalla pagina web. Ripetere nell'ordine 2012/13, 2011/12, 2010/11, 2009/10, 2008/09.

## Coperture distinte

Il perimetro completo è dichiarato in [historical-scope.json](historical-scope.json); le fonti candidate per Serie C1 2007/08, Coppa Italia ed Europa League sono nel file [coverage-sources.json](coverage-sources.json). Le righe mancanti restano visibili nella matrice di copertura ma fuori dall'import finché un curator non registra un export riproducibile e verificabile; una gara di coppa non contribuisce mai alla completezza del campionato.

## Serie B 2008/09–2012/13

Le stagioni verificate contengono allenatore, Stadio Alberto Braglia e capocannoniere, con pagina FBref citata in ogni record. Il 2010/11 espone i tre allenatori avvicendati (Arrigoni, Gregucci, Mandelli) invece di ridurli a un valore ambiguo.
