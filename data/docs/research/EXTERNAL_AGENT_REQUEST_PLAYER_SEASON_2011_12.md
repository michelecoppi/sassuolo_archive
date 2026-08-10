# Mandato esterno — verifica PlayerSeason Sassuolo 2011/12

## Obiettivo unico

Verificare e riconciliare le statistiche dei giocatori dell'U.S. Sassuolo Calcio nella sola `Serie B 2011/12`, producendo un pacchetto candidato importabile e documentato.

Non cercare altre stagioni e non includere Coppa Italia, playoff o amichevoli. Non modificare database. Non inventare dati e non sostituire valori sconosciuti con zero.

## Candidato già disponibile

Esiste già un candidato basato su StatsCrew:

- fonte: `https://www.statscrew.com/worldfootball/stats/t-SASCA963/y-2011`;
- 27 giocatori;
- somma presenze: 582;
- somma titolarità: 462;
- somma minuti disponibili: 37.246;
- 3 giocatori senza minuti pubblicati;
- somma gol giocatori: 57;
- somma assist: 35;
- 0 righe senza URL fonte;
- il riepilogo StatsCrew indica 57 gol squadra.

Il lavoro non consiste nel copiare nuovamente StatsCrew. Serve verificare il candidato con almeno una seconda fonte indipendente e spiegare eventuali differenze.

## Domande obbligatorie

1. Il Sassuolo ha segnato esattamente 57 gol nella regular season di Serie B 2011/12?
2. La somma dei gol attribuiti ai giocatori è realmente 57?
3. Ci furono autogol avversari a favore del Sassuolo? Se sì, la somma dei gol giocatore deve essere inferiore ai gol squadra e ogni autogol deve essere documentato.
4. StatsCrew include o esclude playoff e Coppa Italia?
5. Quali giocatori hanno presenze o gol diversi nella seconda fonte?
6. I 27 giocatori coprono l'intera rosa con almeno una presenza in campionato?
7. Esistono giocatori con zero presenze presenti soltanto nella rosa? Non aggiungerli al file statistico senza una fonte che dichiari esplicitamente il dato.
8. Per quali tre giocatori StatsCrew non pubblica i minuti? Una seconda fonte pubblica un valore verificabile?
9. Ci sono omonimie, grafie alternative o giocatori che rischiano di essere duplicati?
10. I totali di presenze, titolarità e minuti sono compatibili con 42 partite di campionato?

## Fonti preferite

Usare almeno una fonte indipendente oltre a StatsCrew. Ordine preferito:

1. Lega Serie B, FIGC, referti ufficiali o archivio ufficiale del club;
2. FBref o export FBref archiviato;
3. StatBunker, WorldFootball.net, Soccerway o ESPN, purché la pagina mostri chiaramente stagione e competizione;
4. Transfermarkt per identità e appartenenza alla rosa, non come unica fonte delle statistiche;
5. referti partita puntuali per risolvere gol o autogol.

Wikipedia può aiutare a trovare altre fonti, ma non deve essere l'unica prova per una statistica individuale.

Se una pagina è dinamica o incompleta, non copiarne valori sospetti. Registrarla come fonte scartata spiegando il motivo.

## Consegna richiesta

Consegnare uno ZIP con questa struttura esatta:

```text
player-season-2011-12-resolution/
  data.csv
  discrepancies.csv
  manifest.json
  SOURCES.md
  source-files/
    README.md
    ...eventuali CSV, PDF o snapshot consentiti...
```

## Formato di `data.csv`

```csv
player_name,season,competition,appearances,starts,minutes,goals,assists,yellow_cards,red_cards,position,source_provider,source_url,last_verified_at
```

Regole obbligatorie:

- `season` sempre `2011/12`;
- `competition` sempre `Serie B`;
- una riga per giocatore;
- `last_verified_at` nel formato `YYYY-MM-DD`;
- file UTF-8;
- campi CSV con virgole correttamente racchiusi fra virgolette;
- campi non pubblicati lasciati vuoti;
- `0` soltanto quando la fonte dichiara davvero zero;
- ogni riga con `source_provider` e `source_url`;
- non sommare playoff, Coppa Italia o altre competizioni;
- non calcolare minuti, assist o cartellini da dati indiretti.

Se StatsCrew resta la fonte migliore, `data.csv` può conservarne i valori. Le verifiche indipendenti e le differenze devono comunque essere documentate.

## Formato di `discrepancies.csv`

```csv
player_name,field,statscrew_value,second_source_value,resolution,status,evidence_url,note
```

Valori ammessi per `status`:

- `resolved`;
- `source_conflict`;
- `identity_ambiguous`;
- `unverified`;
- `source_rejected`.

Inserire anche righe `TEAM` per:

- gol squadra;
- somma gol giocatori;
- autogol avversari;
- numero partite;
- eventuale differenza tra regular season e playoff.

Una fonte scartata perché incompleta deve avere stato `source_rejected`, non deve diventare un valore alternativo da importare.

## Contenuto obbligatorio di `SOURCES.md`

Il documento deve contenere:

1. perimetro preciso;
2. elenco di tutte le fonti con URL diretti;
3. data di consultazione;
4. conteggio dei 57 gol squadra;
5. somma dei gol giocatore;
6. elenco e prova degli eventuali autogol;
7. confronto StatsCrew/seconda fonte;
8. spiegazione delle righe escluse;
9. giocatori con identità o grafia ambigua;
10. campi che restano vuoti e perché;
11. dichiarazione esplicita che Coppa Italia e playoff non sono inclusi.

## `manifest.json`

Usare questa struttura:

```json
{
  "area": "player_seasons",
  "season": "2011/12",
  "competition": "Serie B",
  "source_provider": "fonte principale",
  "source_url": "URL principale",
  "verified_at": "YYYY-MM-DD",
  "file": "data.csv",
  "sha256": "SHA-256 esatto di data.csv",
  "records_total": 0,
  "records_discarded": 0,
  "discard_reasons": [],
  "fields_covered": [],
  "validation": {
    "status": "candidate",
    "checks": [
      {"name":"season_constant","status":"passed","note":""},
      {"name":"competition_constant","status":"passed","note":""},
      {"name":"player_goals_sum","status":"passed","note":""},
      {"name":"team_goals_cross_check","status":"passed","note":""},
      {"name":"own_goals_reconciled","status":"passed","note":""},
      {"name":"identities_reviewed","status":"passed","note":""}
    ],
    "unresolved_conflicts": []
  },
  "notes": []
}
```

Impostare `validation.status` a `reconciled` soltanto se:

- i 57 gol squadra sono confermati;
- gol giocatore e autogol sono riconciliati;
- nessuna differenza critica resta senza spiegazione;
- le identità sono state controllate;
- il checksum corrisponde al file consegnato.

Se rimane una discrepanza, usare `candidate` o `conflict_review_required` e descriverla in `unresolved_conflicts`.

## Controlli finali richiesti

Prima della consegna verificare:

- numero righe effettivo uguale a `records_total`;
- nessun giocatore duplicato;
- nessuna riga senza fonte;
- `starts <= appearances`;
- nessun numero negativo;
- somma gol calcolata e documentata;
- autogol non attribuiti ai giocatori Sassuolo;
- SHA-256 corretto;
- CSV UTF-8 valido;
- nessuna credenziale o API key nei file.

## Messaggio finale dell'agente

Accompagnare lo ZIP con un riepilogo che dichiari:

- fonti utilizzate e scartate;
- numero righe consegnate e scartate;
- totale gol squadra;
- totale gol giocatori;
- autogol trovati;
- differenze risolte e ancora aperte;
- campi mancanti;
- stato finale `reconciled` oppure motivo del blocco;
- nome e SHA-256 di ogni file dati.

Non procedere alla stagione 2010/11 prima che questo pacchetto sia stato revisionato.
