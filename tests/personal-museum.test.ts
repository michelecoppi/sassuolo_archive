import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {test} from 'node:test';
import {PERSONAL_MUSEUM_MAX_MEMORIES,buildMuseumRooms,calculateMuseumStats,createMuseumMemory,emptyPersonalMuseum,exportPersonalMuseum,mergePersonalMuseums,normalizeMuseumTarget,normalizePersonalMuseum,parsePersonalMuseum,type MuseumMemory,type MuseumTarget} from '../src/services/personalMuseum.js';

const targets={
  milan:{type:'match',entityId:'8842',label:'Sassuolo – Milan',url:'/matches/8842',date:'2024-04-14T18:45:00Z',season:'2023/24',competition:'Serie A',opponent:'Milan'},
  atalanta:{type:'match',entityId:'127',label:'Atalanta – Sassuolo',url:'/matches/127',date:'2014-04-06',season:'2013/14',competition:'Serie A',opponent:'Atalanta'},
  berardi:{type:'player',entityId:'10',label:'Domenico Berardi',url:'/players/10',season:'2023/24'},
  promotion:{type:'season',entityId:'2012/13|Serie B',label:'2012/13 · Serie B',url:'/seasons/2012%2F13?competition=Serie%20B',season:'2012/13',competition:'Serie B'},
} satisfies Record<string,MuseumTarget>;

const memory=(target:MuseumTarget,updatedAt:string,overrides:Partial<Parameters<typeof createMuseumMemory>[1]>={}):MuseumMemory=>createMuseumMemory(target,{experience:'tv',emotion:'pride',intensity:4,note:'Ricordo nitido.',favoriteMoment:'Il boato al gol.',...overrides},updatedAt);

test('accetta soltanto destinazioni interne coerenti con il tipo di ricordo',()=>{
  assert.equal(normalizeMuseumTarget(targets.milan)?.url,'/matches/8842');
  for(const target of [
    {...targets.milan,url:'https://example.test/matches/8842'},
    {...targets.milan,url:'javascript:alert(1)'},
    {...targets.milan,url:'/players/10'},
    {...targets.milan,url:'/matches\\8842'},
    {...targets.milan,label:'   '},
    {...targets.milan,entityId:''},
    {...targets.milan,type:'video'},
  ])assert.equal(normalizeMuseumTarget(target),null);
});

test('normalizza limiti e fallback senza trasformare input ostile in dati eseguibili',()=>{
  const result=createMuseumMemory(targets.berardi,{experience:'invalid' as any,emotion:'invalid' as any,intensity:99 as any,note:`  ${'n'.repeat(600)}  `,favoriteMoment:' f '},'data-non-valida');
  assert.equal(result.experience,'archive');assert.equal(result.emotion,'pride');assert.equal(result.intensity,5);
  assert.equal(result.note.length,500);assert.equal(result.favoriteMoment,'f');assert.equal(result.updatedAt,'1970-01-01T00:00:00.000Z');
});

test('esporta e reimporta accenti, dedica e null senza perdita di significato',()=>{
  const state={version:1 as const,profile:{supporterSince:'2008',dedication:'A chi c’era sotto la pioggia 💚'},memories:[memory(targets.milan,'2024-04-14T21:00:00Z',{emotion:'goosebumps',experience:'stadium',favoriteMoment:'Il sinistro di Mimmo'})]};
  const serialized=exportPersonalMuseum(state,'2026-08-22T12:00:00Z'),restored=parsePersonalMuseum(serialized);
  assert.deepEqual(restored,state);assert.match(serialized,/sassuolo-personal-museum/);assert.match(serialized,/pioggia/);
});

test('rifiuta JSON, formato e versione non riconosciuti e ignora righe corrotte nello storage locale',()=>{
  assert.throws(()=>parsePersonalMuseum('{'),/non valido/);
  assert.throws(()=>parsePersonalMuseum('{}'),/non riconosciuto/);
  assert.throws(()=>parsePersonalMuseum(JSON.stringify({kind:'sassuolo-personal-museum',version:2,memories:[]})),/non supportata/);
  assert.throws(()=>parsePersonalMuseum(JSON.stringify({kind:'sassuolo-personal-museum',version:1,memories:{}})),/non supportata/);
  const normalized=normalizePersonalMuseum({memories:[memory(targets.milan,'2024-01-01T00:00:00Z'),{key:'bad'}]});
  assert.equal(normalized.memories.length,1);
});

test('deduplica per entità scegliendo il ricordo più recente e applica il tetto di sicurezza',()=>{
  const old=memory(targets.milan,'2024-01-01T00:00:00Z',{note:'Vecchio'}),recent=memory(targets.milan,'2025-01-01T00:00:00Z',{note:'Nuovo'});
  const many=Array.from({length:PERSONAL_MUSEUM_MAX_MEMORIES+23},(_,index)=>memory({...targets.berardi,entityId:String(index),url:`/players/${index}`,label:`Giocatore ${index}`},new Date(Date.UTC(2020,0,1,0,0,index)).toISOString()));
  const result=normalizePersonalMuseum({memories:[old,recent,...many]});
  assert.equal(result.memories.find(item=>item.key===old.key)?.note,'Nuovo');
  assert.equal(result.memories.length,PERSONAL_MUSEUM_MAX_MEMORIES);
  assert.equal(result.memories[0].key,'match:8842');assert.equal(result.memories[1].entityId,String(many.length-1));
});

test('unisce backup e dati correnti senza duplicati e senza cancellare il profilo con campi vuoti',()=>{
  const current={version:1 as const,profile:{supporterSince:'2008',dedication:'Sempre qui'},memories:[memory(targets.milan,'2024-01-01T00:00:00Z',{note:'Prima versione'})]};
  const incoming={version:1 as const,profile:{supporterSince:'',dedication:'Nuova dedica'},memories:[memory(targets.milan,'2025-01-01T00:00:00Z',{note:'Dal backup'}),memory(targets.berardi,'2024-02-01T00:00:00Z')]};
  const merged=mergePersonalMuseums(current,incoming);
  assert.deepEqual(merged.profile,{supporterSince:'2008',dedication:'Nuova dedica'});assert.equal(merged.memories.length,2);assert.equal(merged.memories.find(item=>item.key==='match:8842')?.note,'Dal backup');
});

test('calcola statistiche verosimili in modo stabile anche a pari merito e con date mancanti',()=>{
  const memories=[memory(targets.milan,'2024-04-15T00:00:00Z',{experience:'stadium',emotion:'joy'}),memory({...targets.milan,entityId:'8850',label:'Milan – Sassuolo',url:'/matches/8850',opponent:'Milan',date:'2022-05-01',season:'2021/22'},'2024-04-16T00:00:00Z',{emotion:'joy'}),memory(targets.atalanta,'2020-01-01T00:00:00Z',{experience:'stadium',emotion:'tension'}),memory(targets.berardi,'2023-01-01T00:00:00Z',{emotion:'pride'}),memory(targets.promotion,'2013-05-18T00:00:00Z',{emotion:'pride'})];
  const stats=calculateMuseumStats(memories);
  assert.deepEqual({total:stats.total,matches:stats.matches,players:stats.players,seasons:stats.seasons,stadium:stats.stadium,livedSeasons:stats.livedSeasons},{total:5,matches:3,players:1,seasons:1,stadium:2,livedSeasons:4});
  assert.equal(stats.topOpponent,'Milan');assert.equal(stats.topEmotion,'joy');assert.equal(stats.firstMemory?.key,'season:2012/13|Serie B');
  assert.equal(calculateMuseumStats([]).firstMemory,null);
});

test('costruisce solo le sale utili e mantiene ingresso e finale anche a museo vuoto',()=>{
  assert.deepEqual(buildMuseumRooms([]).map(room=>room.id),['welcome','finale']);
  const mixed=[memory(targets.milan,'2024-01-01T00:00:00Z'),memory(targets.berardi,'2024-02-01T00:00:00Z'),memory(targets.promotion,'2024-03-01T00:00:00Z')];
  assert.deepEqual(buildMuseumRooms(mixed).map(room=>room.id),['welcome','timeline','matches','heroes','seasons','constellation','finale']);
  assert.equal(buildMuseumRooms([mixed[0]])[1].id,'timeline');assert.equal(buildMuseumRooms([mixed[0]]).some(room=>room.id==='constellation'),false);
});

test('il dominio privato non dipende da API, fetch o telemetria',()=>{
  const service=fs.readFileSync(path.resolve('src/services/personalMuseum.ts'),'utf8'),context=fs.readFileSync(path.resolve('src/context/MuseumContext.tsx'),'utf8');
  for(const source of [service,context])for(const forbidden of ['services/api','fetch(','reportFrontendEvent','installFrontendTelemetry'])assert.equal(source.includes(forbidden),false,forbidden);
  assert.deepEqual(emptyPersonalMuseum(),{version:1,profile:{supporterSince:'',dedication:''},memories:[]});
});
