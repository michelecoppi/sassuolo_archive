# Mandato per agente esterno — ricerca dati Sassuolo

## Contesto essenziale

Stiamo costruendo un archivio verificabile dell'U.S. Sassuolo Calcio dalla stagione 2008/09 alla 2025/26. Il database e il codice non sono accessibili all'agente di ricerca: la consegna deve quindi essere composta esclusivamente da file dati, manifest, fonti e note di riconciliazione.

Non modificare database, non inventare valori, non stimare dati mancanti e non sostituire valori sconosciuti con `0`. Campionato, Coppa Italia ed Europa League devono restare separati anche quando appartengono alla stessa stagione.

## Ordine di lavoro obbligatorio

Non affrontare tutto contemporaneamente. Consegnare una tranche per volta in questo ordine:

1. risoluzione della discrepanza PlayerSeason Serie B 2012/13;
2. PlayerSeason Serie B 2010/11;
3. PlayerSeason Serie B 2009/10;
4. PlayerSeason Serie B 2008/09;
5. classifiche storiche dei campionati mancanti;
6. partecipazioni e fixture di Coppa Italia 2008/09–2019/20;
7. provenienza dei trasferimenti;
8. dettagli partita storici, soltanto da referti puntuali.

La prima consegna deve riguardare esclusivamente il punto 1. Attendere revisione prima di passare al punto successivo.

---

## Tranche 1 — discrepanza PlayerSeason Serie B 2012/13

### Problema da risolvere

Esiste già un candidato StatsCrew con 23 giocatori. La somma dei gol della tabella giocatori è `76`, mentre il riepilogo della stessa stagione indica `78`. Il candidato non può essere importato finché i due gol di differenza non sono spiegati.

Fonte già utilizzata:

- StatsCrew: `https://www.statscrew.com/worldfootball/stats/t-SASCA963/y-2012`

Cross-check già indicato:

- FBref Sassuolo 2012/13: `https://fbref.com/en/squads/e2befd26/2012-2013/Sassuolo-Stats`

### Ricerca richiesta

Trovare almeno una seconda fonte indipendente e riproducibile che elenchi i giocatori del Sassuolo nella Serie B 2012/13 con, come minimo, presenze e gol.

Fonti preferite, in ordine:

1. Lega Serie B, FIGC o comunicati/referti ufficiali;
2. FBref, incluse copie archiviate o export CSV;
3. WorldFootball.net, Soccerway, StatBunker o dataset equivalente con pagina stabile;
4. referti partita ufficiali, se necessari per attribuire i due gol mancanti.

Non usare Wikipedia come unica prova di una statistica individuale. Può essere usata soltanto come indice per trovare una fonte primaria.

### Domande a cui rispondere esplicitamente

1. Qual è il totale corretto dei gol del Sassuolo in campionato: 76, 78 o un altro valore?
2. Il totale include autogol degli avversari?
3. Quali due gol non risultano attribuiti nella tabella StatsCrew?
4. Sono gol segnati da giocatori assenti dalle 23 righe, autogol, differenze disciplinari o errori della fonte?
5. Per ogni giocatore, quali valori della seconda fonte differiscono da StatsCrew?
6. La fonte include solo campionato oppure somma anche Coppa Italia/playoff?

### File da consegnare

```text
player-season-2012-13-resolution/
  data.csv
  discrepancies.csv
  manifest.json
  SOURCES.md
  source-files/          # eventuali CSV/PDF/HTML salvati legalmente
```

`data.csv` deve avere queste colonne:

```csv
player_name,season,competition,appearances,starts,minutes,goals,assists,yellow_cards,red_cards,position,source_provider,source_url,last_verified_at
```

Regole:

- `season` deve essere sempre `2012/13`;
- `competition` deve essere sempre `Serie B`;
- un campo non pubblicato dalla fonte deve essere vuoto, non `0`;
- `0` è ammesso soltanto quando la fonte dichiara realmente zero;
- una riga deve avere un URL fonte puntuale;
- non includere Coppa Italia o playoff;
- conservare accenti e apostrofi in UTF-8.

`discrepancies.csv` deve avere:

```csv
player_name,field,statscrew_value,second_source_value,resolution,status,evidence_url,note
```

Valori ammessi per `status`:

- `resolved`;
- `source_conflict`;
- `identity_ambiguous`;
- `unverified`.

`SOURCES.md` deve spiegare il conteggio gol, gli eventuali autogol e riportare collegamenti diretti alle pagine consultate.

---

## Tranche 2–4 — PlayerSeason Serie B 2008/09–2010/11

Preparare un pacchetto separato per ogni stagione:

```text
player-season-2010-11/
player-season-2009-10/
player-season-2008-09/
```

Per ogni stagione servono esclusivamente le statistiche del Sassuolo nella competizione `Serie B`.

Campi richiesti, quando pubblicati:

```csv
player_name,season,competition,appearances,starts,minutes,goals,assists,yellow_cards,red_cards,position,shirt_number,source_provider,source_url,last_verified_at
```

Controlli obbligatori:

- somma dei gol giocatori confrontata con il totale gol squadra;
- spiegazione degli autogol, se presenti;
- numero di giocatori trovato;
- giocatori con omonimie o grafie differenti;
- separazione netta da Coppa Italia e playoff;
- indicazione dei campi non pubblicati dalla fonte;
- almeno una fonte principale e, per gol/presenze, un controllo indipendente quando possibile.

Non ricostruire minuti, assist o cartellini partendo da risultati o cronache incomplete.

---

## Tranche 5 — classifiche storiche

Servono classifiche complete di tutte le squadre, non una classifica ricostruita dalle sole partite del Sassuolo.

Perimetri mancanti prioritari:

- Serie B: 2008/09, 2009/10, 2010/11, 2011/12, 2012/13;
- Serie A: 2013/14–2021/22;
- Serie A: 2025/26, solo se la stagione è conclusa e la fonte mostra la classifica finale.

Sono già presenti e non vanno riconsegnate senza una discrepanza documentata:

- Serie A 2022/23;
- Serie A 2023/24;
- Serie B 2024/25.

Un file per stagione/competizione:

```csv
season,competition,team_name,rank,points,played,wins,draws,losses,goals_for,goals_against,goals_diff,status,description,source_provider,source_url,last_verified_at
```

Verificare:

- presenza di tutte le squadre della competizione;
- uguaglianza fra somma `wins + draws + losses` e `played` per ogni squadra;
- `goals_for - goals_against = goals_diff`;
- penalizzazioni: `points` deve essere il valore ufficiale, senza ricalcolarlo;
- playoff/playout, promozione, retrocessione o penalità descritti in `status`/`description`;
- eventuali spareggi non devono alterare la classifica di regular season senza nota.

---

## Tranche 6 — Coppa Italia 2008/09–2019/20

Prima determinare, per ogni stagione, se il Sassuolo partecipò. Non assumere automaticamente una partecipazione.

Per ogni stagione produrre una riga di censimento:

```csv
season,competition,participated,expected_matches,first_round,last_round,source_provider,source_url,last_verified_at,note
```

Poi produrre le fixture verificate:

```csv
date,season,competition,round,home_team,away_team,home_score,away_score,score_after_extra_time,penalties_home,penalties_away,stadium,attendance,referee,source_provider,source_url,last_verified_at
```

Regole:

- `competition` sempre `Coppa Italia`;
- data nel formato `YYYY-MM-DD`;
- distinguere risultato nei 90 minuti, supplementari e rigori quando la fonte lo permette;
- non usare l'orario come chiave della partita;
- non dedurre arbitro, stadio o affluenza;
- ogni fixture deve avere un URL puntuale o un PDF ufficiale identificabile;
- indicare rinvii o date discordanti fra fonti;
- non includere amichevoli o altre coppe.

Fonti preferite: Lega Serie A, FIGC, comunicati dei club, referti ufficiali; OpenFootball o archivi secondari possono fare da indice/cross-check, non da unica prova per dettagli avanzati.

---

## Tranche 7 — provenienza trasferimenti

Il database contiene già 837 movimenti, ma non abbiamo URL fonte puntuali. Non ricreare indiscriminatamente un secondo elenco.

Richiedere prima al committente un export CSV dei trasferimenti esistenti. Dopo averlo ricevuto, restituire lo stesso elenco arricchito con:

```csv
existing_transfer_id,player_name,transfer_date,season,from_team,to_team,transfer_type,fee,source_provider,source_url,last_verified_at,match_status,note
```

`match_status` deve essere uno di:

- `exact`;
- `probable`;
- `ambiguous`;
- `not_found`;
- `conflict`.

Non creare nuove righe per differenze minime di data di pubblicazione. L'identità logica è giocatore + stagione/finestra + squadra origine + squadra destinazione + tipo di movimento.

---

## Tranche 8 — dettagli partita storici

Questa tranche viene affrontata una stagione/competizione alla volta. Per ogni partita cercare:

- stadio;
- arbitro;
- presenza;
- risultato intervallo;
- eventi;
- formazioni;
- statistiche squadra;
- statistiche giocatore.

Non aggregare tutto in un'unica colonna testuale quando esiste una struttura riga-per-evento o riga-per-giocatore. Non estrarre valori da pagine dinamiche se non sono verificabili nel contenuto salvato.

Chiave di riconciliazione richiesta per ogni tabella: `season + competition + date + home_team + away_team`.

Priorità:

1. 2025/26 Serie A: 30 partite senza blocchi avanzati;
2. Europa League 2016/17;
3. stagioni recenti di Coppa Italia;
4. resto dello storico.

---

## Manifest obbligatorio per ogni pacchetto

Ogni cartella deve contenere `manifest.json` con questa forma:

```json
{
  "area": "player_seasons",
  "season": "2012/13",
  "competition": "Serie B",
  "source_provider": "nome fonte principale",
  "source_url": "https://pagina-principale.example",
  "verified_at": "YYYY-MM-DD",
  "file": "data.csv",
  "sha256": "SHA-256 del file data.csv",
  "records_total": 0,
  "records_discarded": 0,
  "discard_reasons": [],
  "fields_covered": [],
  "validation": {
    "status": "candidate",
    "checks": [],
    "unresolved_conflicts": []
  },
  "notes": []
}
```

Il checksum deve essere calcolato sul file dati esatto consegnato. Se il file cambia, aggiornare il checksum.

## Criteri generali di accettazione

Una consegna viene accettata soltanto se:

- ogni riga importante ha una fonte identificabile;
- i file sono UTF-8;
- CSV correttamente quotato;
- date ISO `YYYY-MM-DD`;
- stagioni `YYYY/YY`;
- competizioni separate;
- sconosciuti vuoti/`null`, mai zero inventato;
- duplicati e identità ambigue sono segnalati;
- somme e totali sono controllati;
- fonti in conflitto restano dichiarate, non risolte arbitrariamente;
- sono indicati record esclusi e ragione dell'esclusione;
- non sono presenti API key, cookie o credenziali;
- l'agente non tenta di importare nulla.

## Risposta sintetica richiesta insieme ai file

Concludere ogni tranche con:

1. perimetro coperto;
2. fonti consultate;
3. righe consegnate e scartate;
4. campi coperti e mancanti;
5. controlli superati;
6. conflitti ancora aperti;
7. decisioni che richiedono revisione umana;
8. percorso e checksum di ogni file consegnato.
