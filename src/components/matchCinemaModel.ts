export type CinemaEventInput={
  id:number;
  minute:number|null;
  extra_minute:number|null;
  team_name:string|null;
  player_name:string|null;
  assist_name:string|null;
  type:string|null;
  detail:string|null;
  comments:string|null;
  verification_note?:string|null;
  home_score?:number|null;
  away_score?:number|null;
  scoring_play?:number|boolean|null;
  is_own_goal?:number|boolean|null;
};

export type CinemaSpecialEventInput={
  id:number;
  event_type:string;
  match_minute:number|null;
  home_score:number|null;
  away_score:number|null;
  reason:string|null;
  description:string;
};

export type CinemaEventKind='kickoff'|'goal'|'yellow-card'|'red-card'|'substitution'|'var'|'special'|'event'|'finish';

export type CinemaChapter={
  id:string;
  kind:CinemaEventKind;
  minute:number|null;
  extraMinute:number|null;
  minuteLabel:string;
  title:string;
  narration:string;
  teamName:string|null;
  playerName:string|null;
  homeScore:number|null;
  awayScore:number|null;
  source:'system'|'event'|'special';
};

export type CinemaStory={
  chapters:CinemaChapter[];
  coverage:'basic'|'event-by-event';
  regulationMinutes:90|120;
};

const specialLabels:Record<string,string>={
  POSTPONED:'Partita rinviata',
  KICKOFF_DELAYED:'Calcio d’inizio ritardato',
  SUSPENDED:'Partita sospesa',
  RESUMED:'La partita riprende',
  ABANDONED:'Partita abbandonata',
  CANCELLED:'Partita annullata',
  AWARDED:'Risultato assegnato a tavolino',
  DATE_CHANGED:'Data della partita modificata',
  VENUE_CHANGED:'Sede della partita modificata',
  OTHER:'Avvenimento particolare',
};

export function cinemaMinuteLabel(minute:number|null,extraMinute:number|null=0){
  if(minute==null)return 'N/D';
  return extraMinute&&extraMinute>0?`${minute}+${extraMinute}’`:`${minute}’`;
}

export function cinemaEventKind(event:Pick<CinemaEventInput,'type'|'detail'|'scoring_play'>):CinemaEventKind{
  const value=`${event.type??''} ${event.detail??''}`.toLowerCase();
  if(Boolean(event.scoring_play)||(/goal|gol|rete/.test(value)&&!/missed|annull|cancel|disallow|ruled out|no goal/.test(value)))return 'goal';
  if(/red|rosso/.test(value)&&/card|cartell/.test(value))return 'red-card';
  if(/yellow|giallo/.test(value)||/card|cartell/.test(value))return 'yellow-card';
  if(/sub|sostituz/.test(value))return 'substitution';
  if(/\bvar\b|video assistant/.test(value))return 'var';
  return 'event';
}

function eventCopy(event:CinemaEventInput,kind:CinemaEventKind){
  const player=event.player_name??event.team_name??'Protagonista non indicato';
  const detail=event.detail??event.type??'Evento di gara';
  if(kind==='goal')return {
    title:event.team_name?`Gol · ${event.team_name}`:'Gol',
    narration:`${player}${event.is_own_goal?' devia nella propria porta':''}${event.assist_name?` su assist di ${event.assist_name}`:''}.`,
  };
  if(kind==='red-card')return {title:'Cartellino rosso',narration:`${player} viene espulso${event.comments?`: ${event.comments}`:'.'}`};
  if(kind==='yellow-card')return {title:'Cartellino giallo',narration:`Ammonizione per ${player}${event.comments?`: ${event.comments}`:'.'}`};
  if(kind==='substitution')return {title:'Cambio',narration:event.assist_name?`${event.assist_name} entra al posto di ${player}.`:`Sostituzione per ${event.team_name??player}.`};
  if(kind==='var')return {title:'Controllo VAR',narration:event.comments??`${detail}${event.player_name?` · ${event.player_name}`:''}.`};
  return {title:detail,narration:event.comments??`${player}${event.team_name&&event.player_name?` · ${event.team_name}`:''}.`};
}

type OrderedChapter={chapter:CinemaChapter;sortMinute:number;sortExtra:number;sortType:number;sortId:number};

export function buildCinemaStory(input:{
  homeTeam:string;
  awayTeam:string;
  homeScore:number|null;
  awayScore:number|null;
  events:CinemaEventInput[];
  specialEvents?:CinemaSpecialEventInput[];
}):CinemaStory{
  const eventChapters:OrderedChapter[]=input.events.map(event=>{
    const kind=cinemaEventKind(event);
    const copy=eventCopy(event,kind);
    return {sortMinute:event.minute??998,sortExtra:event.extra_minute??0,sortType:0,sortId:event.id,chapter:{
      id:`event-${event.id}`,kind,minute:event.minute,extraMinute:event.extra_minute,minuteLabel:cinemaMinuteLabel(event.minute,event.extra_minute),
      title:copy.title,narration:copy.narration,teamName:event.team_name,playerName:event.player_name,
      homeScore:event.home_score??null,awayScore:event.away_score??null,source:'event',
    }};
  });
  const specialChapters:OrderedChapter[]=(input.specialEvents??[]).map(event=>({
    sortMinute:event.match_minute??998,sortExtra:0,sortType:1,sortId:event.id,chapter:{
      id:`special-${event.id}`,kind:'special',minute:event.match_minute,extraMinute:null,minuteLabel:cinemaMinuteLabel(event.match_minute),
      title:specialLabels[event.event_type]??specialLabels.OTHER,narration:event.reason?`${event.reason}. ${event.description}`:event.description,
      teamName:null,playerName:null,homeScore:event.home_score,awayScore:event.away_score,source:'special',
    },
  }));
  const ordered=[...eventChapters,...specialChapters].sort((a,b)=>a.sortMinute-b.sortMinute||a.sortExtra-b.sortExtra||a.sortType-b.sortType||a.sortId-b.sortId);
  let carriedHome: number|null=0;
  let carriedAway: number|null=0;
  const chapters:CinemaChapter[]=[{
    id:'start',kind:'kickoff',minute:0,extraMinute:null,minuteLabel:'0’',title:'Calcio d’inizio',
    narration:`Tutto pronto: ${input.homeTeam} contro ${input.awayTeam}.`,teamName:null,playerName:null,
    homeScore:0,awayScore:0,source:'system',
  }];
  for(const item of ordered){
    const chapter=item.chapter;
    if(chapter.homeScore!=null&&chapter.awayScore!=null){carriedHome=chapter.homeScore;carriedAway=chapter.awayScore;}
    const unknownScoringState=chapter.kind==='goal'&&(chapter.homeScore==null||chapter.awayScore==null);
    chapters.push({...chapter,homeScore:unknownScoringState?null:carriedHome,awayScore:unknownScoringState?null:carriedAway});
  }
  const eventByEvent=ordered.length>0;
  chapters.push({
    id:'finish',kind:'finish',minute:null,extraMinute:null,minuteLabel:'FT',title:'Triplice fischio',
    narration:eventByEvent?'La storia della partita si chiude sul risultato finale.':'La cronaca evento per evento non è disponibile: il Match Cinema mostra soltanto il risultato finale verificato.',
    teamName:null,playerName:null,homeScore:input.homeScore,awayScore:input.awayScore,source:'system',
  });
  const regulationMinutes=ordered.some(item=>(item.chapter.minute??0)>90)?120:90;
  return {chapters,coverage:eventByEvent?'event-by-event':'basic',regulationMinutes};
}
