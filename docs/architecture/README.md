# Decisioni architetturali

Gli Architecture Decision Record (ADR) spiegano perché sono state prese le decisioni che condizionano dati, sicurezza e operazioni. Sono documenti brevi e immutabili: se una scelta cambia, si aggiunge un nuovo ADR che sostituisce il precedente.

## Indice

- [ADR-0001 — SQLite e approccio local-first](0001-sqlite-local-first.md)
- [ADR-0002 — Semantica di NULL e N/D](0002-null-semantics.md)
- [ADR-0003 — Precedenza e provenienza delle fonti](0003-source-precedence.md)
- [ADR-0004 — Sessioni amministrative](0004-admin-sessions.md)
- [ADR-0005 — Telemetria rispettosa della privacy](0005-privacy-telemetry.md)
- [Modello per nuove decisioni](template.md)

Una modifica strutturale aggiorna un ADR esistente soltanto per correzioni editoriali. Se cambia la decisione, si crea un nuovo file, lo si collega nel campo `Sostituisce` e si marca il precedente come `Sostituito`.
