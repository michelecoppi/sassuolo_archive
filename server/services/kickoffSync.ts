import { db, getSetting, normalizePlayerPosition, normalizeSearchText, normalizeTeamName, nowIso, recordFixtureConflicts, setSetting } from '../db/database.js';

const API_BASE = 'https://api.kickoffapi.com';
const PROVIDER = 'kickoff';
const nInt = (v: any) => v == null || v === '' || Number.isNaN(Number(v)) ? null : Math.trunc(Number(v));
const nNum = (v: any) => v == null || v === '' || Number.isNaN(Number(v)) ? null : Number(v);
const text = (v: any) => v == null ? null : String(v).trim() || null;
const boolInt = (v: any) => v == null ? null : v ? 1 : 0;
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export type KickoffMeta = {
  requests: number;
  remaining: number | null;
  limit: number | null;
  reset: number | null;
  requestId: string | null;
};

type ApiResult<T = any> = {
  ok: boolean;
  data?: T;
  raw: any;
  error?: string;
  status: number;
  meta: KickoffMeta;
};

let lastRemaining: number | null = null;
let lastRequestAt = 0;

function enabled() { return process.env.ENABLE_KICKOFF_API !== 'false'; }
function apiKey() { return process.env.KICKOFF_API_KEY?.trim() ?? ''; }
function emptyMeta(): KickoffMeta { return { requests: 0, remaining: null, limit: null, reset: null, requestId: null }; }
function explicitRunBudget() { const n = nInt(process.env.KICKOFF_MAX_REQUESTS_PER_RUN); return n && n > 0 ? n : 80; }
function smartRunBudget() { const n = nInt(process.env.KICKOFF_SMART_UPDATE_MAX_REQUESTS); return n && n > 0 ? n : 20; }
function quotaSafety() { const n = nInt(process.env.KICKOFF_QUOTA_SAFETY); return n != null && n >= 0 ? n : 5; }

async function throttle() {
  // The exact minute limit is plan-dependent. 250ms is conservative without
  // making historical imports unnecessarily slow.
  const wait = 250 - (Date.now() - lastRequestAt);
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();
}

function recordUsage(resource: string, meta: KickoffMeta, error?: string) {
  const now = nowIso();
  db.prepare(`INSERT INTO sync_state(provider,resource,requests_used,estimated_remaining,last_request,last_successful_sync,last_error)
    VALUES(?,?,?,?,?,?,?)
    ON CONFLICT(provider,resource) DO UPDATE SET
      requests_used=sync_state.requests_used+excluded.requests_used,
      estimated_remaining=COALESCE(excluded.estimated_remaining,sync_state.estimated_remaining),
      last_request=excluded.last_request,
      last_successful_sync=CASE WHEN excluded.last_error IS NULL THEN excluded.last_successful_sync ELSE sync_state.last_successful_sync END,
      last_error=excluded.last_error`)
    .run(PROVIDER, resource, meta.requests, meta.remaining, now, error ? null : now, error ?? null);
}

async function request<T = any>(resource: string, endpoint: string, params: Record<string, string | number | boolean | undefined | null> = {}, retry = true): Promise<ApiResult<T>> {
  if (!enabled()) return { ok: false, error: 'KickoffAPI disabilitata (ENABLE_KICKOFF_API=false)', status: 0, raw: null, meta: emptyMeta() };
  const key = apiKey();
  if (!key) return { ok: false, error: 'KICKOFF_API_KEY non configurata', status: 0, raw: null, meta: emptyMeta() };
  const url = new URL(`${API_BASE}${endpoint}`);
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  try {
    await throttle();
    const response = await fetch(url, { headers: { 'x-api-key': key, Accept: 'application/json' } });
    const meta: KickoffMeta = {
      requests: 1,
      remaining: nInt(response.headers.get('x-ratelimit-remaining')),
      limit: nInt(response.headers.get('x-ratelimit-limit')),
      reset: nInt(response.headers.get('x-ratelimit-reset')),
      requestId: response.headers.get('x-request-id')
    };
    if (meta.remaining != null) lastRemaining = meta.remaining;
    let body: any = null;
    try { body = await response.json(); } catch {}
    if (!response.ok) {
      const message = text(body?.error?.message ?? body?.error ?? body?.message) ?? `HTTP ${response.status}`;
      if (retry && response.status >= 500) {
        await sleep(900);
        return request<T>(resource, endpoint, params, false);
      }
      recordUsage(resource, meta, message);
      return { ok: false, error: message, status: response.status, raw: body, meta };
    }
    recordUsage(resource, meta);
    return { ok: true, data: body as T, status: response.status, raw: body, meta };
  } catch (e) {
    const meta = { ...emptyMeta(), requests: 1 };
    const message = e instanceof TypeError && String(e).toLowerCase().includes('fetch failed')
      ? 'KickoffAPI non raggiungibile: controlla connessione Internet/DNS e firewall.'
      : String(e);
    recordUsage(resource, meta, message);
    return { ok: false, error: message, status: 0, raw: null, meta };
  }
}

function responseRows(body: any): any[] {
  if (Array.isArray(body?.response)) return body.response;
  if (Array.isArray(body?.data)) return body.data;
  if (Array.isArray(body)) return body;
  return [];
}

async function fixtureResource(resource: 'events' | 'lineups' | 'statistics' | 'players', fixtureId: number) {
  // This query-parameter form is the one verified against the current v1
  // deployment. A path-style fallback is kept for compatibility with the docs.
  const first = await request<any>(`fixture-${resource}`, `/api/v1/fixtures/${resource}`, { fixture: fixtureId });
  if (first.ok || ![404, 405].includes(first.status)) return first;
  return request<any>(`fixture-${resource}`, `/api/v1/fixtures/${fixtureId}/${resource}`);
}

function seasonYear(season: string) {
  const y = Number(season.slice(0, 4));
  return Number.isFinite(y) ? y : null;
}

function toSeasonLabel(year: number) { return `${year}/${String((year + 1) % 100).padStart(2, '0')}`; }

function isQuotaLow() { return lastRemaining != null && lastRemaining <= quotaSafety(); }

function getCachedSassuoloId() {
  const envId = nInt(process.env.KICKOFF_SASSUOLO_TEAM_ID);
  if (envId) return envId;
  const fromTeam = (db.prepare(`SELECT api_football_id FROM teams WHERE canonical_name='U.S. Sassuolo Calcio'`).get() as any)?.api_football_id;
  if (nInt(fromTeam)) return nInt(fromTeam);
  return nInt(getSetting('kickoff_sassuolo_team_id'));
}

export async function ensureKickoffSassuoloId() {
  const cached = getCachedSassuoloId();
  if (cached) return { ok: true as const, teamId: cached, requests: 0 };
  const r = await request<any>('teams', '/api/v1/teams', { search: 'Sassuolo' });
  if (!r.ok) return { ok: false as const, error: r.error ?? 'Sassuolo non trovato', requests: r.meta.requests };
  const rows = responseRows(r.raw);
  const chosen = rows.find(x => /sassuolo/i.test(String(x?.name ?? x?.team?.name ?? '')) && !/\bw\b|women/i.test(String(x?.name ?? x?.team?.name ?? '')))
    ?? rows.find(x => /sassuolo/i.test(String(x?.name ?? x?.team?.name ?? '')));
  const teamId = nInt(chosen?.id ?? chosen?.team?.id);
  if (!teamId) return { ok: false as const, error: 'Sassuolo non trovato da KickoffAPI v1', requests: r.meta.requests };
  setSetting('kickoff_sassuolo_team_id', String(teamId));
  db.prepare(`UPDATE teams SET api_football_id=COALESCE(api_football_id,?) WHERE canonical_name='U.S. Sassuolo Calcio'`).run(teamId);
  return { ok: true as const, teamId, requests: r.meta.requests };
}

export async function resolveKickoffLeague(season: string, competition: string) {
  const year = seasonYear(season);
  if (!year) return { ok: false as const, error: `Formato stagione non valido: ${season}`, requests: 0 };
  const seasonRow = db.prepare(`SELECT api_football_league_id FROM seasons WHERE season=? AND competition=?`).get(season, competition) as any;
  const envSerieA = nInt(process.env.KICKOFF_SERIE_A_LEAGUE_ID);
  if (/^serie a$/i.test(competition) && envSerieA) return { ok: true as const, leagueId: envSerieA, year, requests: 0 };
  if (nInt(seasonRow?.api_football_league_id)) return { ok: true as const, leagueId: nInt(seasonRow.api_football_league_id)!, year, requests: 0 };
  const cacheKey = `kickoff_league_${competition.toLowerCase().replace(/\W+/g, '_')}`;
  const cached = nInt(getSetting(cacheKey));
  if (cached) return { ok: true as const, leagueId: cached, year, requests: 0 };
  const r = await request<any>('leagues', '/api/v1/leagues', { country: 'Italy' });
  if (!r.ok) return { ok: false as const, error: r.error ?? 'Errore leagues', requests: r.meta.requests };
  const rows = responseRows(r.raw);
  const chosen = rows.find(x => String(x?.name ?? x?.league?.name ?? '').trim().toLowerCase() === competition.trim().toLowerCase());
  const leagueId = nInt(chosen?.id ?? chosen?.league?.id);
  if (!leagueId) return { ok: false as const, error: `KickoffAPI: ${competition} non trovata per ${season}`, requests: r.meta.requests };
  setSetting(cacheKey, String(leagueId));
  db.prepare(`UPDATE seasons SET api_football_league_id=COALESCE(api_football_league_id,?) WHERE season=? AND competition=?`).run(leagueId, season, competition);
  return { ok: true as const, leagueId, year, requests: r.meta.requests };
}

function getFixtureTeams(f: any) {
  const home = f?.homeTeam ?? f?.teams?.home ?? f?.home ?? {};
  const away = f?.awayTeam ?? f?.teams?.away ?? f?.away ?? {};
  const homeName = text(home?.name ?? f?.homeTeamName) ?? 'Home';
  const awayName = text(away?.name ?? f?.awayTeamName) ?? 'Away';
  return {
    home,
    away,
    homeId: nInt(f?.homeTeamId ?? home?.id),
    awayId: nInt(f?.awayTeamId ?? away?.id),
    homeName: normalizeTeamName(homeName),
    awayName: normalizeTeamName(awayName),
    homeLogo: text(home?.logo),
    awayLogo: text(away?.logo)
  };
}

function score(f: any, side: 'home' | 'away') {
  if (side === 'home') return nInt(f?.goalsHome ?? f?.goals?.home ?? f?.score?.home);
  return nInt(f?.goalsAway ?? f?.goals?.away ?? f?.score?.away);
}

function sameTeamName(left: string, right: string) {
  if (left === right) return true;
  // Providers differ on harmless legal/club suffixes (e.g. AS Cittadella vs
  // Cittadella). This remains deliberately conservative: only exact cleaned
  // names match, never a fuzzy substring comparison.
  const clean = (name: string) => normalizeTeamName(name).toLowerCase()
    .replace(/^(?:a\.?s\.?|u\.?s\.?|a\.?c\.?|f\.?c\.?|s\.?s\.?c\.?)\s+/,'')
    .replace(/\s+(?:calcio|fc|cfc)$/,'')
    .replace(/[^a-z0-9]+/g,'')
    .trim();
  return clean(left) === clean(right);
}

function matchingLocalMatch(date: string, homeName: string, awayName: string) {
  const candidates = db.prepare(`SELECT * FROM matches WHERE substr(date,1,10)=?`).all(date.slice(0, 10)) as any[];
  return candidates.find(x => sameTeamName(String(x.home_team), homeName) && sameTeamName(String(x.away_team), awayName)) ?? null;
}

// Local imports can contain a result before the provider fixture id. Resolve it
// lazily so a user can enrich one match directly from its detail page.
async function linkKickoffFixtureForMatch(match: any, sassuoloId: number) {
  const season = text(match?.season);
  const competition = text(match?.competition);
  if (!season || !competition) return { ok: false as const, requests: 0, error: 'Mancano stagione o competizione: impossibile cercare automaticamente la partita.' };
  const league = await resolveKickoffLeague(season, competition);
  if (!league.ok) return { ok: false as const, requests: league.requests, error: league.error };
  const list = await request<any>('fixtures', '/api/v1/fixtures', { league: league.leagueId, season: league.year, team: sassuoloId });
  const requests = league.requests + list.meta.requests;
  if (!list.ok) return { ok: false as const, requests, error: list.error ?? 'Fixture non disponibili' };
  const matchDate = String(match.date ?? '').slice(0, 10);
  const home = String(match.home_team ?? '');
  const away = String(match.away_team ?? '');
  const fixture = responseRows(list.raw).find(f => {
    const teams = getFixtureTeams(f);
    return String(f?.date ?? f?.fixture?.date ?? '').slice(0, 10) === matchDate && sameTeamName(teams.homeName, home) && sameTeamName(teams.awayName, away);
  });
  if (!fixture) return { ok: false as const, requests, error: 'KickoffAPI non ha restituito una fixture corrispondente per data e squadre.' };
  const localId = upsertFixture(fixture, season, competition);
  const fixtureId = nInt(fixture?.id ?? fixture?.fixture?.id);
  if (!localId || !fixtureId) return { ok: false as const, requests, error: 'La fixture trovata non contiene un ID utilizzabile.' };
  return { ok: true as const, requests, matchId: localId, fixtureId };
}

function upsertFixture(f: any, season: string, competition: string) {
  const fixtureId = nInt(f?.id ?? f?.fixture?.id);
  const date = text(f?.date ?? f?.fixture?.date);
  if (!fixtureId || !date) return null;
  const t = getFixtureTeams(f);
  if (!/sassuolo/i.test(`${t.homeName} ${t.awayName}`)) return null;
  const halftimeHome = nInt(f?.scoreHalfHome ?? f?.score?.halftime?.home);
  const halftimeAway = nInt(f?.scoreHalfAway ?? f?.score?.halftime?.away);
  const halftime = halftimeHome != null && halftimeAway != null ? `${halftimeHome}-${halftimeAway}` : null;
  let existing = db.prepare(`SELECT * FROM matches WHERE kickoff_fixture_id=?`).get(fixtureId) as any;
  if (!existing) existing = matchingLocalMatch(date, t.homeName, t.awayName);
  const round = text(f?.round ?? f?.leagueRound ?? f?.league?.round);
  const referee = text(f?.referee?.name ?? f?.referee);
  if (existing) {
    recordFixtureConflicts(existing, { date, home_score: score(f, 'home'), away_score: score(f, 'away') }, PROVIDER);
    if (existing.source_provider === 'manual') {
      persistFixtureHeader(Number(existing.id), f, t);
      return Number(existing.id);
    }
    db.prepare(`UPDATE matches SET kickoff_fixture_id=?,external_key=CASE WHEN source_provider='manual' THEN external_key ELSE ? END,date=?,season=COALESCE(season,?),competition=COALESCE(competition,?),round=COALESCE(?,round),home_team=?,away_team=?,home_score=COALESCE(?,home_score),away_score=COALESCE(?,away_score),halftime_score=COALESCE(?,halftime_score),stadium=COALESCE(?,stadium),attendance=COALESCE(?,attendance),referee=COALESCE(?,referee),source_provider=CASE WHEN source_provider='manual' THEN source_provider ELSE ? END,source_external_id=CASE WHEN source_provider='manual' THEN source_external_id ELSE ? END,last_verified_at=? WHERE id=?`)
      .run(fixtureId, `kickoff:${fixtureId}`, date, season, competition, round, t.homeName, t.awayName, score(f, 'home'), score(f, 'away'), halftime, text(f?.venue?.name), nInt(f?.attendance), referee, PROVIDER, String(fixtureId), nowIso(), existing.id);
    persistFixtureHeader(Number(existing.id), f, t);
    return Number(existing.id);
  }
  const r = db.prepare(`INSERT INTO matches(external_key,kickoff_fixture_id,date,season,competition,round,home_team,away_team,home_score,away_score,halftime_score,stadium,attendance,referee,source_provider,source_external_id,last_verified_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(`kickoff:${fixtureId}`, fixtureId, date, season, competition, round, t.homeName, t.awayName, score(f, 'home'), score(f, 'away'), halftime, text(f?.venue?.name), nInt(f?.attendance), referee, PROVIDER, String(fixtureId), nowIso());
  const id = Number(r.lastInsertRowid);
  persistFixtureHeader(id, f, t);
  return id;
}

function persistFixtureHeader(matchId: number, f: any, t = getFixtureTeams(f)) {
  const fixtureId = nInt(f?.id ?? f?.fixture?.id)!;
  db.prepare(`INSERT INTO match_details(match_id,source_provider,provider_match_id,api_fixture_id,timezone,kickoff_timestamp,status_long,status_short,elapsed,league_name,league_country,league_round,home_team_provider_id,home_team_name,home_team_logo,away_team_provider_id,away_team_name,away_team_logo,goals_home,goals_away,halftime_home,halftime_away,fulltime_home,fulltime_away,extratime_home,extratime_away,penalty_home,penalty_away,deep_stats_synced,raw_json,last_verified_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(match_id) DO UPDATE SET source_provider=excluded.source_provider,provider_match_id=excluded.provider_match_id,api_fixture_id=excluded.api_fixture_id,timezone=COALESCE(excluded.timezone,match_details.timezone),kickoff_timestamp=COALESCE(excluded.kickoff_timestamp,match_details.kickoff_timestamp),status_long=COALESCE(excluded.status_long,match_details.status_long),status_short=COALESCE(excluded.status_short,match_details.status_short),elapsed=COALESCE(excluded.elapsed,match_details.elapsed),league_name=COALESCE(excluded.league_name,match_details.league_name),league_country=COALESCE(excluded.league_country,match_details.league_country),league_round=COALESCE(excluded.league_round,match_details.league_round),home_team_provider_id=COALESCE(excluded.home_team_provider_id,match_details.home_team_provider_id),home_team_name=COALESCE(excluded.home_team_name,match_details.home_team_name),home_team_logo=COALESCE(excluded.home_team_logo,match_details.home_team_logo),away_team_provider_id=COALESCE(excluded.away_team_provider_id,match_details.away_team_provider_id),away_team_name=COALESCE(excluded.away_team_name,match_details.away_team_name),away_team_logo=COALESCE(excluded.away_team_logo,match_details.away_team_logo),goals_home=COALESCE(excluded.goals_home,match_details.goals_home),goals_away=COALESCE(excluded.goals_away,match_details.goals_away),halftime_home=COALESCE(excluded.halftime_home,match_details.halftime_home),halftime_away=COALESCE(excluded.halftime_away,match_details.halftime_away),fulltime_home=COALESCE(excluded.fulltime_home,match_details.fulltime_home),fulltime_away=COALESCE(excluded.fulltime_away,match_details.fulltime_away),extratime_home=COALESCE(excluded.extratime_home,match_details.extratime_home),extratime_away=COALESCE(excluded.extratime_away,match_details.extratime_away),penalty_home=COALESCE(excluded.penalty_home,match_details.penalty_home),penalty_away=COALESCE(excluded.penalty_away,match_details.penalty_away),deep_stats_synced=COALESCE(excluded.deep_stats_synced,match_details.deep_stats_synced),raw_json=excluded.raw_json,last_verified_at=excluded.last_verified_at`)
    .run(matchId, PROVIDER, String(fixtureId), fixtureId, text(f?.timezone), nInt(f?.timestamp), text(f?.statusLong ?? f?.status?.long), text(f?.statusShort ?? f?.status?.short), nInt(f?.elapsed ?? f?.status?.elapsed), text(f?.league?.name), text(f?.league?.country), text(f?.round ?? f?.leagueRound ?? f?.league?.round), t.homeId == null ? null : String(t.homeId), t.homeName, t.homeLogo, t.awayId == null ? null : String(t.awayId), t.awayName, t.awayLogo, score(f, 'home'), score(f, 'away'), nInt(f?.scoreHalfHome ?? f?.score?.halftime?.home), nInt(f?.scoreHalfAway ?? f?.score?.halftime?.away), nInt(f?.scoreFullHome ?? f?.score?.fulltime?.home), nInt(f?.scoreFullAway ?? f?.score?.fulltime?.away), nInt(f?.scoreExtraHome ?? f?.score?.extratime?.home), nInt(f?.scoreExtraAway ?? f?.score?.extratime?.away), nInt(f?.scorePenaltyHome ?? f?.score?.penalty?.home), nInt(f?.scorePenaltyAway ?? f?.score?.penalty?.away), boolInt(f?.deepStatsSynced), JSON.stringify(f), nowIso());
}

function localPlayerByApiId(apiId: any) {
  const id = nInt(apiId);
  if (!id) return null;
  return (db.prepare(`SELECT id FROM players WHERE api_football_id=?`).get(id) as any)?.id ?? null;
}

function normalizePlayerName(value: any) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function playerNameParts(value: any) {
  const normalized = normalizeSearchText(value);
  const parts = normalized.split(' ').filter(Boolean);
  if (!parts.length) return null;
  return {
    normalized,
    firstInitial: parts[0]?.[0] ?? '',
    surname: parts[parts.length - 1] ?? '',
  };
}

/**
 * Finds an existing local player without making unsafe fuzzy matches.
 * Priority:
 *  1. exact name (case-insensitive)
 *  2. normalized exact name (accents/punctuation ignored)
 *  3. unique surname + first initial match (e.g. "D. Berardi" -> "Domenico Berardi")
 */
function localPlayerBySafeName(name: string) {
  const exact = db.prepare(`SELECT id FROM players WHERE lower(name)=lower(?) LIMIT 1`).get(name) as any;
  if (exact?.id) return Number(exact.id);

  const wanted = playerNameParts(name);
  if (!wanted) return null;

  const rows = db.prepare(`SELECT id,name FROM players`).all() as any[];
  const normalizedExact = rows.filter(row => normalizePlayerName(row?.name) === wanted.normalized);
  if (normalizedExact.length === 1) return Number(normalizedExact[0].id);

  if (!wanted.surname || !wanted.firstInitial) return null;
  const conservative = rows.filter(row => {
    const candidate = playerNameParts(row?.name);
    return candidate?.surname === wanted.surname && candidate?.firstInitial === wanted.firstInitial;
  });
  return conservative.length === 1 ? Number(conservative[0].id) : null;
}

function localSassuoloPlayer(apiId: any, player: any, teamId: number | null, sassuoloId: number) {
  if (teamId !== sassuoloId) return null;
  const external = nInt(apiId ?? player?.id);
  if (!external) return null;

  // The API-Football/Kickoff numeric player ID is the strongest identity key.
  const byApiId = localPlayerByApiId(external);
  if (byApiId) {
    // IMPORTANT: never rename an existing canonical player from match payloads.
    // Kickoff often returns abbreviated names ("D. Berardi") and players.name is UNIQUE.
    db.prepare(`UPDATE players
      SET photo_url=COALESCE(?,photo_url),
          position=COALESCE(?,position),
          shirt_number=COALESCE(?,shirt_number),
          source_external_id=COALESCE(source_external_id,?),
          last_verified_at=?
      WHERE id=?`)
      .run(text(player?.photo), normalizePlayerPosition(player?.position ?? player?.pos), nInt(player?.number), String(external), nowIso(), byApiId);
    return Number(byApiId);
  }

  const name = text(player?.name) ?? `Player ${external}`;
  const byName = localPlayerBySafeName(name);
  if (byName) {
    const existing = db.prepare(`SELECT api_football_id FROM players WHERE id=?`).get(byName) as any;
    // Do not steal a row already linked to another API player.
    if (existing?.api_football_id == null || Number(existing.api_football_id) === external) {
      db.prepare(`UPDATE players
        SET api_football_id=COALESCE(api_football_id,?),
            photo_url=COALESCE(?,photo_url),
            position=COALESCE(?,position),
            shirt_number=COALESCE(?,shirt_number),
            source_external_id=COALESCE(source_external_id,?),
            last_verified_at=?
        WHERE id=?`)
        .run(external, text(player?.photo), normalizePlayerPosition(player?.position ?? player?.pos), nInt(player?.number), String(external), nowIso(), byName);
      return Number(byName);
    }
  }

  // Last resort. INSERT OR IGNORE protects the UNIQUE(name) constraint even if
  // another sync inserted the same player between the lookup and this statement.
  const r = db.prepare(`INSERT OR IGNORE INTO players(api_football_id,name,photo_url,position,shirt_number,current_squad,source_provider,source_external_id,last_verified_at)
    VALUES(?,?,?,?,?,0,?,?,?)`)
    .run(external, name, text(player?.photo), normalizePlayerPosition(player?.position ?? player?.pos), nInt(player?.number), PROVIDER, String(external), nowIso());
  if (Number(r.changes) > 0) return Number(r.lastInsertRowid);

  // If INSERT was ignored, re-resolve by the two safe keys instead of throwing.
  return localPlayerByApiId(external) ?? localPlayerBySafeName(name);
}

function setDetailFlag(matchId: number, column: string) {
  const allowed = new Set(['events_synced','lineups_synced','team_stats_synced','player_stats_synced','injuries_synced','venue_synced','coaches_synced']);
  if (!allowed.has(column)) return;
  db.prepare(`UPDATE match_details SET ${column}=1,last_verified_at=? WHERE match_id=?`).run(nowIso(), Math.trunc(matchId));
}

async function cachedLookup(kind: 'coach' | 'venue', id: number) {
  const key = `kickoff_${kind}_${id}`;
  const cached = getSetting(key);
  if (cached) { try { return { data: JSON.parse(cached), requests: 0 }; } catch {} }
  if (isQuotaLow()) return { data: null, requests: 0 };
  const endpoint = kind === 'coach' ? '/api/v1/coaches' : '/api/v1/venues';
  const r = await request<any>(kind, endpoint, { id });
  if (!r.ok) return { data: null, requests: r.meta.requests };
  const row = responseRows(r.raw)[0] ?? null;
  if (row) setSetting(key, JSON.stringify(row));
  return { data: row, requests: r.meta.requests };
}

function eventScore(events: any[], homeId: number | null, awayId: number | null) {
  let h = 0, a = 0;
  const map = new Map<any, { home: number; away: number }>();
  const sorted = [...events].sort((x, y) => (nInt(x?.time) ?? 0) - (nInt(y?.time) ?? 0) || (nInt(x?.id) ?? 0) - (nInt(y?.id) ?? 0));
  for (const e of sorted) {
    const type = String(e?.type ?? '').toLowerCase();
    const detail = String(e?.detail ?? '').toLowerCase();
    if (type.includes('goal') && !detail.includes('missed')) {
      const tid = nInt(e?.teamId);
      if (tid === homeId) h++; else if (tid === awayId) a++;
    }
    map.set(e, { home: h, away: a });
  }
  return map;
}

async function saveEvents(matchId: number, fixtureId: number, body: any, homeId: number | null, awayId: number | null, sassuoloId: number) {
  const rows = responseRows(body);
  const scoreMap = eventScore(rows, homeId, awayId);
  // Manual event corrections are evidence-backed curation. Keep them on a
  // refresh and use their provider event id to avoid reintroducing a second,
  // uncorrected copy from the provider response.
  db.prepare(`DELETE FROM match_events WHERE match_id=? AND source_provider<>'manual'`).run(matchId);
  const manualEvent = db.prepare(`SELECT id FROM match_events WHERE match_id=? AND source_provider='manual' AND provider_event_id=? LIMIT 1`);
  const stmt = db.prepare(`INSERT INTO match_events(match_id,source_provider,provider_match_id,provider_event_id,api_fixture_id,minute,extra_minute,sequence_number,team_provider_id,team_api_id,team_name,team_logo,player_provider_id,player_api_id,player_id,player_name,assist_player_provider_id,assist_player_api_id,assist_player_id,assist_name,type,detail,comments,scoring_play,home_score,away_score) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  let i = 0;
  for (const e of rows) {
    const teamId = nInt(e?.teamId ?? e?.team?.id);
    const playerId = nInt(e?.playerId ?? e?.player?.id);
    const assistId = nInt(e?.assistId ?? e?.assist?.id);
    const localPlayer = localSassuoloPlayer(playerId, { id: playerId, name: e?.playerName ?? e?.player?.name }, teamId, sassuoloId);
    const localAssist = localSassuoloPlayer(assistId, { id: assistId, name: e?.assistName ?? e?.assist?.name }, teamId, sassuoloId);
    const sc = scoreMap.get(e) ?? { home: null, away: null };
    const type = text(e?.type);
    const detail = text(e?.detail);
    const providerEventId = text(e?.id);
    if (providerEventId && manualEvent.get(matchId, providerEventId)) continue;
    stmt.run(matchId, PROVIDER, String(fixtureId), providerEventId, fixtureId, nInt(e?.time ?? e?.minute), nInt(e?.extra ?? e?.extraTime), i++, teamId == null ? null : String(teamId), teamId, text(e?.team?.name), text(e?.team?.logo), playerId == null ? null : String(playerId), playerId, localPlayer, text(e?.playerName ?? e?.player?.name), assistId == null ? null : String(assistId), assistId, localAssist, text(e?.assistName ?? e?.assist?.name), type, detail, text(e?.comments), /goal/i.test(String(type)) && !/miss/i.test(String(detail)) ? 1 : 0, sc.home, sc.away);
  }
  const scorerNames = rows.filter(e => /goal/i.test(String(e?.type ?? '')) && !/miss/i.test(String(e?.detail ?? ''))).map(e => `${nInt(e?.time) ?? '?'}' ${text(e?.playerName ?? e?.player?.name) ?? 'N/D'}`);
  const assistNames = rows.filter(e => /goal/i.test(String(e?.type ?? '')) && text(e?.assistName ?? e?.assist?.name)).map(e => `${nInt(e?.time) ?? '?'}' ${text(e?.assistName ?? e?.assist?.name)}`);
  const cardNames = rows.filter(e => /card/i.test(String(e?.type ?? ''))).map(e => `${nInt(e?.time) ?? '?'}' ${text(e?.playerName ?? e?.player?.name) ?? 'N/D'} (${text(e?.detail) ?? 'Card'})`);
  db.prepare(`UPDATE matches SET scorers=?,assists=?,cards=?,last_verified_at=? WHERE id=?`).run(scorerNames.join(' | ') || null, assistNames.join(' | ') || null, cardNames.join(' | ') || null, nowIso(), matchId);
  setDetailFlag(matchId, 'events_synced');
  return rows.length;
}

async function saveLineups(matchId: number, fixtureId: number, body: any, sassuoloId: number) {
  const rows = responseRows(body);
  db.prepare(`DELETE FROM match_lineups WHERE match_id=?`).run(matchId);
  const stmt = db.prepare(`INSERT INTO match_lineups(match_id,source_provider,provider_match_id,api_fixture_id,provider_team_id,team_api_id,team_name,team_logo,formation,coach_name,colors_json,start_xi_json,substitutes_json,raw_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  let extraRequests = 0;
  for (const l of rows) {
    const teamId = nInt(l?.teamId ?? l?.team?.id);
    const coachId = nInt(l?.coachId ?? l?.coach?.id);
    let coachName = text(l?.coach?.name ?? l?.coachName);
    if (!coachName && coachId) {
      const c = await cachedLookup('coach', coachId); extraRequests += c.requests;
      coachName = text(c.data?.name);
    }
    const linkLineupEntries = (entries: any[]) => entries.map((entry: any) => {
      const player = entry?.player ?? entry;
      const localPlayerId = localSassuoloPlayer(player?.id ?? player?.playerId, player, teamId, sassuoloId);
      if (entry?.player) return { ...entry, player: { ...player, localPlayerId } };
      return { ...entry, localPlayerId };
    });
    const startXI = linkLineupEntries(Array.isArray(l?.startXI) ? l.startXI : []);
    const substitutes = linkLineupEntries(Array.isArray(l?.substitutes) ? l.substitutes : []);
    stmt.run(matchId, PROVIDER, String(fixtureId), fixtureId, teamId == null ? null : String(teamId), teamId ?? -fixtureId, text(l?.team?.name), text(l?.team?.logo), text(l?.formation), coachName, l?.colors ? JSON.stringify(l.colors) : null, JSON.stringify(startXI), JSON.stringify(substitutes), JSON.stringify(l));
  }
  setDetailFlag(matchId, 'lineups_synced');
  if (rows.length) setDetailFlag(matchId, 'coaches_synced');
  return { stored: rows.length, requests: extraRequests };
}

function groupTeamStatistics(rows: any[]) {
  const groups = new Map<number, { teamId: number; team: any; stats: any[] }>();
  for (const x of rows) {
    const teamId = nInt(x?.teamId ?? x?.team?.id);
    if (!teamId) continue;
    const g = groups.get(teamId) ?? { teamId, team: x?.team ?? {}, stats: [] };
    g.stats.push({ type: text(x?.type) ?? 'Unknown', value: x?.value ?? null });
    if (x?.team) g.team = x.team;
    groups.set(teamId, g);
  }
  return [...groups.values()];
}

function cleanPercentOrNumber(v: any) {
  if (v == null || v === '') return null;
  return nNum(String(v).replace('%', '').trim());
}

async function saveTeamStats(matchId: number, fixtureId: number, body: any, homeId: number | null, awayId: number | null) {
  const groups = groupTeamStatistics(responseRows(body));
  db.prepare(`DELETE FROM match_team_stats WHERE match_id=?`).run(matchId);
  const stmt = db.prepare(`INSERT INTO match_team_stats(match_id,source_provider,provider_match_id,api_fixture_id,provider_team_id,team_api_id,team_name,team_logo,stats_json,raw_json) VALUES(?,?,?,?,?,?,?,?,?,?)`);
  for (const g of groups) stmt.run(matchId, PROVIDER, String(fixtureId), fixtureId, String(g.teamId), g.teamId, text(g.team?.name), text(g.team?.logo), JSON.stringify(g.stats), JSON.stringify(g));
  const get = (teamId: number | null, names: string[]) => {
    const g = groups.find(x => x.teamId === teamId); if (!g) return null;
    for (const n of names) { const s = g.stats.find(x => String(x.type).toLowerCase() === n.toLowerCase()); if (s) return cleanPercentOrNumber(s.value); }
    return null;
  };
  db.prepare(`UPDATE matches SET possession_home=COALESCE(?,possession_home),possession_away=COALESCE(?,possession_away),shots_home=COALESCE(?,shots_home),shots_away=COALESCE(?,shots_away),shots_on_target_home=COALESCE(?,shots_on_target_home),shots_on_target_away=COALESCE(?,shots_on_target_away),corners_home=COALESCE(?,corners_home),corners_away=COALESCE(?,corners_away),fouls_home=COALESCE(?,fouls_home),fouls_away=COALESCE(?,fouls_away),xg_home=COALESCE(?,xg_home),xg_away=COALESCE(?,xg_away),last_verified_at=? WHERE id=?`)
    .run(get(homeId, ['Ball Possession']), get(awayId, ['Ball Possession']), get(homeId, ['Total Shots']), get(awayId, ['Total Shots']), get(homeId, ['Shots on Goal']), get(awayId, ['Shots on Goal']), get(homeId, ['Corner Kicks']), get(awayId, ['Corner Kicks']), get(homeId, ['Fouls']), get(awayId, ['Fouls']), get(homeId, ['expected_goals', 'Expected Goals']), get(awayId, ['expected_goals', 'Expected Goals']), nowIso(), matchId);
  setDetailFlag(matchId, 'team_stats_synced');
  return groups.length;
}

function firstStat(row: any) { return Array.isArray(row?.statistics) ? row.statistics[0] ?? {} : row?.statistics ?? {}; }

async function savePlayerStats(matchId: number, fixtureId: number, body: any, sassuoloId: number) {
  const rows = responseRows(body);
  db.prepare(`DELETE FROM match_player_stats WHERE match_id=?`).run(matchId);
  const stmt = db.prepare(`INSERT INTO match_player_stats(match_id,source_provider,provider_match_id,api_fixture_id,provider_team_id,team_api_id,team_name,team_logo,player_id,provider_player_id,api_football_player_id,player_name,player_photo,minutes,shirt_number,position,rating,captain,substitute,offsides,shots_total,shots_on,goals,goals_conceded,assists,saves,passes_total,passes_key,pass_accuracy,tackles_total,blocks,interceptions,duels_total,duels_won,dribbles_attempts,dribbles_success,dribbles_past,fouls_drawn,fouls_committed,yellow_cards,red_cards,penalty_won,penalty_committed,penalty_scored,penalty_missed,penalty_saved,statistics_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  for (const row of rows) {
    const st = firstStat(row); const games = st?.games ?? {}; const goals = st?.goals ?? {}; const shots = st?.shots ?? {}; const passes = st?.passes ?? {}; const tackles = st?.tackles ?? {}; const duels = st?.duels ?? {}; const dribbles = st?.dribbles ?? {}; const fouls = st?.fouls ?? {}; const cards = st?.cards ?? {}; const penalty = st?.penalty ?? {};
    const team = row?.team ?? {}; const player = row?.player ?? {};
    const teamId = nInt(row?.teamId ?? team?.id); const playerApiId = nInt(row?.playerId ?? player?.id);
    const local = localSassuoloPlayer(playerApiId, { ...player, number: games?.number, position: games?.position }, teamId, sassuoloId);
    stmt.run(matchId, PROVIDER, String(fixtureId), fixtureId, teamId == null ? null : String(teamId), teamId, text(team?.name), text(team?.logo), local, playerApiId == null ? null : String(playerApiId), playerApiId, text(player?.name) ?? `Player ${playerApiId ?? ''}`, text(player?.photo), nInt(games?.minutes), nInt(games?.number), text(games?.position), nNum(games?.rating), boolInt(games?.captain), boolInt(games?.substitute), nInt(st?.offsides), nInt(shots?.total), nInt(shots?.on), nInt(goals?.total), nInt(goals?.conceded), nInt(goals?.assists), nInt(goals?.saves), nInt(passes?.total), nInt(passes?.key), cleanPercentOrNumber(passes?.accuracy), nInt(tackles?.total), nInt(tackles?.blocks), nInt(tackles?.interceptions), nInt(duels?.total), nInt(duels?.won), nInt(dribbles?.attempts), nInt(dribbles?.success), nInt(dribbles?.past), nInt(fouls?.drawn), nInt(fouls?.committed), nInt(cards?.yellow), nInt(cards?.red), nInt(penalty?.won), nInt(penalty?.commited), nInt(penalty?.scored), nInt(penalty?.missed), nInt(penalty?.saved), JSON.stringify(st));
  }
  setDetailFlag(matchId, 'player_stats_synced');
  return rows.length;
}

async function saveInjuries(matchId: number, fixtureId: number, body: any, sassuoloId: number) {
  const rows = responseRows(body);
  db.prepare(`DELETE FROM match_injuries WHERE match_id=?`).run(matchId);
  const stmt = db.prepare(`INSERT INTO match_injuries(match_id,source_provider,provider_match_id,api_fixture_id,team_api_id,team_name,player_api_id,player_id,player_name,type,reason,start_date,end_date,raw_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  for (const x of rows) {
    const teamId = nInt(x?.teamId ?? x?.team?.id); const p = x?.player ?? {}; const playerApiId = nInt(x?.playerId ?? p?.id);
    const local = localSassuoloPlayer(playerApiId, p, teamId, sassuoloId);
    stmt.run(matchId, PROVIDER, String(fixtureId), fixtureId, teamId, text(x?.team?.name), playerApiId, local, text(p?.name ?? x?.playerName) ?? 'N/D', text(x?.type), text(x?.reason), text(x?.start ?? x?.startDate), text(x?.end ?? x?.endDate), JSON.stringify(x));
  }
  setDetailFlag(matchId, 'injuries_synced');
  return rows.length;
}

async function enrichVenue(matchId: number, fixture: any) {
  const venueId = nInt(fixture?.venueId ?? fixture?.venue?.id);
  if (!venueId) { setDetailFlag(matchId, 'venue_synced'); return { requests: 0 }; }
  const v = await cachedLookup('venue', venueId);
  if (v.data) {
    db.prepare(`UPDATE match_details SET venue_name=COALESCE(?,venue_name),venue_city=COALESCE(?,venue_city),venue_synced=1 WHERE match_id=?`).run(text(v.data?.name), text(v.data?.city), matchId);
    db.prepare(`UPDATE matches SET stadium=COALESCE(?,stadium) WHERE id=?`).run(text(v.data?.name), matchId);
  }
  return { requests: v.requests };
}

function flags(matchId: number) {
  return db.prepare(`SELECT events_synced,lineups_synced,team_stats_synced,player_stats_synced,injuries_synced,venue_synced,deep_stats_synced,raw_json FROM match_details WHERE match_id=?`).get(matchId) as any;
}

export async function syncKickoffMatchDetails(matchId: number, force = false, maxRequests = 20) {
  let match = db.prepare(`SELECT * FROM matches WHERE id=?`).get(matchId) as any;
  if (!match) return { stored: 0, requests: 0, errors: [`Partita ${matchId} non trovata`], warnings: [] as string[] };
  const sass = await ensureKickoffSassuoloId();
  if (!sass.ok) return { stored: 0, requests: sass.requests, errors: [sass.error], warnings: [] as string[] };
  let requests = sass.requests; const warnings: string[] = []; const errors: string[] = [];
  let fixtureId = nInt(match.kickoff_fixture_id ?? (match.source_provider === PROVIDER ? match.source_external_id : null));
  if (!fixtureId) {
    const linked = await linkKickoffFixtureForMatch(match, sass.teamId);
    requests += linked.requests;
    if (!linked.ok) return { stored: 0, requests, errors: [linked.error], warnings };
    match = db.prepare(`SELECT * FROM matches WHERE id=?`).get(linked.matchId) as any;
    fixtureId = linked.fixtureId;
  }
  const f = flags(matchId) ?? {};
  let fixture: any = null; try { fixture = f.raw_json ? JSON.parse(f.raw_json) : null; } catch {}
  const teams = getFixtureTeams(fixture ?? { homeTeamId: null, awayTeamId: null, homeTeam: { name: match.home_team }, awayTeam: { name: match.away_team } });

  if (!force && f.deep_stats_synced === 0) return { stored: 0, skipped: 1, requests, warnings: ['KickoffAPI indica deepStatsSynced=false per questa partita.'], errors };
  const canRequest = () => requests < maxRequests && !isQuotaLow();

  if ((force || !f.venue_synced) && canRequest()) { const v = await enrichVenue(matchId, fixture ?? {}); requests += v.requests; }

  const resources: Array<{ flag: string; name: string; run: () => Promise<void> }> = [
    { flag: 'events_synced', name: 'events', run: async () => { const r = await fixtureResource('events', fixtureId); requests += r.meta.requests; if (!r.ok) { warnings.push(`events: ${r.error}`); return; } await saveEvents(matchId, fixtureId, r.raw, teams.homeId, teams.awayId, sass.teamId); } },
    { flag: 'lineups_synced', name: 'lineups', run: async () => { const r = await fixtureResource('lineups', fixtureId); requests += r.meta.requests; if (!r.ok) { warnings.push(`lineups: ${r.error}`); return; } const saved = await saveLineups(matchId, fixtureId, r.raw, sass.teamId); requests += saved.requests; } },
    { flag: 'team_stats_synced', name: 'statistics', run: async () => { const r = await fixtureResource('statistics', fixtureId); requests += r.meta.requests; if (!r.ok) { warnings.push(`statistics: ${r.error}`); return; } await saveTeamStats(matchId, fixtureId, r.raw, teams.homeId, teams.awayId); } },
    { flag: 'player_stats_synced', name: 'players', run: async () => { const r = await fixtureResource('players', fixtureId); requests += r.meta.requests; if (!r.ok) { warnings.push(`players: ${r.error}`); return; } await savePlayerStats(matchId, fixtureId, r.raw, sass.teamId); } },
    { flag: 'injuries_synced', name: 'injuries', run: async () => { const r = await request<any>('fixture-injuries', '/api/v1/injuries', { fixture: fixtureId }); requests += r.meta.requests; if (!r.ok) { warnings.push(`injuries: ${r.error}`); return; } await saveInjuries(matchId, fixtureId, r.raw, sass.teamId); } }
  ];

  for (const resource of resources) {
    const current = flags(matchId) ?? {};
    if (!force && current[resource.flag]) continue;
    if (!canRequest()) { warnings.push(`Sincronizzazione sospesa prima di ${resource.name}: budget/quota KickoffAPI quasi esaurita.`); break; }
    await resource.run();
  }

  const after = flags(matchId) ?? {};
  const complete = ['events_synced','lineups_synced','team_stats_synced','player_stats_synced','injuries_synced'].every(k => Boolean(after[k]));
  return { stored: 1, complete, requests, quotaRemaining: lastRemaining, warnings, errors };
}

export async function syncKickoffSeason(season: string, forceDetails = false, maxRequests = explicitRunBudget()) {
  const seasonRows = db.prepare(`SELECT * FROM seasons WHERE season=? ORDER BY CASE competition WHEN 'Serie A' THEN 0 WHEN 'Serie B' THEN 1 WHEN 'Coppa Italia' THEN 2 ELSE 3 END`).all(season) as any[];
  if (!seasonRows.length) return { season, storedMatches: 0, storedDetails: 0, requests: 0, errors: [`Stagione ${season} non trovata`] };
  const sass = await ensureKickoffSassuoloId();
  if (!sass.ok) return { season, storedMatches: 0, storedDetails: 0, requests: sass.requests, errors: [sass.error] };
  let requests = sass.requests;
  const localIds: number[] = [];
  const competitions: Array<{ competition: string; leagueId: number | null }> = [];
  const errors: string[] = [];
  for (const seasonRow of seasonRows) {
    const competition = String(seasonRow.competition);
    const league = await resolveKickoffLeague(season, competition);
    requests += league.requests;
    if (!league.ok) { errors.push(`${competition}: ${league.error}`); continue; }
    const list = await request<any>('fixtures', '/api/v1/fixtures', { league: league.leagueId, season: league.year, team: sass.teamId });
    requests += list.meta.requests;
    if (!list.ok) { errors.push(`${competition}: ${list.error ?? 'Fixture non disponibili'}`); continue; }
    competitions.push({ competition, leagueId: league.leagueId });
    for (const f of responseRows(list.raw)) { const id = upsertFixture(f, season, competition); if (id) localIds.push(id); }
  }

  let storedDetails = 0, completedDetails = 0, skippedDetails = 0, paused = false;
  const warnings: string[] = [];
  for (const id of localIds) {
    if (requests >= maxRequests || isQuotaLow()) { paused = true; break; }
    const r = await syncKickoffMatchDetails(id, forceDetails, Math.max(1, maxRequests - requests));
    requests += r.requests ?? 0;
    storedDetails += r.stored ?? 0;
    if (r.complete) completedDetails++;
    if (r.skipped) skippedDetails += r.skipped;
    if (r.warnings?.length) warnings.push(...r.warnings.map((w: string) => `match ${id}: ${w}`));
    if (r.errors?.length) errors.push(...r.errors.map((e: string) => `match ${id}: ${e}`));
  }
  const progress = kickoffSeasonProgress(season);
  if (paused) warnings.push(`Import dettagli sospeso per rispettare il budget/quota. Riesegui lo stesso pulsante: i dati già sincronizzati verranno saltati.`);
  return { season, competitions, teamId: sass.teamId, storedMatches: localIds.length, storedDetails, completedDetails, skippedDetails, progress, requests, quotaRemaining: lastRemaining, paused, warnings, errors };
}

export async function syncKickoffCurrent(forceDetails = false) {
  const latest = db.prepare(`SELECT season FROM seasons WHERE lower(competition)='serie a' ORDER BY substr(season,1,4) DESC LIMIT 1`).get() as { season: string } | undefined;
  if (!latest) return { season: null, storedMatches: 0, requests: 0, errors: ['Nessuna stagione Serie A nel database'] };
  return syncKickoffSeason(latest.season, forceDetails, smartRunBudget());
}

export function kickoffSeasonProgress(season: string) {
  const row = db.prepare(`SELECT
    count(*) AS matches,
    sum(CASE WHEN md.source_provider='kickoff' THEN 1 ELSE 0 END) AS linked,
    sum(CASE WHEN md.events_synced=1 THEN 1 ELSE 0 END) AS events,
    sum(CASE WHEN md.lineups_synced=1 THEN 1 ELSE 0 END) AS lineups,
    sum(CASE WHEN md.team_stats_synced=1 THEN 1 ELSE 0 END) AS teamStats,
    sum(CASE WHEN md.player_stats_synced=1 THEN 1 ELSE 0 END) AS playerStats,
    sum(CASE WHEN md.injuries_synced=1 THEN 1 ELSE 0 END) AS injuries,
    sum(CASE WHEN md.events_synced=1 AND md.lineups_synced=1 AND md.team_stats_synced=1 AND md.player_stats_synced=1 AND md.injuries_synced=1 THEN 1 ELSE 0 END) AS complete
    FROM matches m LEFT JOIN match_details md ON md.match_id=m.id WHERE m.season=? AND (lower(m.home_team) LIKE '%sassuolo%' OR lower(m.away_team) LIKE '%sassuolo%')`).get(season) as any;
  return { matches: nInt(row?.matches) ?? 0, linked: nInt(row?.linked) ?? 0, events: nInt(row?.events) ?? 0, lineups: nInt(row?.lineups) ?? 0, teamStats: nInt(row?.teamStats) ?? 0, playerStats: nInt(row?.playerStats) ?? 0, injuries: nInt(row?.injuries) ?? 0, complete: nInt(row?.complete) ?? 0 };
}

export async function testKickoff() {
  if (!enabled()) return { ok: false, configured: false, error: 'KickoffAPI disabilitata' };
  if (!apiKey()) return { ok: false, configured: false, error: 'KICKOFF_API_KEY non configurata' };
  const sass = await ensureKickoffSassuoloId();
  if (!sass.ok) return { ok: false, configured: true, error: sass.error };
  const r = await request<any>('test', '/api/v1/fixtures', { league: nInt(process.env.KICKOFF_SERIE_A_LEAGUE_ID) ?? 135, season: 2022, team: sass.teamId });
  if (!r.ok) return { ok: false, configured: true, teamId: sass.teamId, error: r.error };
  return { ok: true, configured: true, teamId: sass.teamId, serieALeagueId: nInt(process.env.KICKOFF_SERIE_A_LEAGUE_ID) ?? 135, fixtureSample: responseRows(r.raw)[0] ?? null, quotaRemaining: r.meta.remaining, quotaLimit: r.meta.limit, message: 'Connessione KickoffAPI v1 riuscita.' };
}

export function kickoffStatus() {
  const q = db.prepare(`SELECT estimated_remaining,last_request,last_successful_sync,last_error FROM sync_state WHERE provider=? ORDER BY last_request DESC LIMIT 1`).get(PROVIDER) as any;
  const latest = db.prepare(`SELECT season FROM seasons WHERE lower(competition)='serie a' ORDER BY substr(season,1,4) DESC LIMIT 1`).get() as any;
  return { configured: Boolean(apiKey()) && enabled(), enabled: enabled(), teamId: getCachedSassuoloId(), serieALeagueId: nInt(process.env.KICKOFF_SERIE_A_LEAGUE_ID) ?? 135, quotaRemaining: q?.estimated_remaining ?? lastRemaining, lastRequest: q?.last_request ?? null, lastSuccess: q?.last_successful_sync ?? null, lastError: q?.last_error ?? null, maxRequestsPerRun: explicitRunBudget(), smartMaxRequests: smartRunBudget(), latestProgress: latest?.season ? kickoffSeasonProgress(latest.season) : null, latestSeason: latest?.season ?? null };
}
