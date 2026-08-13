import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve('.');

test('il calendario Serie A 2025/26 contiene 38 giornate e totali coerenti', () => {
  const matches = JSON.parse(fs.readFileSync(path.join(root,'data/matches/sassuolo-serie-a-2025-26.json'),'utf8')) as any[];
  assert.equal(matches.length,38);
  assert.deepEqual(matches.map(match=>Number(match.round)),Array.from({length:38},(_,index)=>index+1));
  const totals=matches.reduce((sum,match)=>{
    const home=/sassuolo/i.test(match.home_team);
    const gf=home?match.home_score:match.away_score,ga=home?match.away_score:match.home_score;
    sum.gf+=gf;sum.ga+=ga;sum.wins+=gf>ga?1:0;sum.draws+=gf===ga?1:0;sum.losses+=gf<ga?1:0;
    return sum;
  },{gf:0,ga:0,wins:0,draws:0,losses:0});
  assert.deepEqual(totals,{gf:46,ga:50,wins:14,draws:7,losses:17});
});

test('le statistiche derivate 2025/26 espongono i leader verificati', () => {
  const csv=fs.readFileSync(path.join(root,'data/player-seasons/sassuolo-serie-a-2025-26-derived.csv'),'utf8');
  assert.match(csv,/^player_name,season,competition,appearances,starts,minutes,/);
  assert.match(csv,/Andrea Pinamonti,2025\/26,Serie A,34,30,2397,[^\r\n]*,9,[^\r\n]*,3,/);
  assert.match(csv,/Armand Laurienté,2025\/26,Serie A,37,32,2544,[^\r\n]*,7,[^\r\n]*,9,/);
  assert.match(csv,/kickoff-derived \(37\/38 detailed matches\)/);
});
