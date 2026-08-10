import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

function files(dir:string):string[]{return fs.readdirSync(dir,{withFileTypes:true}).flatMap(x=>x.isDirectory()?files(path.join(dir,x.name)): [path.join(dir,x.name)]);}
test('tracked text sources are UTF-8 without BOM or mojibake',()=>{
  const root=path.resolve();const targets=[...files(path.join(root,'src')),...files(path.join(root,'data')),path.join(root,'MIGLIORAMENTI.md')].filter(x=>/\.(tsx?|json|md|csv)$/i.test(x));
  for(const file of targets){const raw=fs.readFileSync(file);assert.notEqual(raw.subarray(0,3).toString('hex'),'efbbbf',`${file} has a UTF-8 BOM`);const text=raw.toString('utf8');assert.ok(!/[\u00c3\u00c2][\u0080-\u00bf]|\u00e2[\u0080-\u00bf]/.test(text),`${file} contains mojibake`);}
});
