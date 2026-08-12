import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import { api } from './routes/api.js';
import { db, initDb, nowIso } from './db/database.js';
import { createApiResponseCache, createRequestObservability } from './services/operations.js';

type AppOptions={adminToken?:string|null;nodeEnv?:string;corsOrigins?:string[];mutationLimit?:number;cacheTtlMs?:number};
type CachedImage={body:Buffer;contentType:string;expiresAt:number};

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

  const imageCache=new Map<string,CachedImage>();
  const defaultImageHosts=['media.api-sports.io','images.kickoffapi.com','www.thesportsdb.com','r2.thesportsdb.com'];
  const imageHosts=new Set([...defaultImageHosts,...String(process.env.IMAGE_PROXY_HOSTS??'').split(',').map(value=>value.trim().toLowerCase()).filter(Boolean)]);
  const imageFallback=(res:Response)=>{res.type('image/svg+xml');res.setHeader('Cache-Control','public, max-age=300');return res.send('<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" rx="12" fill="#27272a"/><path d="M29 68l13-16 9 10 7-8 12 14H29zm12-28a7 7 0 1 1-14 0 7 7 0 0 1 14 0z" fill="#71717a"/></svg>');};
  app.get('/api/assets/image',async(req,res)=>{
    try{
      const target=new URL(String(req.query.url??''));
      if(target.protocol!=='https:'||!imageHosts.has(target.hostname.toLowerCase()))return imageFallback(res);
      const key=target.toString(),cached=imageCache.get(key);
      if(cached&&cached.expiresAt>Date.now()){res.setHeader('Content-Type',cached.contentType);res.setHeader('Cache-Control','public, max-age=86400, stale-if-error=604800');return res.send(cached.body);}
      const upstream=await fetch(key,{headers:{Accept:'image/avif,image/webp,image/*;q=0.8'},signal:AbortSignal.timeout(5_000),redirect:'follow'});
      const contentType=upstream.headers.get('content-type')??'';const length=Number(upstream.headers.get('content-length')??0);
      if(!upstream.ok||!contentType.startsWith('image/')||length>5_000_000)return imageFallback(res);
      const body=Buffer.from(await upstream.arrayBuffer());if(body.length>5_000_000)return imageFallback(res);
      imageCache.set(key,{body,contentType,expiresAt:Date.now()+86_400_000});
      res.setHeader('Content-Type',contentType);res.setHeader('Cache-Control','public, max-age=86400, stale-if-error=604800');res.setHeader('Vary','Accept');return res.send(body);
    }catch{
      // In ambienti locali o gestiti il processo Node può non avere accesso
      // HTTPS in uscita mentre il browser sì. L'URL è già stato validato
      // contro protocollo e allowlist: il redirect conserva quel confine e
      // lascia che il browser applichi il normale fallback su errore.
      const target=new URL(String(req.query.url??''));
      if(target.protocol==='https:'&&imageHosts.has(target.hostname.toLowerCase())){
        res.setHeader('Cache-Control','no-store');
        return res.redirect(307,target.toString());
      }
      return imageFallback(res);
    }
  });
  app.use('/api',(_req,res,next)=>{
    const sendJson=res.json.bind(res);
    res.json=((body:unknown)=>{
      const rewrite=(value:unknown,key=''):unknown=>{
        if(typeof value==='string'&&/^https:\/\//i.test(value)&&/(?:photo|image|logo)(?:_url)?$/i.test(key))return `/api/assets/image?url=${encodeURIComponent(value)}`;
        if(Array.isArray(value))return value.map(item=>rewrite(item));
        if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([name,item])=>[name,rewrite(item,name)]));
        return value;
      };
      return sendJson(rewrite(body));
    }) as Response['json'];
    next();
  });

  const responseCache=createApiResponseCache(options.cacheTtlMs??30_000);
  const observability=createRequestObservability();
  app.locals.responseCache=responseCache;
  app.locals.observability=observability;
  app.use('/api',observability.middleware);
  app.use('/api',(_req,res,next)=>{res.setHeader('X-API-Version','1.0.0');next();});
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
  if(nodeEnv==='production'){
    const dist=path.resolve('dist');
    if(fs.existsSync(dist)){
      app.use(express.static(dist,{index:false,maxAge:'1h'}));
      app.use((req,res,next)=>req.method==='GET'&&!req.path.startsWith('/api/')?res.sendFile(path.join(dist,'index.html')):next());
    }
  }
  app.use((error:unknown,_req:Request,res:Response,_next:NextFunction)=>res.status(400).json({error:error instanceof Error?error.message:'Richiesta non valida'}));
  return app;
}
