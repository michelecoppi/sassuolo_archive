import { createBackupSnapshot, db, nowIso, recordChange, recordImportRun, recordSourceReference } from '../server/db/database.js';

const startedAt=nowIso();
const corrections=[
  {externalKey:'fbref-uel|2016-17|2016-07-28|Luzern|Sassuolo',homeScore:1,awayScore:1,sourceUrl:'https://www.uefa.com/uefaeuropaleague/match/2020373--luzern-vs-sassuolo/'},
  {externalKey:'fbref-uel|2016-17|2016-10-20|Rapid Wien|Sassuolo',homeScore:1,awayScore:1,sourceUrl:'https://www.uefa.com/uefaeuropaleague/news/0232-0e9550ee2910-1f183bcc268f-1000--sassuolo-v-rapid-wien-background/'},
];
const beforeMatches=corrections.map(item=>db.prepare(`SELECT id,external_key,home_score,away_score,source_provider,source_url FROM matches WHERE external_key=?`).get(item.externalKey) as any);
if(beforeMatches.some(match=>!match))throw new Error('Una fixture Europa League da correggere non è presente nel database.');
if(beforeMatches.some(match=>match.source_provider==='manual'))throw new Error('Una fixture Europa League è protetta da modifica manuale.');
const beforeSeason=db.prepare(`SELECT * FROM seasons WHERE season='2016/17' AND competition='Europa League'`).get() as any;
if(!beforeSeason)throw new Error('Il riepilogo Europa League 2016/17 non è presente nel database.');
const seasonTarget={matches:10,wins:3,draws:4,losses:3,goals_for:17,goals_against:13,points:13,home_record:'3-1-1',away_record:'0-3-2'};
const fixtureChanged=beforeMatches.some((match,index)=>Number(match.home_score)!==corrections[index].homeScore||Number(match.away_score)!==corrections[index].awayScore);
const seasonChanged=Object.entries(seasonTarget).some(([field,value])=>String(beforeSeason[field]??'')!==String(value));

if(!fixtureChanged&&!seasonChanged){
  console.log(JSON.stringify({updated:0,message:'Correzioni Europa League 2016/17 già applicate.'},null,2));
  db.close();
  process.exit(0);
}

const backup=createBackupSnapshot('before-europa-league-2016-17-score-correction');
db.transaction(()=>{
  const updateMatch=db.prepare(`UPDATE matches SET home_score=?,away_score=?,source_provider='UEFA',source_url=?,last_verified_at=? WHERE external_key=?`);
  for(const item of corrections)updateMatch.run(item.homeScore,item.awayScore,item.sourceUrl,nowIso(),item.externalKey);
  db.prepare(`UPDATE seasons SET matches=?,wins=?,draws=?,losses=?,goals_for=?,goals_against=?,points=?,home_record=?,away_record=?,source_provider='UEFA / FBref',source_url=?,last_verified_at=? WHERE season='2016/17' AND competition='Europa League'`)
    .run(seasonTarget.matches,seasonTarget.wins,seasonTarget.draws,seasonTarget.losses,seasonTarget.goals_for,seasonTarget.goals_against,seasonTarget.points,seasonTarget.home_record,seasonTarget.away_record,'https://www.uefa.com/uefaeuropaleague/history/seasons/2017/clubs/',nowIso());
})();
const afterMatches=corrections.map(item=>db.prepare(`SELECT id,external_key,home_score,away_score,source_provider,source_url FROM matches WHERE external_key=?`).get(item.externalKey) as any);
const afterSeason=db.prepare(`SELECT * FROM seasons WHERE season='2016/17' AND competition='Europa League'`).get() as any;
const importRunId=recordImportRun({kind:'manual_change',sourceProvider:'UEFA',area:'competition_profile',season:'2016/17',competition:'Europa League',status:'succeeded',startedAt,finishedAt:nowIso(),recordsSeen:3,recordsUpdated:3,backupId:backup.id,diff:{before:{matches:beforeMatches,season:beforeSeason},after:{matches:afterMatches,season:afterSeason}},notes:'Correzione risultati UEFA e aggregati prima della nuova scheda Europa League.'});
for(let index=0;index<corrections.length;index++){
  const item=corrections[index],match=afterMatches[index];
  for(const field of ['home_score','away_score'] as const)recordSourceReference({entityType:'matches',entityId:match.id,field,sourceUrl:item.sourceUrl,sourceProvider:'UEFA',importRunId,transformation:'verified-score-correction',originalValue:match[field],note:'Risultato verificato sulla fonte UEFA.'});
}
recordChange({entityType:'competition_profile',action:'update',before:{matches:beforeMatches,season:beforeSeason},after:{matches:afterMatches,season:afterSeason},sourceUrl:'https://www.uefa.com/uefaeuropaleague/history/seasons/2017/clubs/',author:'DATA-01',backupId:backup.id,note:'Correzione risultati e riepilogo Europa League 2016/17.'});
console.log(JSON.stringify({updated:3,backupId:backup.id,importRunId},null,2));
db.close();
