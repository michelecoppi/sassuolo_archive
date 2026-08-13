# Ricerca Coppa Italia ed Europa League

## Esito della prima tranche

### Europa League 2016/17

Il perimetro è di 10 gare: due turni di qualificazione, play-off e sei partite del girone F. UEFA riepiloga la campagna come 10 partite, 3 vittorie, 4 pareggi e 3 sconfitte; la pagina storica espone anche i marcatori principali e le presenze. Il calendario ufficiale UEFA conferma le sei gare del girone e le relative date.

È stato creato il pacchetto candidato:

```text
data/research-candidates/match-details-europa-league-2016-17/
```

Copertura del pacchetto:

- 10/10 fixture collegate;
- 10/10 pagine UEFA `matchinfo` associate;
- stadio disponibile per 8/10 gare nel contenuto consultabile;
- arbitro disponibile per 8/10 gare;
- eventi, formazioni e statistiche numeriche non dedotti dalle pagine dinamiche;
- `NULL` conservato per i due arbitri non recuperati nella prima passata.

Il pacchetto è candidato e non è stato importato automaticamente.

### Coppa Italia 2008/09–2025/26

La fonte ufficiale Lega Serie A è utile soprattutto per le stagioni recenti: pubblica match report PDF, insight e news della competizione. Per le stagioni più vecchie l’archivio ufficiale non restituisce in modo uniforme una pagina completa per ogni gara Sassuolo.

Per questo la Coppa va lavorata per tranche:

1. 2008/09–2012/13: ricostruzione delle fixture e verifica incrociata, poi ricerca dei referti puntuali;
2. 2013/14–2019/20: fixture e referti disponibili in modo misto, con priorità alle gare contro squadre di Serie A;
3. 2020/21–2025/26: Lega Serie A, PDF ufficiali e archivio locale già più ricco.

Non verranno importati eventi, arbitri, stadi o marcatori soltanto perché presenti in un riepilogo non puntuale.

## Fonti verificate

- [UEFA — storia Sassuolo Europa League](https://www.uefa.com/uefaeuropaleague/history/clubs/2600632--sassuolo/)
- [UEFA — calendario gironi 2016/17](https://editorial.uefa.com/resources/0230-0e69fc98686f-356ed92f06cc-1000/2016_17_group_stage_fixtures.pdf)
- [UEFA — Sassuolo-Luzern matchinfo](https://www.uefa.com/uefaeuropaleague/match/2020402--sassuolo-vs-luzern/matchinfo/)
- [UEFA — Crvena Zvezda-Sassuolo matchinfo](https://www.uefa.com/uefaeuropaleague/match/2020476--crvena-zvezda-vs-sassuolo/matchinfo/)
- [UEFA — Genk-Sassuolo matchinfo](https://www.uefa.com/uefaeuropaleague/match/2019413--genk-vs-sassuolo/matchinfo/)
- [UEFA — Athletic Club-Sassuolo matchinfo](https://www.uefa.com/uefaeuropaleague/match/2019485--athletic-club-vs-sassuolo/matchinfo/)
- [Lega Serie A — albo Coppa Italia](https://www.legaseriea.it/coppa-italia/albo)
- [Lega Serie A — insight Coppa Italia 2025/26](https://img.legaseriea.it/vimages/68d14d44/INSIGHTS%20Coppa%20Italia%2C%20Round%20of%2032.pdf)
