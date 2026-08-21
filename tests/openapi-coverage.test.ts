import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { openApiDocument } from '../server/openapi.js';
import { API_ROUTE_MANIFEST } from '../server/openapiRouteManifest.js';
import { isAdminReadPath, isPublicMutation } from '../server/services/accessPolicy.js';

const routeKey=(method:string,path:string)=>`${method.toLowerCase()} ${path}`;
const openApiPath=(path:string)=>path.replace(/:([A-Za-z_][\w]*)/g,'{$1}');

function declaredRoutes(){
  const rows:Array<readonly [string,string]>=[];
  for(const [filename,prefix] of [['server/routes/api.ts',''],['server/app.ts','/api']] as const){
    const source=fs.readFileSync(filename,'utf8');
    const pattern=prefix?/app\.(get|post|put|patch|delete)\(\s*['`]\/api([^'`]+)['`]/g:/api\.(get|post|put|patch|delete)\(\s*['`]([^'`]+)['`]/g;
    for(const match of source.matchAll(pattern))rows.push([match[1].toLowerCase(),match[2]||'/']);
  }
  return [...new Map(rows.map(row=>[routeKey(...row),row])).values()];
}

test('ogni route Express è censita e pubblicata nel contratto OpenAPI',()=>{
  const declared=declaredRoutes().map(row=>routeKey(...row)).sort();
  const manifest=API_ROUTE_MANIFEST.map(row=>routeKey(...row)).sort();
  assert.deepEqual(manifest,declared);
  for(const [method,path] of API_ROUTE_MANIFEST)assert.ok((openApiDocument.paths as any)[openApiPath(path)]?.[method],`${method.toUpperCase()} ${path} non documentata`);
});

test('operationId e requisiti di sicurezza OpenAPI non possono divergere dal middleware',()=>{
  const ids=new Set<string>();
  for(const [method,path] of API_ROUTE_MANIFEST){
    const operation=(openApiDocument.paths as any)[openApiPath(path)][method];
    assert.ok(operation.operationId,`operationId assente per ${method} ${path}`);
    assert.ok(!ids.has(operation.operationId),`operationId duplicato: ${operation.operationId}`);ids.add(operation.operationId);
    const secured=method==='get'?isAdminReadPath(path):path!=='/auth/login'&&!isPublicMutation(method.toUpperCase(),path);
    assert.equal(Boolean(operation.security?.length),secured,`sicurezza OpenAPI incoerente per ${method} ${path}`);
    if(secured){assert.ok(operation.security[0].adminSession,`sessione admin assente per ${method} ${path}`);assert.equal(Boolean(operation.security[0].csrfToken),method!=='get',`CSRF incoerente per ${method} ${path}`);}
  }
});
