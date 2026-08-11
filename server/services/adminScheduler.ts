import { db, initDb } from '../db/database.js';
import { apiFootballStatus, syncApiFootballCurrent } from './apiFootballSync.js';
import { kickoffStatus, syncKickoffCurrent } from './kickoffSync.js';
import { syncMatches, syncNews, syncSquad } from './sync.js';
import { createSyncScheduler } from './syncScheduler.js';

let instance:ReturnType<typeof createSyncScheduler>|null=null;

export function getAdminScheduler(){
  if(instance)return instance;
  initDb();
  instance=createSyncScheduler(db,[
    {name:'current-matches',scheduleMinutes:60,maxAttempts:3,minimumQuota:2,quotaRemaining:()=>kickoffStatus().configured?kickoffStatus().quotaRemaining:null,task:()=>kickoffStatus().configured?syncKickoffCurrent(false):syncMatches()},
    {name:'current-squad',scheduleMinutes:360,maxAttempts:3,minimumQuota:3,quotaRemaining:()=>apiFootballStatus().configured?apiFootballStatus().quotaRemaining:null,task:()=>apiFootballStatus().configured?syncApiFootballCurrent():syncSquad()},
    {name:'news',scheduleMinutes:30,maxAttempts:3,task:()=>syncNews()},
  ]);
  return instance;
}

export function startAdminScheduler(pollMs=60_000){
  const scheduler=getAdminScheduler();
  void scheduler.runDue();
  const timer=setInterval(()=>void scheduler.runDue(),pollMs);
  timer.unref();
  return timer;
}
