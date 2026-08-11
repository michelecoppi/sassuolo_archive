import { z } from 'zod';

const issue=z.object({row:z.number(),field:z.string().nullable(),code:z.string(),message:z.string(),critical:z.boolean()});
export const importPreviewSchema=z.object({entity:z.string(),filename:z.string(),checksum:z.string().regex(/^[a-f0-9]{64}$/),format:z.enum(['csv','json']),rows:z.number(),validRows:z.number(),discardedRows:z.number(),created:z.number(),updated:z.number(),skipped:z.number(),conflicts:z.number(),errors:z.number(),canApply:z.boolean(),issues:z.array(issue),columnMappings:z.array(z.object({source:z.string(),target:z.string().nullable(),recognized:z.boolean(),required:z.boolean()})),rowPreview:z.array(z.object({row:z.number(),status:z.enum(['valid','discarded','duplicate','conflict']),action:z.enum(['create','update','skip']),issues:z.number()}))});
export type ImportPreviewContract=z.infer<typeof importPreviewSchema>;

export function createAdminApiClient(baseUrl:string,fetcher:typeof fetch=fetch){
  async function request(path:string,init?:RequestInit){const response=await fetcher(`${baseUrl}${path}`,{headers:{'Content-Type':'application/json',...(init?.headers||{})},...init});const body=await response.json();if(!response.ok)throw new Error(String(body?.error||`HTTP ${response.status}`));return body;}
  return {
    async previewImport(input:{entity:'seasons'|'matches'|'players'|'player-seasons';filename:string;content:string}){const body=await request('/import/preview',{method:'POST',body:JSON.stringify(input)});return importPreviewSchema.parse(body.preview);},
    async quality(){return request('/data-quality');},
    async syncJobs(){return request('/sync/jobs');},
  };
}
