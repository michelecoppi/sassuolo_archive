import fs from 'node:fs';
import path from 'node:path';
import { initDb } from '../server/db/database.js';
import { importAll } from '../server/services/importer.js';

type HistoricalSeason = { season: string; transfermarktSeasonId: number };
type Player = {
  name: string;
  nationality: string | null;
  position: 'Goalkeeper' | 'Defender' | 'Midfielder' | 'Attacker' | null;
  shirt_number: number | null;
  photo_url: string | null;
  source_provider: 'Transfermarkt';
  source_external_id: string;
  source_url: string;
};

const seasons: HistoricalSeason[] = [
  { season: '2008/09', transfermarktSeasonId: 2008 },
  { season: '2009/10', transfermarktSeasonId: 2009 },
  { season: '2010/11', transfermarktSeasonId: 2010 },
  { season: '2011/12', transfermarktSeasonId: 2011 },
  { season: '2012/13', transfermarktSeasonId: 2012 },
];

function decode(value: string) {
  return value
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'").replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

function text(value: string) { return decode(value.replace(/<[^>]+>/g, ' ')); }

function normalizePosition(value: string): Player['position'] {
  const position = value.toLowerCase();
  if (position.includes('goalkeeper')) return 'Goalkeeper';
  if (position.includes('back') || position.includes('centre-back') || position.includes('defender')) return 'Defender';
  if (position.includes('midfield')) return 'Midfielder';
  if (position.includes('winger') || position.includes('forward') || position.includes('striker') || position.includes('attack')) return 'Attacker';
  return null;
}

function parseSquad(html: string, sourceUrl: string): Player[] {
  const rows = html.match(/<tr class="(?:odd|even)">[\s\S]*?(?=<tr class="(?:odd|even)">|<\/tbody>)/g) ?? [];
  const result: Player[] = [];
  for (const row of rows) {
    const profile = row.match(/href="\/[^"]+\/profil\/spieler\/(\d+)">\s*([^<]+?)\s*<\/a>/);
    if (!profile) continue;
    const number = row.match(/class=rn_nummer>(\d+)</);
    const position = row.match(/<\/a>\s*<\/td>\s*<\/tr>\s*<tr>\s*<td>\s*([^<]+?)\s*<\/td>/);
    const nationality = row.match(/<img[^>]*title="([^"]+)"[^>]*class="flaggenrahmen"/);
    const photo = row.match(/data-src="([^"]+)"[^>]*class="bilderrahmen-fixed/);
    result.push({
      name: decode(profile[2]),
      nationality: nationality ? decode(nationality[1]) : null,
      position: normalizePosition(position ? text(position[1]) : ''),
      shirt_number: number ? Number(number[1]) : null,
      photo_url: photo ? decode(photo[1]) : null,
      source_provider: 'Transfermarkt',
      source_external_id: profile[1],
      source_url: sourceUrl,
    });
  }
  return result;
}

async function downloadSeason({ season, transfermarktSeasonId }: HistoricalSeason) {
  const sourceUrl = `https://www.transfermarkt.com/us-sassuolo/kader/verein/6574/saison_id/${transfermarktSeasonId}`;
  const response = await fetch(sourceUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SassuoloHistory/1.0)' } });
  if (!response.ok) throw new Error(`${season}: HTTP ${response.status}`);
  const players = parseSquad(await response.text(), sourceUrl);
  if (!players.length) throw new Error(`${season}: nessun giocatore riconosciuto nella risposta`);
  return { season, players };
}

async function main() {
  const bySeason = [] as { season: string; players: Player[] }[];
  for (const season of seasons) {
    console.log(`Download rosa ${season.season}`);
    bySeason.push(await downloadSeason(season));
  }

  const byId = new Map<string, Player>();
  for (const { players } of bySeason) for (const player of players) byId.set(player.source_external_id, player);
  const playerSeasons = bySeason.flatMap(({ season, players }) => players.map(player => ({
    player_name: player.name,
    season,
    competition: 'Serie B',
    // Transfermarkt verifies membership in the squad, not match statistics.
    // Leave all performance fields null so the UI honestly renders N/D.
    source_provider: 'Transfermarkt',
  })));

  fs.mkdirSync(path.resolve('data/players'), { recursive: true });
  fs.mkdirSync(path.resolve('data/player-seasons'), { recursive: true });
  fs.writeFileSync(path.resolve('data/players/sassuolo-pre-serie-a-squads.json'), JSON.stringify([...byId.values()], null, 2) + '\n');
  fs.writeFileSync(path.resolve('data/player-seasons/sassuolo-pre-serie-a-squads.json'), JSON.stringify(playerSeasons, null, 2) + '\n');

  initDb();
  const imported = importAll();
  console.log(JSON.stringify({ seasons: bySeason.map(x => ({ season: x.season, players: x.players.length })), uniquePlayers: byId.size, imported }, null, 2));
}

main().catch(error => { console.error(error); process.exitCode = 1; });
