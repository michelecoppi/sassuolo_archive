import type { ProviderResult, SyncProvider } from './types.js';

async function get(path:string): Promise<ProviderResult<any>> {
  try {
    const r=await fetch(`https://www.thesportsdb.com/api/v1/json/3${path}`);
    if(!r.ok) return {ok:false,error:`TheSportsDB HTTP ${r.status}`,requests:1};
    return {ok:true,data:await r.json(),requests:1};
  }catch(e){return {ok:false,error:String(e),requests:1};}
}

export const theSportsDbProvider: SyncProvider = {
  name:'thesportsdb',
  isConfigured:()=>process.env.ENABLE_THESPORTSDB !== 'false',
  async syncCurrentSquad(){
    const r=await get('/searchplayers.php?t=Sassuolo');
    if(!r.ok) return r;
    return {ok:true,data:r.data.player ?? [],requests:r.requests};
  }
};
