import type { ProviderResult, SyncProvider } from './types.js';

const key = process.env.FOOTBALL_DATA_API_KEY ?? '';

async function getJson(url: string): Promise<ProviderResult<any>> {
  if (!key) return { ok: false, error: 'FOOTBALL_DATA_API_KEY non configurata', requests: 0 };
  try {
    const r = await fetch(url, { headers: { 'X-Auth-Token': key } });
    if (!r.ok) return { ok: false, error: `football-data.org HTTP ${r.status}`, requests: 1 };
    return { ok: true, data: await r.json(), requests: 1 };
  } catch (e) { return { ok: false, error: String(e), requests: 1 }; }
}

export const footballDataProvider: SyncProvider = {
  name: 'football-data.org',
  isConfigured: () => Boolean(key) && process.env.ENABLE_FOOTBALL_DATA !== 'false',
  async syncStandings() {
    const r = await getJson('https://api.football-data.org/v4/competitions/SA/standings');
    if (!r.ok) return r;
    return { ok: true, data: r.data.standings ?? [], requests: r.requests };
  },
  async syncCurrentMatches() {
    const r = await getJson('https://api.football-data.org/v4/competitions/SA/matches?status=SCHEDULED,FINISHED,IN_PLAY,PAUSED');
    if (!r.ok) return r;
    const matches = (r.data.matches ?? []).filter((m:any) => /sassuolo/i.test(`${m.homeTeam?.name} ${m.awayTeam?.name}`));
    return { ok: true, data: matches, requests: r.requests };
  }
};
