export type ProviderResult<T> = { ok: true; data: T; requests: number } | { ok: false; error: string; requests: number };

export interface SyncProvider {
  name: string;
  isConfigured(): boolean;
  syncCurrentMatches?(): Promise<ProviderResult<any[]>>;
  syncCurrentSquad?(): Promise<ProviderResult<any[]>>;
  syncStandings?(): Promise<ProviderResult<any[]>>;
}
