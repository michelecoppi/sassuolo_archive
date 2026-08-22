# Match Cinema

Match Cinema è la modalità immersiva del dettaglio partita. Trasforma i dati già restituiti da `GET /api/matches/:id` in una storia a capitoli fullscreen, senza introdurre un provider, un endpoint o un modello dati separato.

## Apertura e URL

Il comando **Rivivi il match** compare quando esiste un risultato finale oppure almeno un evento ordinario o speciale. Il capitolo attivo è salvato nella query `cinema`:

- `?cinema=start` apre il calcio d'inizio;
- `?cinema=event-123` apre un evento di gara;
- `?cinema=special-7` apre una sospensione, ripresa o altro evento speciale;
- `?cinema=finish` apre il finale.

Il link copiato dal player riapre quindi la stessa partita nello stesso punto. La chiusura rimuove soltanto `cinema` e conserva eventuali altre query.

## Regole del racconto

`src/components/matchCinemaModel.ts` è la funzione pura che ordina e classifica gli eventi. Le regole sono:

1. apertura a 0’ e finale sono sempre capitoli di sistema;
2. eventi ordinari e speciali sono ordinati per minuto, recupero, tipo e ID, così i pareggi temporali restano deterministici;
3. gol, cartellini, cambi e VAR derivano dai campi strutturati e dal testo del provider; un gol annullato non viene classificato come rete;
4. il punteggio cambia solo su coppie `home_score`/`away_score` esplicite; un gol privo del punteggio intermedio mostra `—`, mai un risultato dedotto;
5. il finale usa esclusivamente il risultato canonico della partita;
6. un evento oltre il 90’ estende la scala del campo a 120’; `90+N’` resta invece recupero del tempo regolamentare;
7. minuti assenti restano `N/D` e vengono collocati prima del finale, senza trasformarli in 0’.

Non vengono create coordinate dei giocatori: il campo SVG è una scenografia narrativa, non una mappa delle posizioni reali.

## Copertura BASIC e DETAILED

Con eventi disponibili la modalità mostra la cronologia, le formazioni iniziali nel capitolo di apertura e le statistiche squadra nel finale, quando quei blocchi esistono.

Per una partita `BASIC` senza eventi vengono creati soltanto apertura e finale. Un avviso persistente definisce l'esperienza come **Edizione essenziale** e il testo finale dichiara che la cronaca evento per evento non è disponibile. In questo modo anche le gare storiche minime hanno una presentazione curata senza cronache artificiali.

## Controlli e accessibilità

- precedente/successivo, selettore dei capitoli, play/pausa e velocità 0,75×–2×;
- frecce sinistra/destra per cambiare capitolo e barra spaziatrice per play/pausa quando il focus non è su un controllo;
- `Escape` chiude, il focus resta intrappolato nel dialogo e torna al comando di apertura;
- il player si mette in pausa quando la scheda diventa nascosta;
- schermo intero nativo quando il browser lo permette, senza renderlo necessario;
- `prefers-reduced-motion` e la preferenza applicativa eliminano le animazioni decorative;
- dialogo, tab dei capitoli, nomi accessibili e focus visibile sono verificati con axe WCAG 2.2 AA;
- il layout passa da campo + regia su desktop a scorrimento verticale su mobile, senza overflow orizzontale.

La riproduzione non parte automaticamente: è una scelta intenzionale per movimento, lettori di schermo e controllo dell'utente.

## Prestazioni e test

`MatchCinema.tsx` è importato in modo lazy dal dettaglio partita. Campo, luci e texture sono SVG/CSS locali; non sono state aggiunte dipendenze o immagini remote decorative.

`tests/match-cinema.test.ts` copre un 3–1 realistico, punteggi intermedi mancanti, pari minuto, recupero, supplementari, eventi speciali, autogol/categorie e fallback BASIC. `e2e/critical-flows.spec.ts` verifica URL diretto, tastiera, punteggio, chiusura, riapertura, mobile e audit automatico del dialogo.
