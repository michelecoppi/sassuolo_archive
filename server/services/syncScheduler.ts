import crypto from 'node:crypto';
import type Database from 'better-sqlite3';

export type SyncTask = () => Promise<unknown>;
export type SyncJobDefinition = {
  name: string;
  task: SyncTask;
  scheduleMinutes?: number;
  maxAttempts?: number;
  minimumQuota?: number;
  quotaRemaining?: () => number | null;
};

const sleep=(milliseconds:number)=>new Promise(resolve=>setTimeout(resolve,milliseconds));
const cleanError=(error:unknown)=>String(error).replace(/\b(?:token|api[_-]?key|authorization)\s*[=:]\s*[^\s,;]+/gi,'credential=[redacted]').slice(0,500);

export function createSyncScheduler(database:Database, definitions:SyncJobDefinition[], options:{backoffMs?:number;lockMs?:number}={}) {
  const jobs=new Map(definitions.map(definition=>[definition.name,definition]));
  const backoffMs=options.backoffMs??500;
  const lockMs=options.lockMs??15*60_000;
  const now=()=>new Date().toISOString();
  for(const definition of definitions)database.prepare(`INSERT INTO sync_jobs(job_name,schedule_minutes,next_run_at,updated_at) VALUES(?,?,?,?) ON CONFLICT(job_name) DO NOTHING`).run(definition.name,definition.scheduleMinutes??60,now(),now());

  async function run(name:string,idempotencyKey?:string) {
    const definition=jobs.get(name);if(!definition)throw new Error(`Job sconosciuto: ${name}`);
    const key=idempotencyKey||`${name}:${new Date().toISOString().slice(0,16)}`;
    const previous=database.prepare(`SELECT status,result_json FROM sync_job_runs WHERE idempotency_key=?`).get(key) as any;
    if(previous)return {ok:previous.status==='succeeded',deduplicated:true,status:previous.status,result:previous.result_json?JSON.parse(previous.result_json):null};
    const owner=crypto.randomUUID();const startedAt=now();const lockUntil=new Date(Date.now()+lockMs).toISOString();
    const acquired=database.prepare(`UPDATE sync_jobs SET lock_owner=?,lock_until=?,last_status='running',last_started_at=?,updated_at=? WHERE job_name=? AND enabled=1 AND (lock_until IS NULL OR lock_until<?)`).run(owner,lockUntil,startedAt,startedAt,name,startedAt);
    if(!acquired.changes)return {ok:false,deduplicated:true,status:'locked'};
    database.prepare(`INSERT INTO sync_job_runs(job_name,idempotency_key,status,started_at) VALUES(?,?, 'running',?)`).run(name,key,startedAt);
    const remaining=definition.quotaRemaining?.()??null;
    if(remaining!=null&&remaining<(definition.minimumQuota??1)){
      const error=`Quota insufficiente (${remaining} rimaste): job non avviato`;
      finish('failed',1,null,error);return {ok:false,status:'failed',attempts:1,error,action:'Attendere il reset quota o configurare un provider alternativo'};
    }
    const maxAttempts=Math.max(1,definition.maxAttempts??3);let lastError='';
    for(let attempt=1;attempt<=maxAttempts;attempt++){
      try{
        database.prepare(`UPDATE sync_jobs SET attempt=?,updated_at=? WHERE job_name=? AND lock_owner=?`).run(attempt,now(),name,owner);
        const result=await definition.task();finish('succeeded',attempt,result,null);return {ok:true,status:'succeeded',attempts:attempt,result};
      }catch(error){lastError=cleanError(error);if(attempt<maxAttempts)await sleep(backoffMs*2**(attempt-1));else finish('failed',attempt,null,lastError);}
    }
    return {ok:false,status:'failed',attempts:maxAttempts,error:lastError,action:'Controllare credenziali, quota e disponibilità provider; poi rieseguire il job'};

    function finish(status:'succeeded'|'failed',attempts:number,result:unknown,error:string|null){
      const finishedAt=now();const interval=jobs.get(name)!.scheduleMinutes??60;const nextRunAt=new Date(Date.now()+interval*60_000).toISOString();const alert=error?`${error}. Azione: controllare provider e rieseguire ${name}.`:null;
      database.prepare(`UPDATE sync_job_runs SET status=?,attempts=?,finished_at=?,result_json=?,error_text=? WHERE idempotency_key=?`).run(status,attempts,finishedAt,result==null?null:JSON.stringify(result),error,key);
      database.prepare(`UPDATE sync_jobs SET lock_owner=NULL,lock_until=NULL,attempt=0,last_status=?,last_finished_at=?,last_error=?,last_alert=?,next_run_at=?,updated_at=? WHERE job_name=? AND lock_owner=?`).run(status,finishedAt,error,alert,nextRunAt,finishedAt,name,owner);
    }
  }

  async function runDue(){
    const due=database.prepare(`SELECT job_name,next_run_at FROM sync_jobs WHERE enabled=1 AND next_run_at<=? ORDER BY next_run_at`).all(now()) as any[];
    return Promise.all(due.map(row=>run(row.job_name,`${row.job_name}:${row.next_run_at}`)));
  }
  function status(){return {jobs:database.prepare(`SELECT * FROM sync_jobs ORDER BY job_name`).all(),runs:database.prepare(`SELECT * FROM sync_job_runs ORDER BY id DESC LIMIT 30`).all()};}
  function configure(name:string,input:{enabled?:boolean;scheduleMinutes?:number}){if(!jobs.has(name))throw new Error(`Job sconosciuto: ${name}`);const current=database.prepare(`SELECT * FROM sync_jobs WHERE job_name=?`).get(name) as any;const minutes=Math.max(5,Math.trunc(input.scheduleMinutes??current.schedule_minutes));database.prepare(`UPDATE sync_jobs SET enabled=?,schedule_minutes=?,next_run_at=?,updated_at=? WHERE job_name=?`).run(input.enabled===undefined?current.enabled:Number(input.enabled),minutes,new Date(Date.now()+minutes*60_000).toISOString(),now(),name);return database.prepare(`SELECT * FROM sync_jobs WHERE job_name=?`).get(name);}
  return {run,runDue,status,configure};
}
