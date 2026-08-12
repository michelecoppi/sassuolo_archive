import { performance } from 'node:perf_hooks';
import { createApp } from '../server/app.js';
import { db } from '../server/db/database.js';

const app=createApp({nodeEnv:'test',adminToken:null,cacheTtlMs:0});const server=app.listen(0);const address=server.address();
if(!address||typeof address==='string')throw new Error('Server benchmark non disponibile');
const base=`http://127.0.0.1:${address.port}/api`;
const endpoints=['/matches?page=1&pageSize=50','/players?page=1&pageSize=50','/transfers?page=1&pageSize=50','/manual/matches?page=1&pageSize=50'];
const percentile=(values:number[],ratio:number)=>values.sort((a,b)=>a-b)[Math.min(values.length-1,Math.floor(values.length*ratio))];
const measurements=[] as Array<{endpoint:string;runs:number;p50Ms:number;p95Ms:number;bytes:number}>;
for(const endpoint of endpoints){
  const durations:number[]=[];let bytes=0;
  for(let run=0;run<30;run++){const started=performance.now();const response=await fetch(`${base}${endpoint}&benchmark=${run}`);const body=await response.arrayBuffer();if(!response.ok)throw new Error(`${endpoint}: HTTP ${response.status}`);durations.push(performance.now()-started);bytes=body.byteLength;}
  measurements.push({endpoint,runs:durations.length,p50Ms:Number(percentile([...durations],.5).toFixed(2)),p95Ms:Number(percentile([...durations],.95).toFixed(2)),bytes});
}
const counts=Object.fromEntries(['matches','players','transfers','player_seasons'].map(table=>[table,Number((db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as any).count)]));
console.log(JSON.stringify({measuredAt:new Date().toISOString(),database:'archivio SQLite locale',counts,measurements},null,2));
await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));db.close();
