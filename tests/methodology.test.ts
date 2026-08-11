import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');

test('methodology documents every technical indicator and exposes stable anchors',()=>{
  const page=read('src/pages/Methodology.tsx');
  for(const id of ['coverage','sources','conflicts','missing-data','detail-levels','formulas'])assert.match(page,new RegExp(`id="${id}"`));
  for(const term of ['BASIC','STANDARD','DETAILED','N/D','correzione manuale','providerPriority','data.rules'])assert.ok(page.includes(term),`missing methodology term: ${term}`);
});

test('source, match completeness and coverage status indicators link to their definitions',()=>{
  const ui=read('src/components/Ui.tsx');
  const matches=read('src/components/MatchTable.tsx');
  const matchDetail=read('src/pages/MatchDetail.tsx');
  const methodology=read('src/pages/Methodology.tsx');
  assert.match(ui,/to="\/methodology#sources"/);
  assert.match(ui,/to="\/methodology#detail-levels"/);
  assert.match(methodology,/href="#coverage"/);
  assert.match(matches,/<CompletenessBadge/);
  assert.match(matchDetail,/<CompletenessBadge/);
});
