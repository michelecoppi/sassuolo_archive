import type { ProviderResult, SyncProvider } from './types.js';
const key = process.env.API_FOOTBALL_KEY ?? '';

async function request(path: string): Promise<ProviderResult<any>> {
  if (!key) return { ok:false, error:'API_FOOTBALL_KEY non configurata', requests:0 };
  try {
    const r = await fetch(`https://v3.football.api-sports.io${path}`, { headers: { 'x-apisports-key': key } });
    if (!r.ok) return { ok:false,error:`API-Football HTTP ${r.status}`,requests:1 };
    return { ok:true,data:await r.json(),requests:1 };
  } catch(e) { return {ok:false,error:String(e),requests:1}; }
}

export const apiFootballProvider: SyncProvider = {
  name:'api-football',
  isConfigured:()=>Boolean(key) && process.env.ENABLE_API_FOOTBALL !== 'false',
  async syncCurrentSquad() {
    const teamId=process.env.API_FOOTBALL_SASSUOLO_TEAM_ID;
    if(!teamId) return {ok:false,error:'API_FOOTBALL_SASSUOLO_TEAM_ID non configurato',requests:0};
    const r=await request(`/players/squads?team=${encodeURIComponent(teamId)}`);
    if(!r.ok) return r;
    return {ok:true,data:r.data.response?.[0]?.players ?? [],requests:r.requests};
  }
};
