import { db, getSetting, normalizePlayerPosition, normalizeTeamName, nowIso, recordFixtureConflicts, setSetting } from '../db/database.js';
import { recomputeDerivedPlayerStats } from './importer.js';
import { resolvePlayer } from './playerResolver.js';

const API_BASE = 'https://v3.football.api-sports.io';
const PROVIDER = 'api-football';

const nInt = (value: any) => value == null || value === '' || Number.isNaN(Number(value)) ? null : Math.trunc(Number(value));
const nNum = (value: any) => value == null || value === '' || Number.isNaN(Number(value)) ? null : Number(value);
const boolInt = (value: any) => value ? 1 : 0;
const cleanRating = (value: any) => nNum(value);
const competitionEq = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export type ApiMeta = { requests: number; remaining: number | null; limit: number | null; minuteRemaining: number | null; minuteLimit: number | null };
type ApiResult<T> = { ok: true; data: T; meta: ApiMeta } | { ok: false; error: string; meta: ApiMeta };

function enabled() {
  return process.env.ENABLE_API_FOOTBALL !== 'false';
}
function apiKey() {
  return process.env.API_FOOTBALL_KEY?.trim() ?? '';
}
function emptyMeta(): ApiMeta { return { requests: 0, remaining: null, limit: null, minuteRemaining: null, minuteLimit: null }; }

function recordUsage(resource: string, meta: ApiMeta, error?: string) {
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

function apiErrors(body: any): string | null {
  const errors = body?.errors;
  if (!errors) return null;
  if (Array.isArray(errors) && errors.length) return errors.map(String).join(' | ');
  if (typeof errors === 'object' && Object.keys(errors).length) return Object.entries(errors).map(([k, v]) => `${k}: ${String(v)}`).join(' | ');
  if (typeof errors === 'string' && errors.trim()) return errors;
  return null;
}

async function apiRequest<T = any>(resource: string, endpoint: string, params: Record<string, string | number | undefined | null> = {}): Promise<ApiResult<T>> {
  if (!enabled()) return { ok: false, error: 'API-Football disabilitata (ENABLE_API_FOOTBALL=false)', meta: emptyMeta() };
  const key = apiKey();
  if (!key) return { ok: false, error: 'API_FOOTBALL_KEY non configurata', meta: emptyMeta() };
  const url = new URL(`${API_BASE}${endpoint}`);
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  try {
    const response = await fetch(url, { headers: { 'x-apisports-key': key } });
    const meta: ApiMeta = {
      requests: 1,
      remaining: nInt(response.headers.get('x-ratelimit-requests-remaining')),
      limit: nInt(response.headers.get('x-ratelimit-requests-limit')),
      minuteRemaining: nInt(response.headers.get('x-ratelimit-remaining')),
      minuteLimit: nInt(response.headers.get('x-ratelimit-limit'))
    };
    let body: any = null;
    try { body = await response.json(); } catch { }
    if (!response.ok) { const error = `HTTP ${response.status}${body ? `: ${JSON.stringify(body).slice(0, 300)}` : ''}`; recordUsage(resource, meta, error); return { ok: false, error, meta }; }
    const bodyError = apiErrors(body);
    if (bodyError) { recordUsage(resource, meta, bodyError); return { ok: false, error: bodyError, meta }; }
    recordUsage(resource, meta);
    return { ok: true, data: body as T, meta };
  } catch (e) { const meta = { ...emptyMeta(), requests: 1 }; const error = String(e); recordUsage(resource, meta, error); return { ok: false, error, meta }; }
}

function seasonYear(season: string) {
  const year = Number(season.slice(0, 4));
  return Number.isFinite(year) ? year : null;
}

function transferSeason(date: string | null | undefined) {
  if (!date) return null;
  const d = new Date(`${date}T00:00:00Z`); if (Number.isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear(), start = d.getUTCMonth() >= 6 ? y : y - 1;
  return `${start}/${String((start + 1) % 100).padStart(2, '0')}`;
}

function getCachedTeamId() {
  const fromEnv = nInt(process.env.API_FOOTBALL_SASSUO_TEAM_ID ?? process.env.API_FOOTBALL_SASSUOLO_TEAM_ID);
  if (fromEnv) return fromEnv;
  return nInt(getSetting('api_football_sassuolo_team_id'));
}

export async function ensureSassuoloTeamId() {
  const cached = getCachedTeamId(); if (cached) return { ok: true as const, teamId: cached, requests: 0 };
  const r = await apiRequest<any>('team', '/teams', { search: 'Sassuolo' });
  if (!r.ok) return { ok: false as const, error: r.error, requests: r.meta.requests };
  const rows = Array.isArray(r.data?.response) ? r.data.response : [];
  const match = rows.find((x: any) => String(x?.team?.country ?? '').toLowerCase() === 'italy' && /sassuolo/i.test(String(x?.team?.name ?? ''))) ?? rows.find((x: any) => /sassuolo/i.test(String(x?.team?.name ?? '')));
  const teamId = nInt(match?.team?.id);
  if (!teamId) return { ok: false as const, error: 'Sassuolo non trovato da /teams?search=Sassuolo', requests: r.meta.requests };
  setSetting('api_football_sassuolo_team_id', String(teamId));
  db.prepare(`UPDATE teams SET api_football_id=?,badge_url=COALESCE(?,badge_url) WHERE canonical_name='U.S. Sassuolo Calcio'`).run(teamId, match?.team?.logo ?? null);
  return { ok: true as const, teamId, requests: r.meta.requests };
}

export async function resolveLeagueForSeason(season: string, competition: string) {
  const local = db.prepare(`SELECT api_football_league_id,api_football_season_year,api_football_coverage_json FROM seasons WHERE season=? AND competition=?`).get(season, competition) as any;
  const year = seasonYear(season); if (!year) return { ok: false as const, error: `Formato stagione non valido: ${season}`, requests: 0 };
  if (local?.api_football_league_id) return { ok: true as const, leagueId: Number(local.api_football_league_id), year, coverage: local.api_football_coverage_json ? JSON.parse(local.api_football_coverage_json) : null, requests: 0 };
  const t = await ensureSassuoloTeamId(); if (!t.ok) return t;
  const r = await apiRequest<any>('leagues', '/leagues', { team: t.teamId, season: year });
  if (!r.ok) return { ok: false as const, error: r.error, requests: t.requests + r.meta.requests };
  const rows = Array.isArray(r.data?.response) ? r.data.response : [];
  const exact = rows.find((x: any) => competitionEq(String(x?.league?.name ?? ''), competition));
  const italianLeague = rows.find((x: any) => String(x?.country?.name ?? '').toLowerCase() === 'italy' && String(x?.league?.type ?? '').toLowerCase() === 'league');
  // A league fallback is safe only for a domestic league.  Falling back from
  // Coppa Italia or Europa League to Serie A would silently store statistics
  // under the wrong competition.
  const chosen = exact ?? (/^Serie [AB]$/i.test(competition) ? italianLeague : undefined);
  const leagueId = nInt(chosen?.league?.id);
  if (!leagueId) return { ok: false as const, error: `Nessuna lega API-Football trovata per ${season} · ${competition}. Il piano gratuito può limitare le stagioni storiche.`, requests: t.requests + r.meta.requests };
  const seasonInfo = (chosen?.seasons ?? []).find((s: any) => Number(s?.year) === year) ?? chosen?.seasons?.[0] ?? null;
  const coverage = seasonInfo?.coverage ?? null;
  db.prepare(`UPDATE seasons SET api_football_league_id=?,api_football_season_year=?,api_football_coverage_json=?,last_verified_at=? WHERE season=? AND competition=?`)
    .run(leagueId, year, coverage ? JSON.stringify(coverage) : null, nowIso(), season, competition);
  return { ok: true as const, leagueId, year, coverage, requests: t.requests + r.meta.requests };
}

function upsertPlayer(player: any, extra: { position?: any; number?: any; currentSquad?: boolean } = {}) {
  const apiId = nInt(player?.id);
  const providerName = String(player?.name ?? '').trim();
  const firstname = String(player?.firstname ?? '').trim();
  const lastname = String(player?.lastname ?? '').trim();
  // API-Football often exposes `name` as an initial plus surname. That value
  // is an alias, never the canonical display name when the full fields exist.
  const name = [firstname, lastname].filter(Boolean).join(' ').trim() || providerName;
  if (!providerName && !name) return null;
  let existing: any = apiId ? db.prepare(`SELECT * FROM players WHERE api_football_id=?`).get(apiId) : null;
  if (!existing) existing = db.prepare(`SELECT * FROM players WHERE lower(name)=lower(?)`).get(name);
  if (!existing) {
    const resolution = resolvePlayer({ name: providerName || name, sourceProvider: PROVIDER, sourcePlayerId: apiId, context: `api-football:${apiId ?? name}`, allowCreate: true });
    if (resolution.status === 'conflict') return null;
    existing = db.prepare('SELECT * FROM players WHERE id=?').get(resolution.playerId);
  }
  if (existing) {
    if (existing.source_provider === 'manual') {
      db.prepare(`UPDATE players SET api_football_id=COALESCE(api_football_id,?),photo_url=COALESCE(photo_url,?),source_external_id=COALESCE(source_external_id,?),last_verified_at=? WHERE id=?`)
        .run(apiId, player?.photo ?? null, apiId ? String(apiId) : null, nowIso(), existing.id);
      if (extra.currentSquad) db.prepare(`UPDATE players SET current_squad=1 WHERE id=?`).run(existing.id);
      return existing.id as number;
    }
    db.prepare(`UPDATE players SET api_football_id=COALESCE(?,api_football_id),name=CASE WHEN ?<>'' THEN ? ELSE name END,firstname=COALESCE(?,firstname),lastname=COALESCE(?,lastname),nationality=COALESCE(?,nationality),birth_date=COALESCE(?,birth_date),birth_place=COALESCE(?,birth_place),birth_country=COALESCE(?,birth_country),age=COALESCE(?,age),height=COALESCE(?,height),weight=COALESCE(?,weight),photo_url=COALESCE(?,photo_url),position=COALESCE(?,position),shirt_number=COALESCE(?,shirt_number),injured=COALESCE(?,injured),current_squad=CASE WHEN ?=1 THEN 1 ELSE current_squad END,source_provider=?,source_external_id=COALESCE(?,source_external_id),last_verified_at=? WHERE id=?`)
      .run(apiId, firstname && lastname ? name : '', firstname || null, lastname || null, player?.nationality ?? null, player?.birth?.date ?? player?.birth_date ?? null, player?.birth?.place ?? null, player?.birth?.country ?? null, nInt(player?.age), player?.height ?? null, player?.weight ?? null, player?.photo ?? null, normalizePlayerPosition(extra.position ?? player?.position), nInt(extra.number ?? player?.number), boolInt(player?.injured), extra.currentSquad ? 1 : 0, PROVIDER, apiId ? String(apiId) : null, nowIso(), existing.id);
    return existing.id as number;
  }
  const result = db.prepare(`INSERT INTO players(api_football_id,name,firstname,lastname,nationality,birth_date,birth_place,birth_country,age,height,weight,photo_url,position,shirt_number,injured,current_squad,source_provider,source_external_id,last_verified_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(apiId, name, player?.firstname ?? null, player?.lastname ?? null, player?.nationality ?? null, player?.birth?.date ?? null, player?.birth?.place ?? null, player?.birth?.country ?? null, nInt(player?.age), player?.height ?? null, player?.weight ?? null, player?.photo ?? null, normalizePlayerPosition(extra.position ?? player?.position), nInt(extra.number ?? player?.number), boolInt(player?.injured), extra.currentSquad ? 1 : 0, PROVIDER, apiId ? String(apiId) : null, nowIso());
  return Number(result.lastInsertRowid);
}

function upsertPlayerSeason(playerId: number, season: string, competition: string, leagueId: number, stat: any) {
  const games = stat?.games ?? {}, goals = stat?.goals ?? {}, subs = stat?.substitutes ?? {}, shots = stat?.shots ?? {}, passes = stat?.passes ?? {}, tackles = stat?.tackles ?? {}, duels = stat?.duels ?? {}, dribbles = stat?.dribbles ?? {}, fouls = stat?.fouls ?? {}, cards = stat?.cards ?? {}, penalty = stat?.penalty ?? {};
  const existing = db.prepare(`SELECT source_provider FROM player_seasons WHERE player_id=? AND season=? AND competition=?`).get(playerId, season, competition) as any;
  if (existing?.source_provider === 'manual') return false;
  db.prepare(`INSERT INTO player_seasons(player_id,season,competition,api_football_league_id,appearances,starts,minutes,shirt_number,position,rating,captain,substitutes_in,substitutes_out,substitutes_bench,shots_total,shots_on,goals,goals_conceded,assists,saves,passes_total,passes_key,pass_accuracy,tackles_total,blocks,interceptions,duels_total,duels_won,dribbles_attempts,dribbles_success,fouls_drawn,fouls_committed,yellow_cards,yellow_red_cards,red_cards,penalty_won,penalty_committed,penalty_scored,penalty_missed,penalty_saved,source_provider,last_verified_at)
    VALUES(@player_id,@season,@competition,@league_id,@appearances,@starts,@minutes,@shirt_number,@position,@rating,@captain,@sub_in,@sub_out,@sub_bench,@shots_total,@shots_on,@goals,@goals_conceded,@assists,@saves,@passes_total,@passes_key,@pass_accuracy,@tackles_total,@blocks,@interceptions,@duels_total,@duels_won,@dribbles_attempts,@dribbles_success,@fouls_drawn,@fouls_committed,@yellow,@yellow_red,@red,@penalty_won,@penalty_committed,@penalty_scored,@penalty_missed,@penalty_saved,@provider,@verified)
    ON CONFLICT(player_id,season,competition) DO UPDATE SET api_football_league_id=excluded.api_football_league_id,appearances=excluded.appearances,starts=excluded.starts,minutes=excluded.minutes,shirt_number=excluded.shirt_number,position=excluded.position,rating=excluded.rating,captain=excluded.captain,substitutes_in=excluded.substitutes_in,substitutes_out=excluded.substitutes_out,substitutes_bench=excluded.substitutes_bench,shots_total=excluded.shots_total,shots_on=excluded.shots_on,goals=excluded.goals,goals_conceded=excluded.goals_conceded,assists=excluded.assists,saves=excluded.saves,passes_total=excluded.passes_total,passes_key=excluded.passes_key,pass_accuracy=excluded.pass_accuracy,tackles_total=excluded.tackles_total,blocks=excluded.blocks,interceptions=excluded.interceptions,duels_total=excluded.duels_total,duels_won=excluded.duels_won,dribbles_attempts=excluded.dribbles_attempts,dribbles_success=excluded.dribbles_success,fouls_drawn=excluded.fouls_drawn,fouls_committed=excluded.fouls_committed,yellow_cards=excluded.yellow_cards,yellow_red_cards=excluded.yellow_red_cards,red_cards=excluded.red_cards,penalty_won=excluded.penalty_won,penalty_committed=excluded.penalty_committed,penalty_scored=excluded.penalty_scored,penalty_missed=excluded.penalty_missed,penalty_saved=excluded.penalty_saved,source_provider=excluded.source_provider,last_verified_at=excluded.last_verified_at`)
    .run({ player_id: playerId, season, competition, league_id: leagueId, appearances: nInt(games?.appearences), starts: nInt(games?.lineups), minutes: nInt(games?.minutes), shirt_number: nInt(games?.number), position: normalizePlayerPosition(games?.position), rating: cleanRating(games?.rating), captain: boolInt(games?.captain), sub_in: nInt(subs?.in), sub_out: nInt(subs?.out), sub_bench: nInt(subs?.bench), shots_total: nInt(shots?.total), shots_on: nInt(shots?.on), goals: nInt(goals?.total), goals_conceded: nInt(goals?.conceded), assists: nInt(goals?.assists), saves: nInt(goals?.saves), passes_total: nInt(passes?.total), passes_key: nInt(passes?.key), pass_accuracy: nNum(String(passes?.accuracy ?? '').replace('%', '')), tackles_total: nInt(tackles?.total), blocks: nInt(tackles?.blocks), interceptions: nInt(tackles?.interceptions), duels_total: nInt(duels?.total), duels_won: nInt(duels?.won), dribbles_attempts: nInt(dribbles?.attempts), dribbles_success: nInt(dribbles?.success), fouls_drawn: nInt(fouls?.drawn), fouls_committed: nInt(fouls?.committed), yellow: nInt(cards?.yellow), yellow_red: nInt(cards?.yellowred), red: nInt(cards?.red), penalty_won: nInt(penalty?.won), penalty_committed: nInt(penalty?.commited), penalty_scored: nInt(penalty?.scored), penalty_missed: nInt(penalty?.missed), penalty_saved: nInt(penalty?.saved), provider: PROVIDER, verified: nowIso() });
  return true;
}

export async function syncApiFootballSquad() {
  const t = await ensureSassuoloTeamId(); if (!t.ok) return { stored: 0, requests: t.requests, errors: [t.error] };
  const r = await apiRequest<any>('squad', '/players/squads', { team: t.teamId });
  if (!r.ok) return { stored: 0, requests: t.requests + r.meta.requests, errors: [r.error] };
  const players = r.data?.response?.[0]?.players ?? [];
  let stored = 0;
  const activeIds = new Set<number>();
  for (const p of players) {
    const id = upsertPlayer(p, { position: p?.position, number: p?.number, currentSquad: true });
    if (id) { activeIds.add(id); stored++; continue; }
    const conflict = db.prepare(`SELECT candidates_json FROM player_match_conflicts WHERE status='open' AND source_provider=? AND source_player_id=? ORDER BY id DESC LIMIT 1`).get(PROVIDER, p?.id == null ? null : String(p.id)) as { candidates_json: string | null } | undefined;
    for (const candidate of JSON.parse(conflict?.candidates_json ?? '[]') as Array<{ id: number }>) activeIds.add(candidate.id);
  }
  db.prepare(`UPDATE players SET current_squad=0 WHERE source_provider<>'manual' OR source_provider IS NULL`).run();
  const markCurrent = db.prepare('UPDATE players SET current_squad=1 WHERE id=?');
  for (const id of activeIds) markCurrent.run(id);
  return { stored, requests: t.requests + r.meta.requests, errors: [] };
}

export async function syncApiFootballFixturesForSeason(
  season: string,
  competition?: string
) {
  const seasonRow = db.prepare(`
    SELECT *
    FROM seasons
    WHERE season=?
    ${competition ? 'AND competition=?' : ''}
    ORDER BY competition
    LIMIT 1
  `).get(...(competition ? [season, competition] : [season])) as any;

  if (!seasonRow) {
    return {
      stored: 0,
      requests: 0,
      errors: [`Stagione ${season} non presente nel database`]
    };
  }

  const comp = String(seasonRow.competition);

  const league = await resolveLeagueForSeason(season, comp);

  if (!league.ok) {
    return {
      stored: 0,
      requests: league.requests,
      errors: [league.error]
    };
  }

  const team = await ensureSassuoloTeamId();

  if (!team.ok) {
    return {
      stored: 0,
      requests: league.requests + team.requests,
      errors: [team.error]
    };
  }

  const response = await apiRequest<any>(
    'fixtures',
    '/fixtures',
    {
      team: team.teamId,
      league: league.leagueId,
      season: league.year
    }
  );

  const requests =
    league.requests +
    team.requests +
    response.meta.requests;

  if (!response.ok) {
    return {
      stored: 0,
      requests,
      errors: [response.error]
    };
  }

  let stored = 0;

  for (const row of response.data?.response ?? []) {
    const fixture = row?.fixture;
    const teams = row?.teams;
    const goals = row?.goals;
    const score = row?.score;

    if (!fixture || !teams) continue;

    const fixtureId = nInt(fixture.id);

    const home = normalizeTeamName(String(teams?.home?.name ?? '').trim());
    const away = normalizeTeamName(String(teams?.away?.name ?? '').trim());

    if (!home || !away) continue;

    const fixtureDate = fixture?.date
      ? String(fixture.date).slice(0, 10)
      : null;

    if (!fixtureDate) continue;

    /*
     * Prima controlliamo se la partita esiste già.
     *
     * Questo è importante perché potresti averla già
     * importata tramite Football-Data.
     */
    const existing = db.prepare(`
      SELECT *
      FROM matches
      WHERE date LIKE ?
        AND lower(home_team)=lower(?)
        AND lower(away_team)=lower(?)
      LIMIT 1
    `).get(
      `${fixtureDate}%`,
      home,
      away
    ) as any;

    const halftime =
      score?.halftime?.home != null &&
        score?.halftime?.away != null
        ? `${score.halftime.home}-${score.halftime.away}`
        : null;

    if (existing) {
      recordFixtureConflicts(existing, { date: fixture?.date ?? fixtureDate, home_score: nInt(goals?.home), away_score: nInt(goals?.away) }, PROVIDER);

      /*
       * Se l'hai modificata manualmente non sovrascriviamo
       * i tuoi dati.
       */
      if (existing.source_provider === 'manual') {
        continue;
      }

      db.prepare(`
        UPDATE matches
        SET
          season = COALESCE(season, ?),
          competition = COALESCE(competition, ?),
          round = COALESCE(?, round),

          home_score = COALESCE(?, home_score),
          away_score = COALESCE(?, away_score),

          halftime_score = COALESCE(?, halftime_score),

          stadium = COALESCE(?, stadium),
          referee = COALESCE(?, referee),

          source_external_id = COALESCE(?, source_external_id),
          last_verified_at = ?

        WHERE id = ?
      `).run(
        season,
        comp,
        row?.league?.round ?? null,

        nInt(goals?.home),
        nInt(goals?.away),

        halftime,

        fixture?.venue?.name ?? null,
        fixture?.referee ?? null,

        fixtureId ? String(fixtureId) : null,
        nowIso(),

        existing.id
      );

      stored++;
      continue;
    }

    /*
     * Partita nuova.
     */
    db.prepare(`
      INSERT INTO matches(
        external_key,
        date,
        season,
        competition,
        round,
        home_team,
        away_team,
        home_score,
        away_score,
        halftime_score,
        stadium,
        referee,
        source_provider,
        source_external_id,
        last_verified_at
      )
      VALUES(
        ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?
      )
    `).run(
      `api-football:${fixtureId}`,

      fixture?.date ?? fixtureDate,

      season,
      comp,

      row?.league?.round ?? null,

      home,
      away,

      nInt(goals?.home),
      nInt(goals?.away),

      halftime,

      fixture?.venue?.name ?? null,
      fixture?.referee ?? null,

      PROVIDER,

      fixtureId ? String(fixtureId) : null,

      nowIso()
    );

    stored++;
  }

  return {
    stored,
    requests,
    errors: []
  };
}


function parsePercentOrNumber(value: any) {
  if (value == null || value === '') return null;
  const raw = typeof value === 'string' ? value.replace('%', '').trim() : value;
  return nNum(raw);
}

function normalizeStatType(value: any) {
  return String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function fixtureStatMap(statistics: any[] | undefined) {
  const out = new Map<string, any>();
  for (const row of statistics ?? []) out.set(normalizeStatType(row?.type), row?.value ?? null);
  return out;
}

function playerLocalIdFromApiObject(player: any) {
  if (!player?.id && !player?.name) return null;
  return upsertPlayer(player);
}

function persistFixtureDetails(matchId: number, row: any) {
  const fixture = row?.fixture ?? {};
  const league = row?.league ?? {};
  const teams = row?.teams ?? {};
  const goals = row?.goals ?? {};
  const score = row?.score ?? {};
  const apiFixtureId = nInt(fixture?.id);
  if (!apiFixtureId) return false;

  const verified = nowIso();

  db.prepare(`INSERT INTO match_details(
      match_id,api_fixture_id,timezone,kickoff_timestamp,period_first,period_second,status_long,status_short,elapsed,extra,
      venue_id,venue_name,venue_city,league_id,league_name,league_country,league_logo,league_flag,league_season,league_round,
      home_team_api_id,home_team_name,home_team_logo,home_winner,away_team_api_id,away_team_name,away_team_logo,away_winner,
      goals_home,goals_away,halftime_home,halftime_away,fulltime_home,fulltime_away,extratime_home,extratime_away,penalty_home,penalty_away,
      raw_json,last_verified_at
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(match_id) DO UPDATE SET
      api_fixture_id=excluded.api_fixture_id,timezone=excluded.timezone,kickoff_timestamp=excluded.kickoff_timestamp,
      period_first=excluded.period_first,period_second=excluded.period_second,status_long=excluded.status_long,status_short=excluded.status_short,
      elapsed=excluded.elapsed,extra=excluded.extra,venue_id=excluded.venue_id,venue_name=excluded.venue_name,venue_city=excluded.venue_city,
      league_id=excluded.league_id,league_name=excluded.league_name,league_country=excluded.league_country,league_logo=excluded.league_logo,
      league_flag=excluded.league_flag,league_season=excluded.league_season,league_round=excluded.league_round,
      home_team_api_id=excluded.home_team_api_id,home_team_name=excluded.home_team_name,home_team_logo=excluded.home_team_logo,home_winner=excluded.home_winner,
      away_team_api_id=excluded.away_team_api_id,away_team_name=excluded.away_team_name,away_team_logo=excluded.away_team_logo,away_winner=excluded.away_winner,
      goals_home=excluded.goals_home,goals_away=excluded.goals_away,halftime_home=excluded.halftime_home,halftime_away=excluded.halftime_away,
      fulltime_home=excluded.fulltime_home,fulltime_away=excluded.fulltime_away,extratime_home=excluded.extratime_home,extratime_away=excluded.extratime_away,
      penalty_home=excluded.penalty_home,penalty_away=excluded.penalty_away,raw_json=excluded.raw_json,last_verified_at=excluded.last_verified_at`)
    .run(
      matchId, apiFixtureId, fixture?.timezone ?? null, nInt(fixture?.timestamp), nInt(fixture?.periods?.first), nInt(fixture?.periods?.second),
      fixture?.status?.long ?? null, fixture?.status?.short ?? null, nInt(fixture?.status?.elapsed), nInt(fixture?.status?.extra),
      nInt(fixture?.venue?.id), fixture?.venue?.name ?? null, fixture?.venue?.city ?? null,
      nInt(league?.id), league?.name ?? null, league?.country ?? null, league?.logo ?? null, league?.flag ?? null, nInt(league?.season), league?.round ?? null,
      nInt(teams?.home?.id), teams?.home?.name ?? null, teams?.home?.logo ?? null, teams?.home?.winner == null ? null : boolInt(teams.home.winner),
      nInt(teams?.away?.id), teams?.away?.name ?? null, teams?.away?.logo ?? null, teams?.away?.winner == null ? null : boolInt(teams.away.winner),
      nInt(goals?.home), nInt(goals?.away), nInt(score?.halftime?.home), nInt(score?.halftime?.away), nInt(score?.fulltime?.home), nInt(score?.fulltime?.away),
      nInt(score?.extratime?.home), nInt(score?.extratime?.away), nInt(score?.penalty?.home), nInt(score?.penalty?.away), JSON.stringify(row), verified
    );

  db.prepare(`DELETE FROM match_events WHERE match_id=?`).run(matchId);
  const insertEvent = db.prepare(`INSERT INTO match_events(
      match_id,source_provider,provider_match_id,api_fixture_id,minute,extra_minute,team_api_id,team_name,team_logo,player_api_id,player_id,player_name,
      assist_player_api_id,assist_player_id,assist_name,type,detail,comments,scoring_play,scoring_team_name,is_own_goal
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const scorerNames: string[] = [];
  const assistNames: string[] = [];
  const cardNames: string[] = [];
  for (const event of row?.events ?? []) {
    const playerId = playerLocalIdFromApiObject(event?.player);
    const assistId = playerLocalIdFromApiObject(event?.assist);
    insertEvent.run(
      matchId, 'api-football', String(apiFixtureId), apiFixtureId, nInt(event?.time?.elapsed), nInt(event?.time?.extra), nInt(event?.team?.id), event?.team?.name ?? null, event?.team?.logo ?? null,
      nInt(event?.player?.id), playerId, event?.player?.name ?? null, nInt(event?.assist?.id), assistId, event?.assist?.name ?? null,
      event?.type ?? null, event?.detail ?? null, event?.comments ?? null, String(event?.type ?? '').toLowerCase() === 'goal' ? 1 : 0, event?.team?.name ?? null, String(event?.detail ?? '').toLowerCase().includes('own goal') ? 1 : 0
    );
    if (String(event?.type ?? '').toLowerCase() === 'goal' && event?.player?.name) scorerNames.push(`${event?.time?.elapsed ?? '?'}' ${event.player.name}${event?.detail ? ` (${event.detail})` : ''}`);
    if (String(event?.type ?? '').toLowerCase() === 'goal' && event?.assist?.name) assistNames.push(`${event?.time?.elapsed ?? '?'}' ${event.assist.name}`);
    if (String(event?.type ?? '').toLowerCase() === 'card' && event?.player?.name) cardNames.push(`${event?.time?.elapsed ?? '?'}' ${event.player.name} (${event?.detail ?? 'Card'})`);
  }

  db.prepare(`DELETE FROM match_lineups WHERE match_id=?`).run(matchId);
  const insertLineup = db.prepare(`INSERT INTO match_lineups(
      match_id,api_fixture_id,team_api_id,team_name,team_logo,formation,coach_api_id,coach_name,coach_photo,colors_json,start_xi_json,substitutes_json
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`);
  for (const lineup of row?.lineups ?? []) {
    const teamId = nInt(lineup?.team?.id);
    if (!teamId) continue;
    for (const item of [...(lineup?.startXI ?? []), ...(lineup?.substitutes ?? [])]) playerLocalIdFromApiObject(item?.player);
    insertLineup.run(
      matchId, apiFixtureId, teamId, lineup?.team?.name ?? null, lineup?.team?.logo ?? null, lineup?.formation ?? null,
      nInt(lineup?.coach?.id), lineup?.coach?.name ?? null, lineup?.coach?.photo ?? null,
      JSON.stringify(lineup?.team?.colors ?? null), JSON.stringify(lineup?.startXI ?? []), JSON.stringify(lineup?.substitutes ?? [])
    );
  }

  db.prepare(`DELETE FROM match_team_stats WHERE match_id=?`).run(matchId);
  const insertTeamStats = db.prepare(`INSERT INTO match_team_stats(match_id,api_fixture_id,team_api_id,team_name,team_logo,stats_json) VALUES(?,?,?,?,?,?)`);
  const teamStatRows = Array.isArray(row?.statistics) ? row.statistics : [];
  for (const stats of teamStatRows) {
    const teamId = nInt(stats?.team?.id);
    if (!teamId) continue;
    insertTeamStats.run(matchId, apiFixtureId, teamId, stats?.team?.name ?? null, stats?.team?.logo ?? null, JSON.stringify(stats?.statistics ?? []));
  }

  db.prepare(`DELETE FROM match_player_stats WHERE match_id=?`).run(matchId);
  const insertPlayerStats = db.prepare(`INSERT INTO match_player_stats(
      match_id,api_fixture_id,team_api_id,team_name,team_logo,player_id,api_football_player_id,player_name,player_photo,
      minutes,shirt_number,position,rating,captain,substitute,offsides,shots_total,shots_on,goals,goals_conceded,assists,saves,
      passes_total,passes_key,pass_accuracy,tackles_total,blocks,interceptions,duels_total,duels_won,dribbles_attempts,dribbles_success,dribbles_past,
      fouls_drawn,fouls_committed,yellow_cards,red_cards,penalty_won,penalty_committed,penalty_scored,penalty_missed,penalty_saved,statistics_json
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  for (const teamBlock of row?.players ?? []) {
    for (const item of teamBlock?.players ?? []) {
      const p = item?.player ?? {};
      const stat = item?.statistics?.[0] ?? {};
      const games = stat?.games ?? {}, shots = stat?.shots ?? {}, goals2 = stat?.goals ?? {}, passes = stat?.passes ?? {}, tackles = stat?.tackles ?? {},
        duels = stat?.duels ?? {}, dribbles = stat?.dribbles ?? {}, fouls = stat?.fouls ?? {}, cards = stat?.cards ?? {}, penalty = stat?.penalty ?? {};
      const localPlayerId = playerLocalIdFromApiObject(p);
      if (!p?.name) continue;
      insertPlayerStats.run(
        matchId, apiFixtureId, nInt(teamBlock?.team?.id), teamBlock?.team?.name ?? null, teamBlock?.team?.logo ?? null,
        localPlayerId, nInt(p?.id), p?.name, p?.photo ?? null, nInt(games?.minutes), nInt(games?.number), games?.position ?? null,
        cleanRating(games?.rating), games?.captain == null ? null : boolInt(games.captain), games?.substitute == null ? null : boolInt(games.substitute), nInt(games?.offsides),
        nInt(shots?.total), nInt(shots?.on), nInt(goals2?.total), nInt(goals2?.conceded), nInt(goals2?.assists), nInt(goals2?.saves),
        nInt(passes?.total), nInt(passes?.key), parsePercentOrNumber(passes?.accuracy), nInt(tackles?.total), nInt(tackles?.blocks), nInt(tackles?.interceptions),
        nInt(duels?.total), nInt(duels?.won), nInt(dribbles?.attempts), nInt(dribbles?.success), nInt(dribbles?.past), nInt(fouls?.drawn), nInt(fouls?.committed),
        nInt(cards?.yellow), nInt(cards?.red), nInt(penalty?.won), nInt(penalty?.commited), nInt(penalty?.scored), nInt(penalty?.missed), nInt(penalty?.saved), JSON.stringify(stat)
      );
    }
  }

  const homeStatsBlock = teamStatRows.find((x: any) => Number(x?.team?.id) === Number(teams?.home?.id));
  const awayStatsBlock = teamStatRows.find((x: any) => Number(x?.team?.id) === Number(teams?.away?.id));
  const hs = fixtureStatMap(homeStatsBlock?.statistics);
  const as = fixtureStatMap(awayStatsBlock?.statistics);
  const val = (m: Map<string,any>, ...keys: string[]) => { for (const k of keys) if (m.has(k)) return m.get(k); return null; };

  db.prepare(`UPDATE matches SET
      date=COALESCE(?,date),round=COALESCE(?,round),home_team=COALESCE(?,home_team),away_team=COALESCE(?,away_team),
      home_score=COALESCE(?,home_score),away_score=COALESCE(?,away_score),halftime_score=COALESCE(?,halftime_score),
      scorers=?,assists=?,cards=?,stadium=COALESCE(?,stadium),referee=COALESCE(?,referee),
      possession_home=?,possession_away=?,shots_home=?,shots_away=?,shots_on_target_home=?,shots_on_target_away=?,
      corners_home=?,corners_away=?,fouls_home=?,fouls_away=?,xg_home=?,xg_away=?,source_external_id=?,last_verified_at=? WHERE id=?`)
    .run(
      fixture?.date ?? null, league?.round ?? null, teams?.home?.name ?? null, teams?.away?.name ?? null,
      nInt(goals?.home), nInt(goals?.away), score?.halftime?.home != null && score?.halftime?.away != null ? `${score.halftime.home}-${score.halftime.away}` : null,
      scorerNames.join(' | ') || null, assistNames.join(' | ') || null, cardNames.join(' | ') || null,
      fixture?.venue?.name ?? null, fixture?.referee ?? null,
      parsePercentOrNumber(val(hs, 'ball_possession')), parsePercentOrNumber(val(as, 'ball_possession')),
      nInt(val(hs, 'total_shots')), nInt(val(as, 'total_shots')), nInt(val(hs, 'shots_on_goal')), nInt(val(as, 'shots_on_goal')),
      nInt(val(hs, 'corner_kicks')), nInt(val(as, 'corner_kicks')), nInt(val(hs, 'fouls')), nInt(val(as, 'fouls')),
      nNum(val(hs, 'expected_goals')), nNum(val(as, 'expected_goals')), String(apiFixtureId), verified, matchId
    );

  return true;
}

export async function syncApiFootballMatchDetails(matchId: number) {
  const match = db.prepare(`SELECT * FROM matches WHERE id=?`).get(matchId) as any;
  if (!match) return { stored: 0, requests: 0, errors: [`Partita ${matchId} non trovata`] };
  const fixtureId = nInt(match.source_external_id) ?? nInt(String(match.external_key ?? '').replace(/^api-football:/, ''));
  if (!fixtureId) return { stored: 0, requests: 0, errors: ['La partita non ha un fixture ID API-Football. Sincronizza prima la stagione.'] };
  const r = await apiRequest<any>('fixture-details', '/fixtures', { id: fixtureId });
  if (!r.ok) return { stored: 0, requests: r.meta.requests, errors: [r.error] };
  const row = r.data?.response?.[0];
  if (!row) return { stored: 0, requests: r.meta.requests, errors: ['API-Football non ha restituito dettagli per questa partita'] };
  persistFixtureDetails(matchId, row);
  return { stored: 1, fixtureId, requests: r.meta.requests, errors: [] };
}

export async function syncApiFootballFixtureDetailsForSeason(season: string, competition?: string) {
  const seasonRow = db.prepare(`SELECT * FROM seasons WHERE season=? ${competition ? 'AND competition=?' : ''} ORDER BY competition LIMIT 1`).get(...(competition ? [season, competition] : [season])) as any;
  if (!seasonRow) return { stored: 0, requests: 0, errors: [`Stagione ${season} non presente nel database`] };
  const comp = String(seasonRow.competition);
  const rows = db.prepare(`SELECT id,source_external_id,external_key FROM matches WHERE season=? AND (competition=? OR competition IS NULL) ORDER BY date`).all(season, comp) as any[];
  const items = rows.map(m => ({ ...m, fixtureId: nInt(m.source_external_id) ?? nInt(String(m.external_key ?? '').replace(/^api-football:/, '')) })).filter(m => m.fixtureId);
  if (!items.length) return { stored: 0, requests: 0, errors: ['Nessuna partita con fixture ID API-Football. Sincronizza prima le fixtures della stagione.'] };

  const byFixture = new Map(items.map(m => [Number(m.fixtureId), Number(m.id)]));
  let stored = 0, requests = 0;
  const errors: string[] = [];
  for (let i = 0; i < items.length; i += 20) {
    const chunk = items.slice(i, i + 20);
    const ids = chunk.map(m => m.fixtureId).join('-');
    const r = await apiRequest<any>('fixture-details', '/fixtures', { ids });
    requests += r.meta.requests;
    if (!r.ok) { errors.push(r.error); continue; }
    for (const row of r.data?.response ?? []) {
      const fixtureId = nInt(row?.fixture?.id);
      const matchId = fixtureId ? byFixture.get(fixtureId) : null;
      if (!matchId) continue;
      if (persistFixtureDetails(matchId, row)) stored++;
    }
  }
  return { stored, total: items.length, requests, errors };
}

export async function syncApiFootballPlayersForSeason(season: string, competition?: string) {
  const seasonRow = db.prepare(`SELECT * FROM seasons WHERE season=? ${competition ? 'AND competition=?' : ''} ORDER BY competition LIMIT 1`).get(...(competition ? [season, competition] : [season])) as any;
  if (!seasonRow) return { stored: 0, requests: 0, errors: [`Stagione ${season} non presente nel database`] };
  const comp = String(seasonRow.competition);
  const t = await ensureSassuoloTeamId(); if (!t.ok) return { stored: 0, requests: t.requests, errors: [t.error] };
  const l = await resolveLeagueForSeason(season, comp); if (!l.ok) return { stored: 0, requests: t.requests + l.requests, errors: [l.error] };
  if (l.coverage?.players === false) return { stored: 0, requests: t.requests + l.requests, errors: [`API-Football segnala players=false nella coverage di ${season} ${comp}`] };
  let page = 1, total = 1, stored = 0, requests = t.requests + l.requests; const errors: string[] = [];
  do {
    const r = await apiRequest<any>('players', '/players', { team: t.teamId, league: l.leagueId, season: l.year, page }); requests += r.meta.requests;
    if (!r.ok) { errors.push(r.error); break; }
    total = nInt(r.data?.paging?.total) ?? 1;
    for (const row of r.data?.response ?? []) {
      const player = row?.player; const stats = Array.isArray(row?.statistics) ? row.statistics : [];
      const stat = stats.find((s: any) => Number(s?.league?.id) === l.leagueId && Number(s?.team?.id) === t.teamId) ?? stats.find((s: any) => Number(s?.league?.id) === l.leagueId) ?? stats[0];
      if (!player || !stat) continue;
      const id = upsertPlayer(player, { position: stat?.games?.position, number: stat?.games?.number });
      if (id && upsertPlayerSeason(id, season, comp, l.leagueId, stat)) stored++;
    }
    page++;
  } while (page <= total && page <= 3);

  if (total > 3) {
    errors.push(
      `API-Football Free limita /players a page=3. ` +
      `Importate le prime ${Math.min(total, 3)} pagine su ${total}.`
    );
  }

  if (stored) recomputeDerivedPlayerStats();

  return {
    stored,
    pages: Math.min(total, 3),
    requests,
    errors
  };
}

export async function syncApiFootballStandingsForSeason(season: string, competition?: string) {
  const seasonRow = db.prepare(`SELECT * FROM seasons WHERE season=? ${competition ? 'AND competition=?' : ''} ORDER BY competition LIMIT 1`).get(...(competition ? [season, competition] : [season])) as any;
  if (!seasonRow) return { stored: 0, requests: 0, errors: [`Stagione ${season} non presente nel database`] };
  const comp = String(seasonRow.competition); const l = await resolveLeagueForSeason(season, comp); if (!l.ok) return { stored: 0, requests: l.requests, errors: [l.error] };
  if (l.coverage?.standings === false) return { stored: 0, requests: l.requests, errors: [`API-Football segnala standings=false nella coverage di ${season} ${comp}`] };
  const t = await ensureSassuoloTeamId(); if (!t.ok) return { stored: 0, requests: l.requests + t.requests, errors: [t.error] };
  const r = await apiRequest<any>('standings', '/standings', { league: l.leagueId, season: l.year }); if (!r.ok) return { stored: 0, requests: l.requests + t.requests + r.meta.requests, errors: [r.error] };
  const groups = r.data?.response?.[0]?.league?.standings ?? [];
  db.prepare(`DELETE FROM season_standings WHERE season=? AND competition=? AND source_provider=?`).run(season, comp, PROVIDER);
  const insert = db.prepare(`INSERT INTO season_standings(season,competition,api_football_league_id,api_football_team_id,team_name,team_logo,rank,points,goals_diff,form,status,description,group_name,played,wins,draws,losses,goals_for,goals_against,home_played,home_wins,home_draws,home_losses,home_goals_for,home_goals_against,away_played,away_wins,away_draws,away_losses,away_goals_for,away_goals_against,source_provider,last_verified_at)
    VALUES(@season,@competition,@league,@team,@name,@logo,@rank,@points,@diff,@form,@status,@description,@group_name,@played,@wins,@draws,@losses,@gf,@ga,@hp,@hw,@hd,@hl,@hgf,@hga,@ap,@aw,@ad,@al,@agf,@aga,@provider,@verified)`);
  let stored = 0, sass: any = null;
  for (const group of groups) { for (const x of group ?? []) { const all = x?.all ?? {}, home = x?.home ?? {}, away = x?.away ?? {}; insert.run({ season, competition: comp, league: l.leagueId, team: nInt(x?.team?.id), name: x?.team?.name ?? 'N/D', logo: x?.team?.logo ?? null, rank: nInt(x?.rank), points: nInt(x?.points), diff: nInt(x?.goalsDiff), form: x?.form ?? null, status: x?.status ?? null, description: x?.description ?? null, group_name: x?.group ?? '', played: nInt(all?.played), wins: nInt(all?.win), draws: nInt(all?.draw), losses: nInt(all?.lose), gf: nInt(all?.goals?.for), ga: nInt(all?.goals?.against), hp: nInt(home?.played), hw: nInt(home?.win), hd: nInt(home?.draw), hl: nInt(home?.lose), hgf: nInt(home?.goals?.for), hga: nInt(home?.goals?.against), ap: nInt(away?.played), aw: nInt(away?.win), ad: nInt(away?.draw), al: nInt(away?.lose), agf: nInt(away?.goals?.for), aga: nInt(away?.goals?.against), provider: PROVIDER, verified: nowIso() }); stored++; if (Number(x?.team?.id) === t.teamId) sass = x; } }
  if (sass && seasonRow.source_provider !== 'manual') {
    const all = sass.all ?? {}, home = sass.home ?? {}, away = sass.away ?? {};
    const homeRecord = [home.win, home.draw, home.lose].every((v: any) => v != null) ? `${home.win}-${home.draw}-${home.lose}` : null;
    const awayRecord = [away.win, away.draw, away.lose].every((v: any) => v != null) ? `${away.win}-${away.draw}-${away.lose}` : null;
    db.prepare(`UPDATE seasons SET final_position=?,matches=?,wins=?,draws=?,losses=?,goals_for=?,goals_against=?,points=?,home_record=?,away_record=?,last_verified_at=? WHERE id=?`)
      .run(nInt(sass.rank), nInt(all.played), nInt(all.win), nInt(all.draw), nInt(all.lose), nInt(all?.goals?.for), nInt(all?.goals?.against), nInt(sass.points), homeRecord, awayRecord, nowIso(), seasonRow.id);
  }
  return { stored, requests: l.requests + t.requests + r.meta.requests, errors: [] };
}

export async function syncApiFootballTeamStatsForSeason(season: string, competition?: string) {
  const seasonRow = db.prepare(`SELECT * FROM seasons WHERE season=? ${competition ? 'AND competition=?' : ''} ORDER BY competition LIMIT 1`).get(...(competition ? [season, competition] : [season])) as any;
  if (!seasonRow) return { stored: 0, requests: 0, errors: [`Stagione ${season} non presente nel database`] };
  const comp = String(seasonRow.competition); const l = await resolveLeagueForSeason(season, comp); if (!l.ok) return { stored: 0, requests: l.requests, errors: [l.error] }; const t = await ensureSassuoloTeamId(); if (!t.ok) return { stored: 0, requests: l.requests + t.requests, errors: [t.error] };
  const r = await apiRequest<any>('team-stats', '/teams/statistics', { league: l.leagueId, season: l.year, team: t.teamId }); if (!r.ok) return { stored: 0, requests: l.requests + t.requests + r.meta.requests, errors: [r.error] };
  const x = r.data?.response; if (!x || !Object.keys(x).length) return { stored: 0, requests: l.requests + t.requests + r.meta.requests, errors: ['Nessuna statistica squadra restituita'] };
  const played = x?.fixtures?.played?.total, wins = x?.fixtures?.wins?.total, draws = x?.fixtures?.draws?.total, losses = x?.fixtures?.loses?.total;
  db.prepare(`INSERT INTO team_season_stats(season,competition,api_football_league_id,form,played,wins,draws,losses,goals_for,goals_against,goals_for_avg,goals_against_avg,clean_sheets,failed_to_score,biggest_win_home,biggest_win_away,biggest_loss_home,biggest_loss_away,longest_win_streak,longest_draw_streak,longest_loss_streak,penalties_scored,penalties_missed,lineups_json,raw_json,source_provider,last_verified_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(season,competition) DO UPDATE SET api_football_league_id=excluded.api_football_league_id,form=excluded.form,played=excluded.played,wins=excluded.wins,draws=excluded.draws,losses=excluded.losses,goals_for=excluded.goals_for,goals_against=excluded.goals_against,goals_for_avg=excluded.goals_for_avg,goals_against_avg=excluded.goals_against_avg,clean_sheets=excluded.clean_sheets,failed_to_score=excluded.failed_to_score,biggest_win_home=excluded.biggest_win_home,biggest_win_away=excluded.biggest_win_away,biggest_loss_home=excluded.biggest_loss_home,biggest_loss_away=excluded.biggest_loss_away,longest_win_streak=excluded.longest_win_streak,longest_draw_streak=excluded.longest_draw_streak,longest_loss_streak=excluded.longest_loss_streak,penalties_scored=excluded.penalties_scored,penalties_missed=excluded.penalties_missed,lineups_json=excluded.lineups_json,raw_json=excluded.raw_json,source_provider=excluded.source_provider,last_verified_at=excluded.last_verified_at`)
    .run(season, comp, l.leagueId, x?.form ?? null, nInt(played), nInt(wins), nInt(draws), nInt(losses), nInt(x?.goals?.for?.total?.total), nInt(x?.goals?.against?.total?.total), nNum(x?.goals?.for?.average?.total), nNum(x?.goals?.against?.average?.total), nInt(x?.clean_sheet?.total), nInt(x?.failed_to_score?.total), x?.biggest?.wins?.home ?? null, x?.biggest?.wins?.away ?? null, x?.biggest?.loses?.home ?? null, x?.biggest?.loses?.away ?? null, nInt(x?.biggest?.streak?.wins), nInt(x?.biggest?.streak?.draws), nInt(x?.biggest?.streak?.loses), nInt(x?.penalty?.scored?.total), nInt(x?.penalty?.missed?.total), JSON.stringify(x?.lineups ?? []), JSON.stringify(x), PROVIDER, nowIso());
  return { stored: 1, requests: l.requests + t.requests + r.meta.requests, errors: [] };
}

export async function syncApiFootballTransfers() {
  const t = await ensureSassuoloTeamId(); if (!t.ok) return { stored: 0, requests: t.requests, errors: [t.error] };
  const r = await apiRequest<any>('transfers', '/transfers', { team: t.teamId }); if (!r.ok) return { stored: 0, requests: t.requests + r.meta.requests, errors: [r.error] };
  const stmt = db.prepare(`INSERT INTO transfers(external_key,player_id,api_football_player_id,player_name,date,type,direction,from_team_id,from_team_name,from_team_logo,to_team_id,to_team_name,to_team_logo,season,movement_type,session,source_provider,last_verified_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(external_key) DO UPDATE SET player_id=COALESCE(excluded.player_id,transfers.player_id),type=COALESCE(excluded.type,transfers.type),direction=excluded.direction,from_team_name=excluded.from_team_name,from_team_logo=excluded.from_team_logo,to_team_name=excluded.to_team_name,to_team_logo=excluded.to_team_logo,season=excluded.season,movement_type=excluded.movement_type,session=excluded.session,last_verified_at=excluded.last_verified_at WHERE COALESCE(transfers.source_provider,'') <> 'manual'`);
  const logical = db.prepare(`SELECT id,external_key,source_provider,date,season FROM transfers WHERE lower(trim(player_name))=lower(trim(?)) AND lower(trim(ifnull(from_team_name,'')))=lower(trim(ifnull(?,''))) AND lower(trim(ifnull(to_team_name,'')))=lower(trim(ifnull(?,''))) AND lower(trim(ifnull(type,'')))=lower(trim(ifnull(?,''))) AND direction=? AND (ifnull(season,'')=ifnull(?, '') OR (season IS NULL AND ? IS NOT NULL AND date IS NOT NULL AND ? IS NOT NULL AND abs(julianday(date)-julianday(?))<=3)) ORDER BY CASE WHEN season IS NOT NULL THEN 0 ELSE 1 END,date DESC,id DESC LIMIT 1`);
  const merge = db.prepare(`UPDATE transfers SET player_id=?,api_football_player_id=?,date=?,type=?,direction=?,from_team_id=?,from_team_name=?,from_team_logo=?,to_team_id=?,to_team_name=?,to_team_logo=?,season=?,movement_type=?,session=?,source_provider=?,last_verified_at=? WHERE id=?`);
  let stored = 0;
  for (const row of r.data?.response ?? []) { const p = row?.player ?? {}; const playerId = upsertPlayer(p); for (const tr of row?.transfers ?? []) { const from = tr?.teams?.out ?? {}, to = tr?.teams?.in ?? {}; const direction = Number(to?.id) === t.teamId ? 'IN' : Number(from?.id) === t.teamId ? 'OUT' : 'OTHER'; if (direction === 'OTHER') continue; const date = tr?.date ?? null; const type = tr?.type ?? null; const season = transferSeason(date); const lowerType=String(type??'').toLowerCase();const movementType=lowerType.includes('loan')&&lowerType.includes('return')?'RETURN':lowerType.includes('loan')?'LOAN':lowerType.includes('free')?'FREE':'TRANSFER';const month=Number(String(date??'').slice(5,7));const session=Number.isFinite(month)&&month>0?(month<=2?'WINTER':'SUMMER'):null; const fromName = from?.name ?? null; const toName = to?.name ?? null; const key = `api-football|${p?.id ?? p?.name}|${date ?? ''}|${from?.id ?? ''}|${to?.id ?? ''}|${type ?? ''}`; const existing = logical.get(p?.name ?? 'N/D',fromName,toName,type,direction,season,season,date,date) as any; if (existing?.source_provider === 'manual') continue; if (existing) { const canonicalDate = existing.date && date ? (existing.date > date ? existing.date : date) : existing.date ?? date; merge.run(playerId, nInt(p?.id), canonicalDate, type, direction, nInt(from?.id), fromName, from?.logo ?? null, nInt(to?.id), toName, to?.logo ?? null, season,movementType,session, PROVIDER, nowIso(), existing.id); } else { stmt.run(key, playerId, nInt(p?.id), p?.name ?? 'N/D', date, type, direction, nInt(from?.id), fromName, from?.logo ?? null, nInt(to?.id), toName, to?.logo ?? null, season,movementType,session, PROVIDER, nowIso()); } stored++; } }
  return { stored, requests: t.requests + r.meta.requests, errors: [] };
}

export async function syncApiFootballCoach() {
  const t = await ensureSassuoloTeamId(); if (!t.ok) return { stored: 0, requests: t.requests, errors: [t.error] };
  const r = await apiRequest<any>('coach', '/coachs', { team: t.teamId }); if (!r.ok) return { stored: 0, requests: t.requests + r.meta.requests, errors: [r.error] };
  const coaches = r.data?.response ?? []; const coach = coaches.find((c: any) => Number(c?.team?.id) === t.teamId) ?? coaches[0];
  if (!coach?.name) return { stored: 0, requests: t.requests + r.meta.requests, errors: ['Nessun allenatore restituito'] };
  const latest = db.prepare(`SELECT * FROM seasons ORDER BY substr(season,1,4) DESC LIMIT 1`).get() as any;
  if (latest && latest.source_provider !== 'manual') db.prepare(`UPDATE seasons SET manager=?,last_verified_at=? WHERE id=?`).run(coach.name, nowIso(), latest.id);
  return { stored: latest ? 1 : 0, coach: { id: coach.id, name: coach.name, nationality: coach.nationality, photo: coach.photo }, requests: t.requests + r.meta.requests, errors: [] };
}

export async function syncApiFootballSeason(season: string) {
  const rows = db.prepare(`
    SELECT competition
    FROM seasons
    WHERE season=?
    ORDER BY CASE competition
      WHEN 'Serie A' THEN 0
      WHEN 'Serie B' THEN 1
      WHEN 'Coppa Italia' THEN 2
      ELSE 3
    END
  `).all(season) as { competition: string }[];

  if (!rows.length) {
    return { season, errors: [`Stagione ${season} non trovata`], requests: 0 };
  }

  // Nell'architettura ibrida API-Football NON gestisce più le partite.
  // I match e i loro dettagli sono responsabilità esclusiva di KickoffAPI v1.
  // A season can have league and cup rows; enrich every competition instead
  // of silently choosing Serie A/Serie B and leaving Coppa Italia empty.
  const competitions: any[] = [];
  for (const row of rows) {
    const standings = await syncApiFootballStandingsForSeason(season, row.competition);
    const teamStats = await syncApiFootballTeamStatsForSeason(season, row.competition);
    const players = await syncApiFootballPlayersForSeason(season, row.competition);
    competitions.push({ competition: row.competition, standings, teamStats, players });
  }

  return {
    season,
    competitions,
    requests: competitions.reduce((total, x) => total + (x.standings.requests ?? 0) + (x.teamStats.requests ?? 0) + (x.players.requests ?? 0), 0),
    errors: competitions.flatMap(x => [
      ...(x.standings.errors ?? []).map((e: string) => `${x.competition}: ${e}`),
      ...(x.teamStats.errors ?? []).map((e: string) => `${x.competition}: ${e}`),
      ...(x.players.errors ?? []).map((e: string) => `${x.competition}: ${e}`)
    ])
  };
}

export async function syncApiFootballCurrent() {
  const latest = db.prepare(`SELECT season,competition FROM seasons ORDER BY substr(season,1,4) DESC LIMIT 1`).get() as { season: string; competition: string } | undefined;
  if (!latest) return { errors: ['Nessuna stagione nel database'] };
  const squad = await syncApiFootballSquad();
  const season = await syncApiFootballSeason(latest.season);
  const transfers = await syncApiFootballTransfers();
  const coach = await syncApiFootballCoach();
  return { currentSeason: latest.season, squad, season, transfers, coach, errors: [...(squad.errors ?? []), ...(season.errors ?? []), ...(transfers.errors ?? []), ...(coach.errors ?? [])] };
}

export async function testApiFootball() {
  if (!enabled()) return { ok: false, configured: false, error: 'API-Football disabilitata' };
  if (!apiKey()) return { ok: false, configured: false, error: 'API_FOOTBALL_KEY non configurata' };
  const t = await ensureSassuoloTeamId();
  if (!t.ok) return { ok: false, configured: true, error: t.error };
  const verify = await apiRequest<any>('team', '/teams', { id: t.teamId });
  if (!verify.ok) return { ok: false, configured: true, teamId: t.teamId, error: verify.error };
  const team = verify.data?.response?.[0]?.team;
  return { ok: true, configured: true, teamId: t.teamId, teamName: team?.name ?? 'Sassuolo', quotaRemaining: verify.meta.remaining, message: 'Connessione riuscita e Sassuolo identificato.' };
}

export function apiFootballStatus() {
  const quota = db.prepare(`SELECT estimated_remaining,last_request,last_successful_sync,last_error FROM sync_state WHERE provider=? ORDER BY last_request DESC LIMIT 1`).get(PROVIDER) as any;
  const teamId = getCachedTeamId();
  const mappings = db.prepare(`SELECT season,competition,api_football_league_id,api_football_season_year,api_football_coverage_json FROM seasons ORDER BY substr(season,1,4) DESC`).all() as any[];
  return { configured: Boolean(apiKey()) && enabled(), enabled: enabled(), teamId, quotaRemaining: quota?.estimated_remaining ?? null, lastRequest: quota?.last_request ?? null, lastSuccess: quota?.last_successful_sync ?? null, lastError: quota?.last_error ?? null, mappings: mappings.map(x => ({ ...x, coverage: x.api_football_coverage_json ? JSON.parse(x.api_football_coverage_json) : null })) };
}
