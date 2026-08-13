# API-Football Setup — Sassuolo History v3

## Configurazione

1. Crea/usa un account API-Football (API-Sports).
2. Recupera la chiave dal dashboard, sezione **Account → My Access**.
3. Nella root del progetto:

```powershell
Copy-Item .env.example .env
```

4. Modifica `.env`:

```env
API_FOOTBALL_KEY=INCOLLA_QUI_LA_TUA_CHIAVE
ENABLE_API_FOOTBALL=true
API_FOOTBALL_SASSUOLO_TEAM_ID=
```

Lascia pure `API_FOOTBALL_SASSUOLO_TEAM_ID` vuoto. Il progetto individua Sassuolo automaticamente e memorizza l'ID nel database.

## Avvio

```powershell
npm install
npm run setup
npm run dev
```

Apri `http://localhost:5173` e vai su **Data Manager**.

## Ordine consigliato

1. **Test connessione**
2. **Aggiorna trasferimenti**
3. **Sincronizza stagione selezionata** partendo dalle stagioni più recenti
4. Ripeti sulle stagioni precedenti finché il tuo piano le rende disponibili
5. **Aggiorna stagione corrente** per gli update normali

## Cosa scarica una stagione

- ID e coverage della competizione
- classifica completa
- statistiche aggregate Sassuolo
- giocatori Sassuolo
- statistiche PlayerSeason

I dati vengono salvati in SQLite. Aprire una pagina non consuma richieste API.

## Cosa aggiorna la stagione corrente

- rosa attuale
- profili giocatori
- statistiche giocatori
- classifica
- statistiche squadra
- trasferimenti
- allenatore

## Piano Free

Al momento della preparazione di questa v3 (agosto 2026), il piano Free dichiara 100 richieste/giorno e 10 richieste/minuto, con profondità storica inferiore ai piani a pagamento. Se una vecchia stagione non è disponibile, il Data Manager mostra l'errore e conserva tutti i dati già presenti.

Per lo storico risultati rimane disponibile il bootstrap Football-Data, che non utilizza la quota API-Football.

## Sicurezza

Non inserire mai la API key in `src/` o nel frontend. La chiave deve restare esclusivamente nel file `.env` usato dal backend Node.
