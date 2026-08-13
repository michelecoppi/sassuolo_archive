import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import { api } from './routes/api.js';
import { db, initDb, nowIso } from './db/database.js';
import { createApiResponseCache, createRequestObservability } from './services/operations.js';
import { safeRemoteFetch } from './services/outboundUrlPolicy.js';

type AppOptions={adminToken?:string|null;nodeEnv?:string;corsOrigins?:string[];mutationLimit?:number;cacheTtlMs?:number;adminSessionTtlMs?:number};
type CachedImage={body:Buffer;contentType:string;expiresAt:number};
type AdminSession={actor:string;csrfToken:string;expiresAt:number};

const ADMIN_COOKIE='sassuolo_admin_session';

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
  const sessionTtlMs=options.adminSessionTtlMs??8*60*60*1000;
  const adminSessions=new Map<string,AdminSession>();
  const app=express();
  app.disable('x-powered-by');
  app.set('trust proxy',false);
  app.use((_req,res,next)=>{res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');res.setHeader('Content-Security-Policy',`default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'`);if(nodeEnv==='production')res.setHeader('Strict-Transport-Security','max-age=31536000; includeSubDomains');next();});
  app.use(cors({origin(origin,callback){if(!origin||allowedOrigins.has(origin))return callback(null,true);callback(new Error('Origine CORS non autorizzata'));},credentials:true,methods:['GET','HEAD','POST','PUT','PATCH','DELETE'],allowedHeaders:['Content-Type','X-CSRF-Token']}));
  app.use(express.json({limit:'2mb',strict:true}));

  const cookieValue=(req:Request)=>{
    const cookies=String(req.headers.cookie??'').split(';');
    for(const cookie of cookies){const [name,...parts]=cookie.trim().split('=');if(name===ADMIN_COOKIE)return decodeURIComponent(parts.join('='));}
    return null;
  };
  const activeSession=(req:Request)=>{
    const id=cookieValue(req);if(!id)return null;
    const session=adminSessions.get(id);if(!session)return null;
    if(session.expiresAt<=Date.now()){adminSessions.delete(id);return null;}
    return {id,session};
  };
  const sessionCookie=(id:string,maxAgeSeconds:number)=>`${ADMIN_COOKIE}=${encodeURIComponent(id)}; Path=/api; HttpOnly; SameSite=Strict; Max-Age=${maxAgeSeconds}${nodeEnv==='production'?'; Secure':''}`;
  const loginAttempts=new Map<string,{windowStart:number,count:number}>();
  app.post('/api/auth/login',(req,res)=>{
    if(!adminToken)return res.status(503).json({error:'Accesso amministrativo non configurato'});
    const key=req.ip||req.socket.remoteAddress||'unknown',now=Date.now(),previous=loginAttempts.get(key);
    const state=!previous||now-previous.windowStart>=15*60_000?{windowStart:now,count:1}:{...previous,count:previous.count+1};loginAttempts.set(key,state);
    if(state.count>10)return res.status(429).json({error:'Troppi tentativi di accesso: riprova più tardi'});
    const supplied=String(req.body?.token??'');
    if(!safeEqual(supplied,adminToken))return res.status(401).json({error:'Credenziali amministrative non valide'});
    const id=crypto.randomBytes(32).toString('base64url'),csrfToken=crypto.randomBytes(32).toString('base64url');
    const actor=String(req.body?.name??'Curatore').trim().slice(0,120)||'Curatore';
    const expiresAt=now+sessionTtlMs;adminSessions.set(id,{actor,csrfToken,expiresAt});loginAttempts.delete(key);
    res.setHeader('Set-Cookie',sessionCookie(id,Math.ceil(sessionTtlMs/1000)));
    res.setHeader('Cache-Control','no-store');return res.json({authenticated:true,actor,csrfToken,expiresAt:new Date(expiresAt).toISOString()});
  });
  app.get('/api/auth/session',(req,res)=>{
    res.setHeader('Cache-Control','no-store');
    if(!adminToken)return res.json({authenticated:nodeEnv!=='production',actor:nodeEnv!=='production'?'local-development':null,csrfToken:null,expiresAt:null});
    const current=activeSession(req);if(!current)return res.json({authenticated:false,actor:null,csrfToken:null,expiresAt:null});
    return res.json({authenticated:true,actor:current.session.actor,csrfToken:current.session.csrfToken,expiresAt:new Date(current.session.expiresAt).toISOString()});
  });
  app.post('/api/auth/logout',(req,res)=>{
    if(!adminToken){res.setHeader('Set-Cookie',sessionCookie('',0));return res.json({ok:true});}
    const current=activeSession(req);if(!current)return res.status(401).json({error:'Sessione amministrativa assente o scaduta'});
    if(!safeEqual(String(req.headers['x-csrf-token']??''),current.session.csrfToken))return res.status(403).json({error:'Token CSRF non valido'});
    adminSessions.delete(current.id);res.setHeader('Set-Cookie',sessionCookie('',0));res.setHeader('Cache-Control','no-store');return res.json({ok:true});
  });

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
      const upstream=await safeRemoteFetch(target,imageHosts);
      const contentType=upstream.headers.get('content-type')??'';const length=Number(upstream.headers.get('content-length')??0);
      if(!upstream.ok||!contentType.startsWith('image/')||length>5_000_000)return imageFallback(res);
      const body=Buffer.from(await upstream.arrayBuffer());if(body.length>5_000_000)return imageFallback(res);
      imageCache.set(key,{body,contentType,expiresAt:Date.now()+86_400_000});
      res.setHeader('Content-Type',contentType);res.setHeader('Cache-Control','public, max-age=86400, stale-if-error=604800');res.setHeader('Vary','Accept');return res.send(body);
    }catch{return imageFallback(res);}
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

  const attempts=new Map<string,{windowStart:number,count:number}>();const limit=options.mutationLimit??60;
  app.use('/api',(req:Request,res:Response,next:NextFunction)=>{
    const protectedRead=req.method==='GET'&&(['/corrections','/data-manager','/data-quality','/sync/jobs','/telemetry/frontend/summary','/health/details'].includes(req.path)||req.path.startsWith('/player-identity-conflicts/')||req.path.startsWith('/data/candidates/')||req.path.startsWith('/data/provenance/'));
    if(protectedRead)res.setHeader('Cache-Control','no-store');
    if(['GET','HEAD','OPTIONS'].includes(req.method)&&!protectedRead)return next();
    const now=Date.now();const key=req.ip||req.socket.remoteAddress||'unknown';const state=attempts.get(key);
    const rateState=!state||now-state.windowStart>=60_000?{windowStart:now,count:1}:{...state,count:state.count+1};attempts.set(key,rateState);
    const publicCorrection=req.method==='POST'&&req.path==='/corrections';
    const publicTelemetry=req.method==='POST'&&req.path==='/telemetry/frontend';
    const currentSession=activeSession(req);
    const actor=String(currentSession?.session.actor??(publicCorrection?'public-reporter':publicTelemetry?'frontend-telemetry':adminToken?'anonymous':'local-development')).slice(0,120);
    res.locals.adminActor=actor;
    if(!publicTelemetry)res.on('finish',()=>{try{db.prepare(`INSERT INTO security_audit_log(method,path,actor,role,ip,status_code,created_at) VALUES(?,?,?,?,?,?,?)`).run(req.method,req.path,actor,res.statusCode===401?'anonymous':publicCorrection?'reporter':'admin',key,res.statusCode,nowIso());}catch{/* il log non deve interrompere la risposta già conclusa */}});
    res.setHeader('X-RateLimit-Limit',String(limit));res.setHeader('X-RateLimit-Remaining',String(Math.max(0,limit-rateState.count)));
    if(rateState.count>limit)return res.status(429).json({error:'Troppe operazioni di scrittura: riprova tra un minuto'});
    if(adminToken&&!publicCorrection&&!publicTelemetry){
      if(!currentSession)return res.status(401).json({error:'Sessione amministrativa richiesta o scaduta'});
      if(!['GET','HEAD','OPTIONS'].includes(req.method)&&!safeEqual(String(req.headers['x-csrf-token']??''),currentSession.session.csrfToken))return res.status(403).json({error:'Token CSRF non valido'});
    }
    next();
  });
  app.use('/api',responseCache.middleware);
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
