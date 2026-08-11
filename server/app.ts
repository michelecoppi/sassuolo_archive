import crypto from 'node:crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import { api } from './routes/api.js';
import { db, initDb, nowIso } from './db/database.js';
import { createApiResponseCache, createRequestObservability } from './services/operations.js';

type AppOptions={adminToken?:string|null;nodeEnv?:string;corsOrigins?:string[];mutationLimit?:number;cacheTtlMs?:number};

const safeEqual=(left:string,right:string)=>{
  const a=Buffer.from(left);const b=Buffer.from(right);
  return a.length===b.length&&crypto.timingSafeEqual(a,b);
};

export function createApp(options:AppOptions={}){
  initDb();
  const nodeEnv=options.nodeEnv??process.env.NODE_ENV??'development';
  const adminToken=options.adminToken===undefined?(process.env.ADMIN_API_TOKEN||null):options.adminToken;
  if(nodeEnv==='production'&&!adminToken)throw new Error('ADMIN_API_TOKEN è obbligatorio in produzione');
  const configuredOrigins=options.corsOrigins??String(process.env.CORS_ORIGINS??'').split(',').map(x=>x.trim()).filter(Boolean);
  const localOrigins=['http://localhost:5173','http://127.0.0.1:5173','http://localhost:4173','http://127.0.0.1:4173'];
  const allowedOrigins=new Set(configuredOrigins.length?configuredOrigins:nodeEnv==='production'?[]:localOrigins);
  const app=express();
  app.disable('x-powered-by');
  app.set('trust proxy',false);
  app.use((_req,res,next)=>{res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');next();});
  app.use(cors({origin(origin,callback){if(!origin||allowedOrigins.has(origin))return callback(null,true);callback(new Error('Origine CORS non autorizzata'));},methods:['GET','HEAD','POST','PUT','PATCH','DELETE'],allowedHeaders:['Content-Type','Authorization','X-Admin-Name']}));
  app.use(express.json({limit:'2mb',strict:true}));

  const responseCache=createApiResponseCache(options.cacheTtlMs??30_000);
  const observability=createRequestObservability();
  app.locals.responseCache=responseCache;
  app.locals.observability=observability;
  app.use('/api',observability.middleware);
  app.use('/api',responseCache.middleware);

  const attempts=new Map<string,{windowStart:number,count:number}>();const limit=options.mutationLimit??60;
  app.use('/api',(req:Request,res:Response,next:NextFunction)=>{
    const protectedRead=req.method==='GET'&&req.path==='/corrections';
    if(['GET','HEAD','OPTIONS'].includes(req.method)&&!protectedRead)return next();
    const now=Date.now();const key=req.ip||req.socket.remoteAddress||'unknown';const state=attempts.get(key);
    const current=!state||now-state.windowStart>=60_000?{windowStart:now,count:1}:{...state,count:state.count+1};attempts.set(key,current);
    const publicCorrection=req.method==='POST'&&req.path==='/corrections';
    const actor=String(req.headers['x-admin-name']??(publicCorrection?'public-reporter':adminToken?'anonymous':'local-development')).slice(0,120);
    res.on('finish',()=>{try{db.prepare(`INSERT INTO security_audit_log(method,path,actor,role,ip,status_code,created_at) VALUES(?,?,?,?,?,?,?)`).run(req.method,req.path,actor,res.statusCode===401?'anonymous':publicCorrection?'reporter':'admin',key,res.statusCode,nowIso());}catch{/* il log non deve interrompere la risposta già conclusa */}});
    res.setHeader('X-RateLimit-Limit',String(limit));res.setHeader('X-RateLimit-Remaining',String(Math.max(0,limit-current.count)));
    if(current.count>limit)return res.status(429).json({error:'Troppe operazioni di scrittura: riprova tra un minuto'});
    if(adminToken&&!publicCorrection){const authorization=String(req.headers.authorization??'');const token=authorization.startsWith('Bearer ')?authorization.slice(7):'';if(!safeEqual(token,adminToken))return res.status(401).json({error:'Autenticazione amministrativa richiesta'});}
    next();
  });
  app.use('/api',api);
  app.use((error:unknown,_req:Request,res:Response,_next:NextFunction)=>res.status(400).json({error:error instanceof Error?error.message:'Richiesta non valida'}));
  return app;
}
