# Fonti

Pacchetto candidato per l’arricchimento delle 10 partite di Sassuolo in UEFA Europa League 2016/17.

Fonte primaria: UEFA.com, pagina ufficiale `matchinfo` per ogni gara. Le pagine UEFA espongono stadio e designazione arbitrale; i campi non esposti o non verificati restano vuoti.

Il pacchetto non contiene ancora eventi, formazioni o statistiche numeriche: le pagine UEFA storiche espongono quei blocchi in modo dinamico/non uniforme. Questi campi saranno aggiunti solo dopo aver acquisito un report UEFA/press kit riproducibile per la singola gara.

Controlli effettuati:

- 10/10 fixture corrispondono al calendario locale Europa League 2016/17;
- 8/10 match page hanno fornito stadio e arbitro nel contenuto consultabile;
- 2/10 designazioni arbitrali restano `NULL`, non stimate;
- nessun risultato o evento viene modificato da questo pacchetto.
