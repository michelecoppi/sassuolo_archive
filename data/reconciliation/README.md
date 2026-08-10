# Archivio operativo della riconciliazione

Questa è la cartella unica per lo storico del lavoro di riconciliazione.

```text
data/reconciliation/
  candidates/   pacchetti candidati, uno per area/perimetro
  audits/       report JSON generati dagli audit
  registry.json registro macchina dei workstream
```

Ogni candidato contiene almeno `data.csv` o `data.json`, `manifest.json` e `SOURCES.md`.

Gli stati operativi sono nel database (`research_candidates`, `import_runs`, `audit_runs`); questa cartella conserva gli allegati riproducibili e versionati.
