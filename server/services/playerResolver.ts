import { createBackupSnapshot, db, normalizeNameForMatch, nowIso, recordChange } from '../db/database.js';

type ResolveInput = {
  name: string;
  sourceProvider?: string | null;
  sourcePlayerId?: string | number | null;
  sourceUrl?: string | null;
  context?: string | null;
  allowCreate?: boolean;
};

type ResolveResult =
  | { status: 'resolved'; playerId: number; matchedBy: 'source-id' | 'alias' | 'canonical' | 'strict-full-name' | 'strict-abbreviation'; canonicalName: string }
  | { status: 'conflict'; conflictId: number; reason: string; normalizedName: string; candidates: Array<{ id: number; name: string }> }
  | { status: 'created'; playerId: number; canonicalName: string };

function scalarText(value: unknown) {
  if (value == null) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function listCandidatesBySurname(surname: string) {
  return db.prepare(`SELECT id,name FROM players WHERE lower(name) LIKE ? ORDER BY name`).all(`% ${surname.toLowerCase()}`) as Array<{ id: number; name: string }>;
}

function recordAlias(playerId: number, alias: string, sourceProvider?: string | null, note?: string | null) {
  const normalized = normalizeNameForMatch(alias);
  if (!normalized) return;
  db.prepare(`INSERT INTO player_name_aliases(player_id,alias,alias_normalized,source_provider,note)
    VALUES(?,?,?,?,?)
    ON CONFLICT(alias_normalized) DO UPDATE SET
      player_id=excluded.player_id,
      alias=excluded.alias,
      source_provider=COALESCE(excluded.source_provider,player_name_aliases.source_provider),
      note=COALESCE(excluded.note,player_name_aliases.note)`)
    .run(playerId, alias.trim(), normalized, sourceProvider ?? null, note ?? null);
}

function enqueueConflict(input: { rawName: string; sourceProvider?: string | null; sourcePlayerId?: string | number | null; sourceUrl?: string | null; context?: string | null; normalizedName: string; reason: string; candidates?: Array<{ id: number; name: string }> }) {
  const payload = input.candidates?.length ? JSON.stringify(input.candidates) : null;
  const existing = db.prepare(`SELECT id FROM player_match_conflicts
    WHERE raw_name=? AND ifnull(source_provider,'')=ifnull(?, '') AND ifnull(source_player_id,'')=ifnull(?, '')
      AND ifnull(context,'')=ifnull(?, '') AND status='open'
    ORDER BY id DESC LIMIT 1`).get(
    input.rawName,
    input.sourceProvider ?? null,
    scalarText(input.sourcePlayerId),
    input.context ?? null,
  ) as { id: number } | undefined;
  if (existing) return existing.id;
  const result = db.prepare(`INSERT INTO player_match_conflicts(
    raw_name,normalized_name,source_provider,source_player_id,source_url,context,status,candidates_json,reason,created_at,updated_at
  ) VALUES(?,?,?,?,?,?,?,?,?,?,?)`).run(
    input.rawName,
    input.normalizedName,
    input.sourceProvider ?? null,
    scalarText(input.sourcePlayerId),
    input.sourceUrl ?? null,
    input.context ?? null,
    'open',
    payload,
    input.reason,
    nowIso(),
    nowIso(),
  );
  return Number(result.lastInsertRowid);
}

export function seedHistoricalPlayerAliases() {
  const canonicalByName = new Map((db.prepare(`SELECT id,name FROM players`).all() as Array<{ id: number; name: string }>).map(row => [normalizeNameForMatch(row.name), row]));
  const groups = [
    ['Armand Laurienté', ['A. Laurienté', 'Armand Lauriente', 'Armand Laurienté']],
    ['Nicolás Schiappacasse', ['Nicolás Schiappacasse', 'Nicolas Schiappacasse']],
    ['Nicola Sansone', ['Nicola Sansone']],
    ['Marcello Trotta', ['Marcello Trotta']],
    ['Mert Müldür', ['Mert Müldür', 'Mert Muldur']],
    ['Maxime Lopez', ['Maxime Lopez', 'Maxime López']],
    ['Gian Marco Ferrari', ['Gian Marco Ferrari', 'Gianmarco Ferrari']],
    ['Francesco Caputo', ['Francesco Caputo']],
    ['Antonino Ragusa', ['Antonino Ragusa']],
    ['Filip Djuricic', ['Filip Djuricic', 'Filip Đuričić']],
  ] as const;
  for (const [canonical, aliases] of groups) {
    const player = canonicalByName.get(normalizeNameForMatch(canonical));
    if (!player) continue;
    for (const alias of aliases) recordAlias(player.id, alias, 'historical-reconciliation', 'Historical alias backfill');
  }
}

export function resolvePlayer(input: ResolveInput): ResolveResult {
  const rawName = String(input.name ?? '').trim();
  if (!rawName) {
    const conflictId = enqueueConflict({ rawName: '', sourceProvider: input.sourceProvider, sourcePlayerId: input.sourcePlayerId, sourceUrl: input.sourceUrl, context: input.context, normalizedName: '', reason: 'empty-name' });
    return { status: 'conflict', conflictId, reason: 'empty-name', normalizedName: '', candidates: [] };
  }
  const normalizedName = normalizeNameForMatch(rawName);
  const sourceProvider = scalarText(input.sourceProvider);
  const sourcePlayerId = scalarText(input.sourcePlayerId);
  if (sourceProvider && sourcePlayerId) {
    const bySource = db.prepare(`SELECT p.id,p.name FROM player_source_ids psi JOIN players p ON p.id=psi.player_id WHERE psi.source_provider=? AND psi.source_player_id=? LIMIT 1`).get(sourceProvider, sourcePlayerId) as { id: number; name: string } | undefined;
    if (bySource) return { status: 'resolved', playerId: bySource.id, matchedBy: 'source-id', canonicalName: bySource.name };
  }
  const byAlias = db.prepare(`SELECT p.id,p.name FROM player_name_aliases a JOIN players p ON p.id=a.player_id WHERE a.alias_normalized=? LIMIT 1`).get(normalizedName) as { id: number; name: string } | undefined;
  if (byAlias) return { status: 'resolved', playerId: byAlias.id, matchedBy: 'alias', canonicalName: byAlias.name };
  const exactNormalized = db.prepare(`SELECT id,name FROM players`).all() as Array<{ id: number; name: string }>;
  const canonicalMatches = exactNormalized.filter(player => normalizeNameForMatch(player.name) === normalizedName);
  if (canonicalMatches.length === 1) {
    if (sourceProvider && sourcePlayerId) {
      const knownIds = db.prepare(`SELECT source_player_id FROM player_source_ids WHERE player_id=? AND source_provider=?`).all(canonicalMatches[0].id, sourceProvider) as Array<{ source_player_id: string }>;
      const canonical = db.prepare(`SELECT source_provider,source_external_id FROM players WHERE id=?`).get(canonicalMatches[0].id) as { source_provider: string | null; source_external_id: string | null } | undefined;
      const providerIds = new Set(knownIds.map(row => String(row.source_player_id)));
      if (canonical?.source_provider === sourceProvider && canonical.source_external_id) providerIds.add(String(canonical.source_external_id));
      if (providerIds.size > 0 && !providerIds.has(sourcePlayerId)) {
        const conflictId = enqueueConflict({ rawName, sourceProvider, sourcePlayerId, sourceUrl: input.sourceUrl, context: input.context, normalizedName, reason: 'canonical-name-source-id-mismatch', candidates: canonicalMatches });
        return { status: 'conflict', conflictId, reason: 'canonical-name-source-id-mismatch', normalizedName, candidates: canonicalMatches };
      }
    }
    recordAlias(canonicalMatches[0].id, rawName, sourceProvider, 'Auto-learned from canonical normalized match');
    return { status: 'resolved', playerId: canonicalMatches[0].id, matchedBy: 'canonical', canonicalName: canonicalMatches[0].name };
  }
  if (canonicalMatches.length > 1) {
    const conflictId = enqueueConflict({ rawName, sourceProvider, sourcePlayerId, sourceUrl: input.sourceUrl, context: input.context, normalizedName, reason: 'multiple-canonical-normalized-matches', candidates: canonicalMatches });
    return { status: 'conflict', conflictId, reason: 'multiple-canonical-normalized-matches', normalizedName, candidates: canonicalMatches };
  }
  const parts = normalizedName.split(' ').filter(Boolean);
  if (parts.length >= 2) {
    const surname = parts[parts.length - 1];
    const strictMatches = listCandidatesBySurname(surname).filter(candidate => normalizeNameForMatch(candidate.name) === normalizedName);
    if (strictMatches.length === 1) {
      recordAlias(strictMatches[0].id, rawName, sourceProvider, 'Auto-learned from strict full-name match');
      return { status: 'resolved', playerId: strictMatches[0].id, matchedBy: 'strict-full-name', canonicalName: strictMatches[0].name };
    }
  }
  const abbreviation = rawName.match(/^([A-Za-zÀ-ÖØ-öø-ÿ])\.\s+(.+)$/u);
  if (abbreviation) {
    const surname = normalizeNameForMatch(abbreviation[2]);
    const candidates = listCandidatesBySurname(surname).filter(candidate => {
      const firstToken = candidate.name.split(/\s+/)[0] ?? '';
      return normalizeNameForMatch(firstToken).startsWith(normalizeNameForMatch(abbreviation[1]));
    });
    if (candidates.length === 1) {
      recordAlias(candidates[0].id, rawName, sourceProvider, 'Auto-learned from strict abbreviation match');
      return { status: 'resolved', playerId: candidates[0].id, matchedBy: 'strict-abbreviation', canonicalName: candidates[0].name };
    }
    const conflictId = enqueueConflict({ rawName, sourceProvider, sourcePlayerId, sourceUrl: input.sourceUrl, context: input.context, normalizedName, reason: candidates.length ? 'ambiguous-abbreviation' : 'unmatched-abbreviation', candidates });
    return { status: 'conflict', conflictId, reason: candidates.length ? 'ambiguous-abbreviation' : 'unmatched-abbreviation', normalizedName, candidates };
  }
  if (input.allowCreate) {
    // Never auto-create a likely duplicate: a manager must choose the identity.
    const surname = normalizedName.split(' ').at(-1) ?? normalizedName;
    const sameSurname = listCandidatesBySurname(surname);
    const looksAbbreviated = /^\p{L}\.\s+/u.test(rawName);
    if (looksAbbreviated || sameSurname.length > 0) {
      const conflictId = enqueueConflict({ rawName, sourceProvider, sourcePlayerId, sourceUrl: input.sourceUrl, context: input.context, normalizedName, reason: looksAbbreviated ? 'unmatched-abbreviation' : 'possible-duplicate-surname', candidates: sameSurname });
      return { status: 'conflict', conflictId, reason: looksAbbreviated ? 'unmatched-abbreviation' : 'possible-duplicate-surname', normalizedName, candidates: sameSurname };
    }
    const result = db.prepare(`INSERT INTO players(name,source_provider,source_url,last_verified_at) VALUES(?,?,?,?)`).run(rawName, sourceProvider ?? 'manual-import', input.sourceUrl ?? null, nowIso());
    const playerId = Number(result.lastInsertRowid);
    recordAlias(playerId, rawName, sourceProvider, 'Initial self-alias for newly created player');
    if (sourceProvider && sourcePlayerId) {
      db.prepare(`INSERT INTO player_source_ids(player_id,source_provider,source_player_id,source_url,last_verified_at)
        VALUES(?,?,?,?,?)
        ON CONFLICT(source_provider,source_player_id) DO UPDATE SET
          player_id=excluded.player_id,
          source_url=COALESCE(excluded.source_url,player_source_ids.source_url),
          last_verified_at=excluded.last_verified_at`)
        .run(playerId, sourceProvider, sourcePlayerId, input.sourceUrl ?? null, nowIso());
    }
    return { status: 'created', playerId, canonicalName: rawName };
  }
  const conflictId = enqueueConflict({ rawName, sourceProvider, sourcePlayerId, sourceUrl: input.sourceUrl, context: input.context, normalizedName, reason: 'no-safe-match' });
  return { status: 'conflict', conflictId, reason: 'no-safe-match', normalizedName, candidates: [] };
}

type IdentityDecision={action:'merge'|'create'|'reject'|'defer';playerId?:number;name?:string;firstname?:string;lastname?:string;reviewer:string;note:string};

export function resolvePlayerIdentityConflict(conflictId: number, decision: IdentityDecision) {
  const conflict = db.prepare('SELECT * FROM player_match_conflicts WHERE id=? AND status=\'open\'').get(conflictId) as any;
  if (!conflict) throw new Error('Conflitto giocatore non trovato o già risolto');
  if (!decision.reviewer.trim() || !decision.note.trim()) throw new Error('Revisore e motivazione sono obbligatori');
  if (decision.action === 'defer') {
    db.prepare(`UPDATE player_match_conflicts SET resolution_action='defer',reviewer=?,resolution_note=?,updated_at=? WHERE id=?`).run(decision.reviewer.trim(),decision.note.trim(),nowIso(),conflictId);
    recordChange({entityType:'player_match_conflicts',entityId:conflictId,action:'update',before:conflict,after:{status:'open',action:'defer'},note:decision.note,author:decision.reviewer});
    return {conflictId,deferred:true};
  }
  const backup=createBackupSnapshot(`before-player-identity-${conflictId}-${decision.action}`);
  if (decision.action === 'reject') {
    const resolvedAt=nowIso();
    db.prepare("UPDATE player_match_conflicts SET status='ignored',resolution_action='reject',reviewer=?,resolution_note=?,resolved_at=?,backup_id=?,decision_json=?,updated_at=? WHERE id=?").run(decision.reviewer.trim(),decision.note.trim(),resolvedAt,backup.id,JSON.stringify({action:'reject'}),resolvedAt,conflictId);
    recordChange({ entityType: 'player_match_conflicts', entityId: conflictId, action: 'delete', before: conflict, after: { status: 'ignored' }, note: decision.note,author:decision.reviewer,backupId:backup.id });
    return { conflictId, rejected: true,backupId:backup.id };
  }
  let playerId: number;
  const normalized=normalizeNameForMatch(conflict.raw_name);
  const aliasBefore=normalized?db.prepare(`SELECT * FROM player_name_aliases WHERE alias_normalized=?`).get(normalized)??null:null;
  const sourceBefore=conflict.source_provider&&conflict.source_player_id?db.prepare(`SELECT * FROM player_source_ids WHERE source_provider=? AND source_player_id=?`).get(conflict.source_provider,conflict.source_player_id)??null:null;
  let createdPlayer=false;
  if (decision.action === 'merge') {
    if (!decision.playerId) throw new Error('playerId obbligatorio per unire il conflitto');
    const target = db.prepare('SELECT id,name FROM players WHERE id=?').get(decision.playerId) as { id: number; name: string } | undefined;
    if (!target) throw new Error('Giocatore di destinazione non trovato');
    playerId = target.id;
    recordAliasForConflict(playerId, conflict);
  } else {
    const name = String(decision.name ?? conflict.raw_name).trim();
    if (!name) throw new Error('Nome obbligatorio per creare il giocatore');
    const result = db.prepare('INSERT INTO players(name,firstname,lastname,source_provider,source_external_id,source_url,current_squad,last_verified_at) VALUES(?,?,?,?,?,?,?,?)').run(name, decision.firstname ?? null, decision.lastname ?? null, conflict.source_provider ?? 'manual', conflict.source_player_id ?? null, conflict.source_url ?? null, /^(api-football|thesportsdb):/.test(String(conflict.context ?? '')) ? 1 : 0, nowIso());
    playerId = Number(result.lastInsertRowid);
    createdPlayer=true;
    recordAliasForConflict(playerId, conflict);
  }
  if (conflict.source_provider && conflict.source_player_id) {
    db.prepare(`INSERT INTO player_source_ids(player_id,source_provider,source_player_id,source_url,last_verified_at) VALUES(?,?,?,?,?) ON CONFLICT(source_provider,source_player_id) DO UPDATE SET player_id=excluded.player_id,source_url=COALESCE(excluded.source_url,player_source_ids.source_url),last_verified_at=excluded.last_verified_at`).run(playerId, conflict.source_provider, conflict.source_player_id, conflict.source_url, nowIso());
  }
  if (/^(api-football|thesportsdb):/.test(String(conflict.context ?? ''))) db.prepare('UPDATE players SET current_squad=1 WHERE id=?').run(playerId);
  const resolvedAt=nowIso();const decisionRecord={action:decision.action,playerId,createdPlayer,aliasBefore,sourceBefore};
  db.prepare(`UPDATE player_match_conflicts SET status='resolved',resolution_action=?,resolved_player_id=?,reviewer=?,resolution_note=?,resolved_at=?,backup_id=?,decision_json=?,updated_at=? WHERE id=?`).run(decision.action,playerId,decision.reviewer.trim(),decision.note.trim(),resolvedAt,backup.id,JSON.stringify(decisionRecord),resolvedAt,conflictId);
  recordChange({ entityType: 'player_match_conflicts', entityId: conflictId, action: 'resolve-conflict', before: conflict, after: decisionRecord, note: decision.note,author:decision.reviewer,backupId:backup.id });
  return { conflictId, playerId,backupId:backup.id };
}

export function reopenPlayerIdentityConflict(conflictId:number,reviewer:string,note:string){
  const conflict=db.prepare(`SELECT * FROM player_match_conflicts WHERE id=? AND status<>'open'`).get(conflictId) as any;
  if(!conflict)throw new Error('Decisione identità non trovata o già aperta');
  if(!reviewer.trim()||!note.trim())throw new Error('Revisore e motivazione sono obbligatori');
  const decision=JSON.parse(conflict.decision_json||'{}') as any,backup=createBackupSnapshot(`before-reopen-player-identity-${conflictId}`);
  db.transaction(()=>{
    if(decision.createdPlayer){
      const refs=['player_seasons','match_player_stats','transfers','match_injuries','match_events'].reduce((total,table)=>total+Number((db.prepare(`SELECT COUNT(*) AS total FROM ${table} WHERE player_id=?`).get(decision.playerId) as any)?.total??0),0);
      if(refs>0)throw new Error('Il profilo creato ha acquisito dati: usare il ripristino del backup associato alla decisione');
      db.prepare(`DELETE FROM players WHERE id=?`).run(decision.playerId);
    }else if(decision.playerId){
      const normalized=normalizeNameForMatch(conflict.raw_name);
      if(decision.aliasBefore)db.prepare(`INSERT INTO player_name_aliases(id,player_id,alias,alias_normalized,source_provider,note,created_at) VALUES(@id,@player_id,@alias,@alias_normalized,@source_provider,@note,@created_at) ON CONFLICT(alias_normalized) DO UPDATE SET player_id=excluded.player_id,alias=excluded.alias,source_provider=excluded.source_provider,note=excluded.note`).run(decision.aliasBefore);
      else db.prepare(`DELETE FROM player_name_aliases WHERE alias_normalized=? AND player_id=?`).run(normalized,decision.playerId);
      if(conflict.source_provider&&conflict.source_player_id){
        if(decision.sourceBefore)db.prepare(`INSERT INTO player_source_ids(id,player_id,source_provider,source_player_id,source_url,last_verified_at) VALUES(@id,@player_id,@source_provider,@source_player_id,@source_url,@last_verified_at) ON CONFLICT(source_provider,source_player_id) DO UPDATE SET player_id=excluded.player_id,source_url=excluded.source_url,last_verified_at=excluded.last_verified_at`).run(decision.sourceBefore);
        else db.prepare(`DELETE FROM player_source_ids WHERE source_provider=? AND source_player_id=? AND player_id=?`).run(conflict.source_provider,conflict.source_player_id,decision.playerId);
      }
    }
    db.prepare(`UPDATE player_match_conflicts SET status='open',resolution_action=NULL,resolved_player_id=NULL,reviewer=NULL,resolution_note=NULL,resolved_at=NULL,backup_id=NULL,decision_json=NULL,updated_at=? WHERE id=?`).run(nowIso(),conflictId);
    recordChange({entityType:'player_match_conflicts',entityId:conflictId,action:'update',before:conflict,after:{status:'open'},note,author:reviewer,backupId:backup.id});
  })();
  return {conflictId,reopened:true,backupId:backup.id};
}

function recordAliasForConflict(playerId: number, conflict: any) {
  const normalized = normalizeNameForMatch(conflict.raw_name);
  if (!normalized) return;
  db.prepare(`INSERT INTO player_name_aliases(player_id,alias,alias_normalized,source_provider,note) VALUES(?,?,?,?,?) ON CONFLICT(alias_normalized) DO UPDATE SET player_id=excluded.player_id,note=excluded.note`).run(playerId, conflict.raw_name, normalized, conflict.source_provider, 'Risolto dal Data Manager');
}
