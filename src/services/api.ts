const CACHE_PREFIX='sassuolo-history-cache:';
const CACHE_VERSION=1;
type CachedPayload={version:number;savedAt:string;data:unknown};
export type AdminSession={authenticated:boolean;actor:string|null;csrfToken:string|null;expiresAt:string|null};
let adminCsrfToken:string|null=null;

const publishAdminSession=(session:AdminSession)=>{
  adminCsrfToken=session.csrfToken;
  if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('sassuolo-admin-session',{detail:session}));
  return session;
};

async function authRequest(path:string,init?:RequestInit){
  const res=await fetch(`/api/auth/${path}`,{...init,credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json',...(adminCsrfToken?{'X-CSRF-Token':adminCsrfToken}:{}),...(init?.headers||{})}});
  const body=await res.json().catch(()=>({}));
  if(!res.ok)throw new Error(body?.error||`HTTP ${res.status}`);
  return body;
}

export async function getAdminSession(){return publishAdminSession(await authRequest('session') as AdminSession);}
export async function loginAdmin(token:string,name:string){return publishAdminSession(await authRequest('login',{method:'POST',body:JSON.stringify({token,name})}) as AdminSession);}
export async function logoutAdmin(){await authRequest('logout',{method:'POST'});return publishAdminSession({authenticated:false,actor:null,csrfToken:null,expiresAt:null});}

const cacheKey=(path:string)=>`${CACHE_PREFIX}${encodeURIComponent(path)}`;
const readCached=<T>(path:string):T|null=>{
  if(typeof window==='undefined')return null;
  try{
    const cached=JSON.parse(localStorage.getItem(cacheKey(path))||'null') as CachedPayload|null;
    return cached?.version===CACHE_VERSION?cached.data as T:null;
  }catch{return null;}
};
const writeCached=(path:string,data:unknown)=>{
  if(typeof window==='undefined')return;
  const payload:CachedPayload={version:CACHE_VERSION,savedAt:new Date().toISOString(),data};
  try{
    localStorage.setItem(cacheKey(path),JSON.stringify(payload));
    window.dispatchEvent(new CustomEvent('sassuolo-cache-updated',{detail:{savedAt:payload.savedAt}}));
  }catch{
    const entries=Object.keys(localStorage).filter(key=>key.startsWith(CACHE_PREFIX)).sort();
    for(const key of entries.slice(0,Math.max(1,Math.ceil(entries.length/4))))localStorage.removeItem(key);
    try{localStorage.setItem(cacheKey(path),JSON.stringify(payload));}catch{/* La rete resta la fonte primaria. */}
  }
};

export async function api<T>(path:string, init?:RequestInit):Promise<T>{
  const method=String(init?.method??'GET').toUpperCase();
  const cacheable=method==='GET'&&!path.startsWith('/data-manager')&&!path.startsWith('/data-quality')&&!path.startsWith('/health')&&!path.startsWith('/player-identity-conflicts');
  try{
    const {headers:requestHeaders,...requestInit}=init??{};
    const res=await fetch(`/api${path}`,{...requestInit,credentials:'same-origin',cache:init?.cache??(method==='GET'?'default':'no-store'),headers:{'Content-Type':'application/json',...(!['GET','HEAD','OPTIONS'].includes(method)&&adminCsrfToken?{'X-CSRF-Token':adminCsrfToken}:{}),...(requestHeaders||{})}});
    if(!res.ok){
      const body=await res.text();
      let detail=body;
      try{detail=JSON.parse(body)?.error||body;}catch{/* response is not JSON */}
      if(res.status===401)publishAdminSession({authenticated:false,actor:null,csrfToken:null,expiresAt:null});
      throw new Error(detail||`HTTP ${res.status}`);
    }
    const data=await res.json() as T;
    if(cacheable)writeCached(path,data);
    return data;
  }catch(error){
    if(cacheable){const cached=readCached<T>(path);if(cached!==null)return cached;}
    throw error;
  }
}
export const post=<T>(path:string)=>api<T>(path,{method:'POST'});
