import { useSyncExternalStore } from 'react';

export type DatasetRelease={version:string;generatedAt:string;schemaVersion:number;databaseSha256:string};
let current:DatasetRelease|null=null;const listeners=new Set<()=>void>();
export function loadDatasetRelease(){void fetch('/api/dataset-release').then(response=>response.ok?response.json():null).then(value=>{if(value){current=value;for(const listener of listeners)listener();}}).catch(()=>undefined);}
export function datasetReleaseMetadata(){return current?{dataset_version:current.version,dataset_sha256:current.databaseSha256,dataset_generated_at:current.generatedAt}:{};}
export function useDatasetRelease(){return useSyncExternalStore(listener=>{listeners.add(listener);return()=>listeners.delete(listener);},()=>current,()=>null);}
