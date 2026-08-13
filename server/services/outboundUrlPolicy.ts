import dns from 'node:dns/promises';
import net from 'node:net';

export function isPrivateAddress(address:string){
  if(net.isIPv4(address)){
    const [a,b]=address.split('.').map(Number);
    return a===10||a===127||a===0||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&b===168||a>=224;
  }
  if(net.isIPv6(address)){const value=address.toLowerCase();return value==='::1'||value==='::'||value.startsWith('fc')||value.startsWith('fd')||value.startsWith('fe8')||value.startsWith('fe9')||value.startsWith('fea')||value.startsWith('feb')||value.startsWith('::ffff:127.')||value.startsWith('::ffff:10.')||value.startsWith('::ffff:192.168.');}
  return true;
}

export async function validateRemoteUrl(value:string|URL,allowedHosts:Set<string>,lookup=dns.lookup){
  const url=value instanceof URL?value:new URL(value);
  if(url.protocol!=='https:'||url.username||url.password||url.port||!allowedHosts.has(url.hostname.toLowerCase()))throw new Error('URL remoto non consentito');
  const addresses=await lookup(url.hostname,{all:true,verbatim:true});
  if(!addresses.length||addresses.some(entry=>isPrivateAddress(entry.address)))throw new Error('Destinazione privata non consentita');
  return url;
}

export async function safeRemoteFetch(initial:URL,allowedHosts:Set<string>,fetcher:typeof fetch=fetch){
  let current=await validateRemoteUrl(initial,allowedHosts);
  for(let redirect=0;redirect<=3;redirect++){
    const response=await fetcher(current,{headers:{Accept:'image/avif,image/webp,image/*;q=0.8'},signal:AbortSignal.timeout(5_000),redirect:'manual'});
    if(response.status<300||response.status>=400)return response;
    const location=response.headers.get('location');if(!location)throw new Error('Redirect remoto senza destinazione');
    current=await validateRemoteUrl(new URL(location,current),allowedHosts);
  }
  throw new Error('Troppi redirect remoti');
}
