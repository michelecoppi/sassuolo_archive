import { useDatasetRelease } from '../services/datasetRelease';
export default function DatasetVersion(){const release=useDatasetRelease();return <footer className="mt-8 border-t border-zinc-800 pt-4 text-xs text-zinc-500">Dataset {release?.version??'N/D'}{release?.databaseSha256?` · ${release.databaseSha256.slice(0,18)}…`:''}</footer>}
