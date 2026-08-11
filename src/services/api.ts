export async function api<T>(path:string, init?:RequestInit):Promise<T>{
  try{
    const adminToken=typeof window!=='undefined'?window.sessionStorage.getItem('sassuolo_admin_token'):null;
    const adminName=typeof window!=='undefined'?window.sessionStorage.getItem('sassuolo_admin_name'):null;
    const method=String(init?.method??'GET').toUpperCase();
    const {headers:requestHeaders,...requestInit}=init??{};
    const res=await fetch(`/api${path}`,{...requestInit,cache:init?.cache??(method==='GET'?'default':'no-store'),headers:{'Content-Type':'application/json',...(adminToken?{Authorization:`Bearer ${adminToken}`}:{ }),...(adminName?{'X-Admin-Name':adminName}:{ }),...(requestHeaders||{})}});
    if(!res.ok){
      const body=await res.text();
      let detail=body;
      try{detail=JSON.parse(body)?.error||body;}catch{/* response is not JSON */}
      throw new Error(detail||`HTTP ${res.status}`);
    }
    return await res.json() as T;
  }catch(error){
    throw error;
  }
}
export const post=<T>(path:string)=>api<T>(path,{method:'POST'});
