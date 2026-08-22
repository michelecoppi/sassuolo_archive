import assert from 'node:assert/strict';
import {test} from 'node:test';
import {buildCinemaStory,cinemaEventKind,cinemaMinuteLabel,type CinemaEventInput} from '../src/components/matchCinemaModel.js';

const event=(value:Partial<CinemaEventInput>&Pick<CinemaEventInput,'id'>):CinemaEventInput=>({
  id:value.id,minute:null,extra_minute:null,team_name:null,player_name:null,assist_name:null,type:null,detail:null,comments:null,...value,
});

test('costruisce una cronaca verosimile 3-1 conservando soltanto i punteggi espliciti',()=>{
  const story=buildCinemaStory({homeTeam:'Sassuolo',awayTeam:'Milan',homeScore:3,awayScore:1,events:[
    event({id:1,minute:12,team_name:'Sassuolo',player_name:'Berardi',assist_name:'Defrel',type:'Goal',scoring_play:1,home_score:1,away_score:0}),
    event({id:2,minute:38,team_name:'Milan',player_name:'Leão',type:'Card',detail:'Yellow Card'}),
    event({id:3,minute:51,team_name:'Milan',player_name:'Giroud',type:'Goal',scoring_play:true,home_score:1,away_score:1}),
    event({id:4,minute:67,team_name:'Sassuolo',player_name:'Pinamonti',assist_name:'Thorstvedt',type:'Goal',home_score:2,away_score:1}),
    event({id:5,minute:90,extra_minute:2,team_name:'Sassuolo',player_name:'Bajrami',type:'Goal',home_score:3,away_score:1}),
  ]});
  assert.equal(story.coverage,'event-by-event');
  assert.deepEqual(story.chapters.map(chapter=>chapter.id),['start','event-1','event-2','event-3','event-4','event-5','finish']);
  assert.deepEqual(story.chapters.map(chapter=>[chapter.homeScore,chapter.awayScore]),[[0,0],[1,0],[1,0],[1,1],[2,1],[3,1],[3,1]]);
  assert.equal(story.chapters[1].narration,'Berardi su assist di Defrel.');
  assert.equal(story.chapters[5].minuteLabel,'90+2’');
});

test('non inventa il punteggio di un gol quando il dato intermedio manca',()=>{
  const story=buildCinemaStory({homeTeam:'Sassuolo',awayTeam:'Roma',homeScore:1,awayScore:0,events:[event({id:7,minute:81,type:'Goal',player_name:'Matri'})]});
  assert.equal(story.chapters[1].kind,'goal');
  assert.equal(story.chapters[1].homeScore,null);
  assert.equal(story.chapters[1].awayScore,null);
  assert.deepEqual([story.chapters.at(-1)?.homeScore,story.chapters.at(-1)?.awayScore],[1,0]);
});

test('ordina in modo deterministico recupero, stesso minuto, eventi speciali e minuti ignoti',()=>{
  const story=buildCinemaStory({homeTeam:'Sassuolo',awayTeam:'Inter',homeScore:0,awayScore:0,events:[
    event({id:9,minute:null,type:'Other'}),event({id:5,minute:45,extra_minute:2,type:'Card'}),event({id:2,minute:45,extra_minute:1,type:'Card'}),event({id:1,minute:45,extra_minute:1,type:'Substitution'}),
  ],specialEvents:[{id:3,event_type:'SUSPENDED',match_minute:45,home_score:0,away_score:0,reason:'Pioggia intensa',description:'Il terreno non è praticabile.'}]});
  assert.deepEqual(story.chapters.map(chapter=>chapter.id),['start','special-3','event-1','event-2','event-5','event-9','finish']);
  assert.match(story.chapters[1].narration,/Pioggia intensa/);
  assert.equal(story.chapters.at(-2)?.minuteLabel,'N/D');
});

test('riconosce supplementari e categorie senza scambiare un gol annullato per una rete',()=>{
  const story=buildCinemaStory({homeTeam:'Sassuolo',awayTeam:'Napoli',homeScore:2,awayScore:1,events:[event({id:1,minute:105,type:'Goal',scoring_play:true,home_score:2,away_score:1})]});
  assert.equal(story.regulationMinutes,120);
  assert.equal(cinemaEventKind({type:'Goal',detail:'Goal cancelled by VAR',scoring_play:false}),'var');
  assert.equal(cinemaEventKind({type:'Card',detail:'Red Card',scoring_play:false}),'red-card');
  assert.equal(cinemaMinuteLabel(90,6),'90+6’');
});

test('la copertura BASIC ha solo apertura e finale e dichiara il limite',()=>{
  const story=buildCinemaStory({homeTeam:'Sassuolo',awayTeam:'Parma',homeScore:2,awayScore:2,events:[]});
  assert.equal(story.coverage,'basic');
  assert.deepEqual(story.chapters.map(chapter=>chapter.id),['start','finish']);
  assert.match(story.chapters[1].narration,/non è disponibile/i);
  assert.deepEqual([story.chapters[1].homeScore,story.chapters[1].awayScore],[2,2]);
});
