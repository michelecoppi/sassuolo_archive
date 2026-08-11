export type StatisticDefinition = {
  key: string;
  label: string;
  formula: string;
  tieBreak: string;
  minimum: string;
};

export const STATISTICS_POLICY_VERSION = '2026-08-11';
export const HALL_OF_FAME_LIMIT = 20;
export const HALL_OF_FAME_COMPETITIONS = ['Serie A','Serie B','Serie C','Europa League','Coppa Italia'] as const;

export const RECORD_DEFINITIONS: StatisticDefinition[] = [
  {key:'biggestWin',label:'Vittoria più ampia',formula:'Massimo scarto reti nelle gare vinte dal Sassuolo.',tieBreak:'A parità viene scelta la gara meno recente, poi l’ID più basso.',minimum:'Almeno una vittoria conclusa nel perimetro.'},
  {key:'biggestHomeWin',label:'Miglior vittoria casa',formula:'Massimo scarto reti nelle gare vinte dal Sassuolo in casa.',tieBreak:'A parità viene scelta la gara meno recente, poi l’ID più basso.',minimum:'Almeno una vittoria interna conclusa nel perimetro.'},
  {key:'biggestAwayWin',label:'Miglior vittoria fuori',formula:'Massimo scarto reti nelle gare vinte dal Sassuolo in trasferta.',tieBreak:'A parità viene scelta la gara meno recente, poi l’ID più basso.',minimum:'Almeno una vittoria esterna conclusa nel perimetro.'},
  {key:'biggestDefeat',label:'Sconfitta più ampia',formula:'Massimo scarto reti subito nelle gare perse dal Sassuolo.',tieBreak:'A parità viene scelta la gara meno recente, poi l’ID più basso.',minimum:'Almeno una sconfitta conclusa nel perimetro.'},
  {key:'longestWinningStreak',label:'Serie vittorie',formula:'Massimo numero di vittorie consecutive in ordine cronologico.',tieBreak:'Le sequenze di pari lunghezza condividono lo stesso valore.',minimum:'Almeno una gara conclusa nel perimetro.'},
  {key:'longestUnbeatenStreak',label:'Serie senza sconfitte',formula:'Massimo numero di vittorie o pareggi consecutivi in ordine cronologico.',tieBreak:'Le sequenze di pari lunghezza condividono lo stesso valore.',minimum:'Almeno una gara conclusa nel perimetro.'},
  {key:'longestLosingStreak',label:'Serie sconfitte',formula:'Massimo numero di sconfitte consecutive in ordine cronologico.',tieBreak:'Le sequenze di pari lunghezza condividono lo stesso valore.',minimum:'Almeno una gara conclusa nel perimetro.'},
  {key:'mostGoalsInMatch',label:'Più gol in una gara',formula:'Massimo totale dei gol segnati dalle due squadre in una gara conclusa.',tieBreak:'A parità viene scelta la gara meno recente, poi l’ID più basso.',minimum:'Almeno una gara conclusa nel perimetro.'}
];

export const HALL_OF_FAME_DEFINITIONS: StatisticDefinition[] = [
  {key:'appearances',label:'Più presenze',formula:'Somma delle presenze PlayerSeason disponibili nel perimetro.',tieBreak:'Valore decrescente, poi nome del giocatore in ordine alfabetico.',minimum:'Nessuna soglia predefinita; il filtro minimo è facoltativo.'},
  {key:'goals',label:'Più gol',formula:'Somma dei gol PlayerSeason disponibili nel perimetro.',tieBreak:'Valore decrescente, poi nome del giocatore in ordine alfabetico.',minimum:'Nessuna soglia predefinita; il filtro minimo è facoltativo.'},
  {key:'assists',label:'Più assist',formula:'Somma degli assist PlayerSeason disponibili nel perimetro.',tieBreak:'Valore decrescente, poi nome del giocatore in ordine alfabetico.',minimum:'Nessuna soglia predefinita; il filtro minimo è facoltativo.'},
  {key:'minutes',label:'Più minuti',formula:'Somma dei minuti PlayerSeason disponibili nel perimetro.',tieBreak:'Valore decrescente, poi nome del giocatore in ordine alfabetico.',minimum:'Nessuna soglia predefinita; il filtro minimo è facoltativo.'},
  {key:'clean_sheets',label:'Più clean sheet',formula:'Somma dei clean sheet PlayerSeason disponibili nel perimetro.',tieBreak:'Valore decrescente, poi nome del giocatore in ordine alfabetico.',minimum:'Nessuna soglia predefinita; il filtro minimo è facoltativo.'},
  {key:'own_goals',label:'Più autogol',formula:'Somma degli autogol PlayerSeason esplicitamente rilevati.',tieBreak:'Valore decrescente, poi nome del giocatore in ordine alfabetico.',minimum:'Sono incluse solo somme maggiori di zero.'},
  {key:'yellow_cards',label:'Più cartellini gialli',formula:'Somma dei cartellini gialli PlayerSeason disponibili.',tieBreak:'Valore decrescente, poi nome del giocatore in ordine alfabetico.',minimum:'Sono incluse solo somme maggiori di zero.'},
  {key:'red_cards',label:'Più cartellini rossi',formula:'Somma dei cartellini rossi PlayerSeason disponibili.',tieBreak:'Valore decrescente, poi nome del giocatore in ordine alfabetico.',minimum:'Sono incluse solo somme maggiori di zero.'},
  {key:'fouls_committed',label:'Più falli commessi',formula:'Somma dei falli commessi PlayerSeason disponibili.',tieBreak:'Valore decrescente, poi nome del giocatore in ordine alfabetico.',minimum:'Sono incluse solo somme maggiori di zero.'},
  {key:'teamOwnGoals',label:'Autogol a favore / contro',formula:'Valori stagionali esplicitamente registrati, senza deduzioni dal risultato.',tieBreak:'Stagione più recente per prima.',minimum:'Almeno uno dei due valori deve essere disponibile.'}
];
