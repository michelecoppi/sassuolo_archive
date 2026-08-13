# ADR-0003 — Precedenza e provenienza delle fonti

- Stato: Accettato
- Data: 2026-08-13
- Decisori: manutentori del progetto
- Sostituisce: nessuno

## Contesto

Fonti diverse possono descrivere la stessa partita o persona con identificativi e valori incompatibili. Una sovrascrittura automatica renderebbe impossibile ricostruire l’origine di una correzione.

## Decisione

Ogni valore rilevante conserva provider, URL, identificativo esterno, data di verifica e trasformazione. Le correzioni `manual` hanno precedenza e non vengono sovrascritte dagli import. I conflitti di identità o fixture restano in coda di revisione; non si sceglie per similarità quando il risultato è ambiguo.

## Conseguenze

Gli import sono più prudenti e possono lasciare lacune aperte. In cambio ogni dato pubblicato è auditabile e le decisioni possono essere riesaminate.
