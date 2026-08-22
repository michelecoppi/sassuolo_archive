export const PERSONAL_MUSEUM_KEY='sassuolo-history-personal-museum:v1';
export const PERSONAL_MUSEUM_VERSION=1;
export const PERSONAL_MUSEUM_MAX_MEMORIES=500;

export type MuseumEntityType='match'|'player'|'season';
export type MuseumExperience='stadium'|'tv'|'radio'|'highlights'|'archive';
export type MuseumEmotion='goosebumps'|'joy'|'pride'|'tension'|'heartbreak';

export type MuseumTarget={
  type:MuseumEntityType;
  entityId:string;
  label:string;
  url:string;
  date?:string|null;
  season?:string|null;
  competition?:string|null;
  opponent?:string|null;
};

export type MuseumMemory=MuseumTarget&{
  key:string;
  experience:MuseumExperience;
  emotion:MuseumEmotion;
  intensity:1|2|3|4|5;
  note:string;
  favoriteMoment:string;
  createdAt:string;
  updatedAt:string;
};

export type MuseumProfile={supporterSince:string;dedication:string};
export type PersonalMuseumState={version:1;profile:MuseumProfile;memories:MuseumMemory[]};
export type MuseumMemoryDraft=Pick<MuseumMemory,'experience'|'emotion'|'intensity'|'note'|'favoriteMoment'>;

export type MuseumStats={
  total:number;
  matches:number;
  players:number;
  seasons:number;
  stadium:number;
  livedSeasons:number;
  mostLivedSeason:string|null;
  topOpponent:string|null;
  topEmotion:MuseumEmotion|null;
  firstMemory:MuseumMemory|null;
};

export type MuseumRoom={id:'welcome'|'timeline'|'matches'|'heroes'|'seasons'|'constellation'|'finale';title:string;eyebrow:string;memories:MuseumMemory[]};

export const experienceLabels:Record<MuseumExperience,string>={stadium:'Allo stadio',tv:'In TV',radio:'Alla radio',highlights:'Highlights',archive:'Nell’archivio'};
export const emotionLabels:Record<MuseumEmotion,string>={goosebumps:'Brividi',joy:'Gioia',pride:'Orgoglio',tension:'Tensione',heartbreak:'Cuore spezzato'};
const entityTypes:MuseumEntityType[]=['match','player','season'];
const experiences:MuseumExperience[]=['stadium','tv','radio','highlights','archive'];
const emotions:MuseumEmotion[]=['goosebumps','joy','pride','tension','heartbreak'];
const emptyProfile:MuseumProfile={supporterSince:'',dedication:''};

export const emptyPersonalMuseum=():PersonalMuseumState=>({version:PERSONAL_MUSEUM_VERSION,profile:{...emptyProfile},memories:[]});
export const museumMemoryKey=(target:Pick<MuseumTarget,'type'|'entityId'>)=>`${target.type}:${target.entityId}`;

function safeString(value:unknown,max:number){return typeof value==='string'?value.trim().slice(0,max):'';}
function safeOptional(value:unknown,max:number){const normalized=safeString(value,max);return normalized||null;}
function safeIso(value:unknown){const text=safeString(value,40);return text&&Number.isFinite(Date.parse(text))?new Date(text).toISOString():null;}
function safeUrl(value:unknown,type:MuseumEntityType){
  const text=safeString(value,300);
  const expected=type==='match'?'/matches/':type==='player'?'/players/':'/seasons/';
  return text.startsWith(expected)&&!text.includes('\\')?text:'';
}

export function normalizeMuseumTarget(value:unknown):MuseumTarget|null{
  if(!value||typeof value!=='object')return null;
  const row=value as Record<string,unknown>,type=entityTypes.includes(row.type as MuseumEntityType)?row.type as MuseumEntityType:null;
  if(!type)return null;
  const entityId=safeString(row.entityId,120),label=safeString(row.label,160),url=safeUrl(row.url,type);
  if(!entityId||!label||!url)return null;
  return {type,entityId,label,url,date:safeOptional(row.date,40),season:safeOptional(row.season,20),competition:safeOptional(row.competition,80),opponent:safeOptional(row.opponent,120)};
}

export function createMuseumMemory(target:MuseumTarget,draft:MuseumMemoryDraft,now=new Date().toISOString(),existing?:MuseumMemory|null):MuseumMemory{
  const normalized=normalizeMuseumTarget(target);if(!normalized)throw new Error('Destinazione museo non valida');
  const experience=experiences.includes(draft.experience)?draft.experience:'archive';
  const emotion=emotions.includes(draft.emotion)?draft.emotion:'pride';
  const intensity=Math.max(1,Math.min(5,Math.round(Number(draft.intensity)||3))) as MuseumMemory['intensity'];
  const timestamp=safeIso(now)??new Date(0).toISOString();
  return {...normalized,key:museumMemoryKey(normalized),experience,emotion,intensity,note:safeString(draft.note,500),favoriteMoment:safeString(draft.favoriteMoment,160),createdAt:existing?.createdAt??timestamp,updatedAt:timestamp};
}

export function normalizeMuseumMemory(value:unknown):MuseumMemory|null{
  const target=normalizeMuseumTarget(value);if(!target||!value||typeof value!=='object')return null;
  const row=value as Record<string,unknown>;
  if(!experiences.includes(row.experience as MuseumExperience)||!emotions.includes(row.emotion as MuseumEmotion))return null;
  const intensity=Number(row.intensity);if(!Number.isInteger(intensity)||intensity<1||intensity>5)return null;
  const createdAt=safeIso(row.createdAt),updatedAt=safeIso(row.updatedAt);if(!createdAt||!updatedAt)return null;
  return {...target,key:museumMemoryKey(target),experience:row.experience as MuseumExperience,emotion:row.emotion as MuseumEmotion,intensity:intensity as MuseumMemory['intensity'],note:safeString(row.note,500),favoriteMoment:safeString(row.favoriteMoment,160),createdAt,updatedAt};
}

export function normalizePersonalMuseum(value:unknown):PersonalMuseumState{
  if(!value||typeof value!=='object')return emptyPersonalMuseum();
  const row=value as Record<string,unknown>,rawProfile=row.profile&&typeof row.profile==='object'?row.profile as Record<string,unknown>:{};
  const profile={supporterSince:safeString(rawProfile.supporterSince,20),dedication:safeString(rawProfile.dedication,180)};
  const byKey=new Map<string,MuseumMemory>();
  for(const candidate of Array.isArray(row.memories)?row.memories:[]){
    const memory=normalizeMuseumMemory(candidate);if(!memory)continue;
    const previous=byKey.get(memory.key);if(!previous||memory.updatedAt>previous.updatedAt)byKey.set(memory.key,memory);
  }
  const memories=[...byKey.values()].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)||a.key.localeCompare(b.key)).slice(0,PERSONAL_MUSEUM_MAX_MEMORIES);
  return {version:PERSONAL_MUSEUM_VERSION,profile,memories};
}

export function parsePersonalMuseum(text:string){
  let parsed:unknown;try{parsed=JSON.parse(text);}catch{throw new Error('File del museo non valido');}
  if(!parsed||typeof parsed!=='object'||(parsed as Record<string,unknown>).kind!=='sassuolo-personal-museum')throw new Error('File del museo non riconosciuto');
  const row=parsed as Record<string,unknown>;
  if(row.version!==PERSONAL_MUSEUM_VERSION||!Array.isArray(row.memories))throw new Error('Versione del museo non supportata');
  return normalizePersonalMuseum(row);
}

export function exportPersonalMuseum(state:PersonalMuseumState,exportedAt=new Date().toISOString()){
  return JSON.stringify({kind:'sassuolo-personal-museum',version:PERSONAL_MUSEUM_VERSION,exportedAt,stateVersion:state.version,profile:state.profile,memories:state.memories},null,2);
}

export function mergePersonalMuseums(current:PersonalMuseumState,incoming:PersonalMuseumState):PersonalMuseumState{
  return normalizePersonalMuseum({profile:{supporterSince:incoming.profile.supporterSince||current.profile.supporterSince,dedication:incoming.profile.dedication||current.profile.dedication},memories:[...current.memories,...incoming.memories]});
}

function mode(values:string[]){
  const counts=new Map<string,number>();for(const value of values)counts.set(value,(counts.get(value)??0)+1);
  return [...counts.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'it'))[0]?.[0]??null;
}

function memoryTime(memory:MuseumMemory){return memory.date&&Number.isFinite(Date.parse(memory.date))?Date.parse(memory.date):Date.parse(memory.createdAt);}

export function calculateMuseumStats(memories:MuseumMemory[]):MuseumStats{
  const seasons=[...new Set(memories.map(memory=>memory.season).filter((value):value is string=>Boolean(value)))];
  const firstMemory=[...memories].sort((a,b)=>memoryTime(a)-memoryTime(b)||a.key.localeCompare(b.key))[0]??null;
  return {
    total:memories.length,matches:memories.filter(memory=>memory.type==='match').length,players:memories.filter(memory=>memory.type==='player').length,seasons:memories.filter(memory=>memory.type==='season').length,
    stadium:memories.filter(memory=>memory.experience==='stadium').length,livedSeasons:seasons.length,
    mostLivedSeason:mode(memories.map(memory=>memory.season).filter((value):value is string=>Boolean(value))),
    topOpponent:mode(memories.filter(memory=>memory.type==='match').map(memory=>memory.opponent).filter((value):value is string=>Boolean(value))),
    topEmotion:mode(memories.map(memory=>memory.emotion)) as MuseumEmotion|null,firstMemory,
  };
}

export function buildMuseumRooms(memories:MuseumMemory[]):MuseumRoom[]{
  const chronological=[...memories].sort((a,b)=>memoryTime(a)-memoryTime(b)||a.key.localeCompare(b.key));
  const rooms:MuseumRoom[]=[{id:'welcome',title:'Il mio Museo Neroverde',eyebrow:'Ingresso',memories:[]}];
  if(memories.length)rooms.push({id:'timeline',title:'La mia linea del tempo',eyebrow:'Galleria dei ricordi',memories:chronological});
  const matches=chronological.filter(memory=>memory.type==='match');if(matches.length)rooms.push({id:'matches',title:'Le partite che porto con me',eyebrow:'Sala delle partite',memories:matches});
  const players=chronological.filter(memory=>memory.type==='player');if(players.length)rooms.push({id:'heroes',title:'I miei eroi neroverdi',eyebrow:'Sala degli eroi',memories:players});
  const seasons=chronological.filter(memory=>memory.type==='season');if(seasons.length)rooms.push({id:'seasons',title:'Le stagioni della mia storia',eyebrow:'Muro delle stagioni',memories:seasons});
  if(memories.length>1)rooms.push({id:'constellation',title:'La mia costellazione',eyebrow:'Legami neroverdi',memories:chronological});
  rooms.push({id:'finale',title:memories.length?'Questa storia continua':'Il museo aspetta la prima memoria',eyebrow:'Sala finale',memories:chronological});
  return rooms;
}
