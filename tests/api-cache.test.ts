import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

const originalWindow=(globalThis as any).window;
const originalLocalStorage=(globalThis as any).localStorage;
const originalFetch=globalThis.fetch;
const storage=new Map<string,string>();
const localStorage={
  get length(){return storage.size;},
  key(index:number){return [...storage.keys()][index]??null;},
  getItem(key:string){return storage.get(key)??null;},
  setItem(key:string,value:string){storage.set(key,String(value));},
  removeItem(key:string){storage.delete(key);},
};
const browserEvents=new EventTarget();
(globalThis as any).window=browserEvents;
(globalThis as any).localStorage=localStorage;
const {api}=await import('../src/services/api.js');

before(()=>storage.clear());
after(()=>{
  globalThis.fetch=originalFetch;
  (globalThis as any).window=originalWindow;
  (globalThis as any).localStorage=originalLocalStorage;
});

test('la cache interviene solo sugli errori di rete e segnala la copia stale',async()=>{
  globalThis.fetch=async()=>new Response(JSON.stringify({value:'fresh'}),{status:200,headers:{'Content-Type':'application/json'}});
  assert.deepEqual(await api<{value:string}>('/cache-contract'),{value:'fresh'});

  globalThis.fetch=async()=>new Response(JSON.stringify({error:'errore reale'}),{status:500,headers:{'Content-Type':'application/json'}});
  await assert.rejects(()=>api('/cache-contract'),/errore reale/);

  let fallback:any=null;
  browserEvents.addEventListener('sassuolo-cache-fallback',event=>{fallback=(event as CustomEvent).detail;},{once:true});
  globalThis.fetch=async()=>{throw new TypeError('network unavailable');};
  assert.deepEqual(await api<{value:string}>('/cache-contract'),{value:'fresh'});
  assert.equal(fallback.path,'/cache-contract');
  assert.match(fallback.savedAt,/^\d{4}-\d{2}-\d{2}T/);
});

test('una richiesta annullata non riporta in pagina dati vecchi',async()=>{
  globalThis.fetch=async()=>{throw new DOMException('aborted','AbortError');};
  await assert.rejects(()=>api('/cache-contract'),error=>error instanceof DOMException&&error.name==='AbortError');
});
