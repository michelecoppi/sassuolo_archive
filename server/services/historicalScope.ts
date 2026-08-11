import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type CompetitionKind = 'league' | 'playoff' | 'playout' | 'domestic_cup' | 'continental_cup' | 'super_cup';

export type HistoricalScopeEntry = {
  season: string;
  competition: string;
  kind: CompetitionKind;
  expectedMatches: number | null;
  gapReason: string;
};

export type HistoricalScope = {
  version: number;
  startSeason: string;
  endSeason: string;
  inclusionPolicy: string;
  evidence: Array<{label: string; url?: string; path?: string}>;
  entries: HistoricalScopeEntry[];
};

type ScopeFile = Omit<HistoricalScope, 'entries'> & {
  seasons: Array<{season: string; competitions: Array<Omit<HistoricalScopeEntry, 'season'>>}>;
};

const scopePath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../data/historical-scope.json');

export function loadHistoricalScope(): HistoricalScope {
  const raw = JSON.parse(fs.readFileSync(scopePath, 'utf8')) as ScopeFile;
  const entries = raw.seasons.flatMap(item => item.competitions.map(competition => ({season: item.season, ...competition})));
  return {version: raw.version, startSeason: raw.startSeason, endSeason: raw.endSeason, inclusionPolicy: raw.inclusionPolicy, evidence: raw.evidence, entries};
}

export function validateHistoricalScope(scope: HistoricalScope): string[] {
  const issues: string[] = [];
  const seasons = [...new Set(scope.entries.map(entry => entry.season))].sort();
  const firstYear = Number(scope.startSeason.slice(0, 4));
  const lastYear = Number(scope.endSeason.slice(0, 4));
  const expectedSeasons = Array.from({length: lastYear - firstYear + 1}, (_, index) => {
    const year = firstYear + index;
    return `${year}/${String(year + 1).slice(-2)}`;
  });
  if (JSON.stringify(seasons) !== JSON.stringify(expectedSeasons)) issues.push('La sequenza delle stagioni non è continua tra startSeason ed endSeason.');
  const keys = new Set<string>();
  for (const entry of scope.entries) {
    const key = `${entry.season}\u0000${entry.competition}`;
    if (keys.has(key)) issues.push(`Duplicato nel perimetro: ${entry.season} · ${entry.competition}.`);
    keys.add(key);
    if (!entry.gapReason.trim()) issues.push(`Motivazione della lacuna assente: ${entry.season} · ${entry.competition}.`);
  }
  for (const season of expectedSeasons) {
    const leagues = scope.entries.filter(entry => entry.season === season && entry.kind === 'league');
    if (leagues.length !== 1) issues.push(`${season} deve avere esattamente un campionato dichiarato.`);
  }
  return issues;
}

