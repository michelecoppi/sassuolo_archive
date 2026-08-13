import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isPrivateAddress, validateRemoteUrl } from '../server/services/outboundUrlPolicy.js';

test('la policy outbound blocca reti private e host/redirect non ammessi',async()=>{
  for(const address of ['127.0.0.1','10.0.0.2','172.16.0.1','192.168.1.1','::1','fd00::1'])assert.equal(isPrivateAddress(address),true);
  assert.equal(isPrivateAddress('93.184.216.34'),false);
  const allowed=new Set(['images.example.test']);
  const publicLookup=(async()=>[{address:'93.184.216.34',family:4}]) as any;
  assert.equal((await validateRemoteUrl('https://images.example.test/a.jpg',allowed,publicLookup)).hostname,'images.example.test');
  await assert.rejects(validateRemoteUrl('https://evil.example.test/a.jpg',allowed,publicLookup),/non consentito/);
  await assert.rejects(validateRemoteUrl('https://images.example.test/a.jpg',allowed,(async()=>[{address:'127.0.0.1',family:4}]) as any),/privata/);
});

test('la produzione espone CSP e HSTS',async()=>{
  const temp=(await import('node:fs')).mkdtempSync((await import('node:path')).join((await import('node:os')).tmpdir(),'headers-'));
  process.env.SASSUOLO_DB_PATH=(await import('node:path')).join(temp,'db.sqlite');
  const {createApp}=await import('../server/app.js');const app=createApp({nodeEnv:'production',adminToken:'header-test-admin-token'});const server=app.listen(0);const address=server.address();if(!address||typeof address==='string')throw new Error('server');
  try{const response=await fetch(`http://127.0.0.1:${address.port}/api/health`);assert.match(response.headers.get('content-security-policy')??'',/default-src 'self'/);assert.match(response.headers.get('strict-transport-security')??'',/max-age=31536000/);}finally{server.close();}
});
