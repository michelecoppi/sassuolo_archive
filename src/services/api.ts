export async function api<T>(path:string, init?:RequestInit):Promise<T>{
  try{
    const res=await fetch(`/api${path}`,{cache:'no-store',headers:{'Content-Type':'application/json',...(init?.headers||{})},...init});
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
