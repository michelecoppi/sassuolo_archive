const errorResponse={
  description:'Richiesta non valida',
  content:{'application/json':{schema:{type:'object',required:['error'],properties:{error:{type:'string'}}},example:{error:'Richiesta non valida'}}},
};

const importBody={
  required:true,
  content:{'application/json':{schema:{type:'object',required:['entity','filename','content'],properties:{entity:{enum:['seasons','matches','players','player-seasons']},filename:{type:'string'},content:{type:'string'}}},example:{entity:'players',filename:'players.csv',content:'name,source_url\nDomenico Berardi,https://example.test/source'}}},
};

export const openApiDocument={
  openapi:'3.1.0',
  info:{title:'Sassuolo History API',version:'1.0.0',description:'Contratto dell’archivio e delle operazioni amministrative. X-API-Version espone la versione corrente; le rotte /api restano compatibili per tutta la major 1.'},
  servers:[{url:'/api'}],
  tags:[{name:'Archive'},{name:'Auth'},{name:'Import'},{name:'Quality'},{name:'Sync'},{name:'Operations'}],
  components:{securitySchemes:{adminSession:{type:'apiKey',in:'cookie',name:'sassuolo_admin_session'},csrfToken:{type:'apiKey',in:'header',name:'X-CSRF-Token'}},schemas:{
    Error:{type:'object',required:['error'],properties:{error:{type:'string'}}},
    ImportIssue:{type:'object',required:['row','code','message','critical'],properties:{row:{type:'integer'},field:{type:['string','null']},code:{type:'string'},message:{type:'string'},critical:{type:'boolean'}}},
    ImportPreview:{type:'object',required:['entity','filename','checksum','rows','validRows','discardedRows','created','updated','skipped','conflicts','errors','canApply','columnMappings','rowPreview','issues'],properties:{entity:{enum:['seasons','matches','players','player-seasons']},filename:{type:'string'},checksum:{type:'string',pattern:'^[a-f0-9]{64}$'},rows:{type:'integer'},validRows:{type:'integer'},discardedRows:{type:'integer'},created:{type:'integer'},updated:{type:'integer'},skipped:{type:'integer'},conflicts:{type:'integer'},errors:{type:'integer'},canApply:{type:'boolean'},columnMappings:{type:'array',items:{type:'object'}},rowPreview:{type:'array',items:{type:'object'}},issues:{type:'array',items:{$ref:'#/components/schemas/ImportIssue'}}}},
  }},
  paths:{
    '/openapi.json':{get:{operationId:'getOpenApi',responses:{'200':{description:'Contratto OpenAPI'}}}},
    '/health':{get:{tags:['Operations'],operationId:'getPublicHealth',responses:{'200':{description:'Stato sintetico senza dettagli operativi'},'503':errorResponse}}},
    '/health/details':{get:{tags:['Operations'],operationId:'getHealthDetails',security:[{adminSession:[]}],responses:{'200':{description:'Diagnostica operativa completa'},'401':errorResponse,'503':errorResponse}}},
    '/dataset-release':{get:{tags:['Archive'],operationId:'getDatasetRelease',responses:{'200':{description:'Versione, schema, checksum, copertura e import della release dati'},'503':errorResponse}}},
    '/auth/login':{post:{tags:['Auth'],operationId:'adminLogin',requestBody:{required:true,content:{'application/json':{schema:{type:'object',required:['token','name'],properties:{token:{type:'string',format:'password'},name:{type:'string'}}}}}},responses:{'200':{description:'Sessione HttpOnly e token CSRF temporaneo'},'401':errorResponse,'429':errorResponse}}},
    '/auth/session':{get:{tags:['Auth'],operationId:'getAdminSession',security:[{adminSession:[]}],responses:{'200':{description:'Stato, curatore, scadenza e token CSRF della sessione'}}}},
    '/auth/logout':{post:{tags:['Auth'],operationId:'adminLogout',security:[{adminSession:[],csrfToken:[]}],responses:{'200':{description:'Sessione revocata'},'401':errorResponse,'403':errorResponse}}},
    '/seasons':{get:{tags:['Archive'],operationId:'listSeasons',parameters:[{name:'competition',in:'query',schema:{type:'string'}}],responses:{'200':{description:'Elenco stagioni'},'400':errorResponse}}},
    '/matches':{get:{tags:['Archive'],operationId:'listMatches',parameters:[{name:'season',in:'query',schema:{type:'string',pattern:'^\\d{4}/\\d{2}$'}},{name:'competition',in:'query',schema:{type:'string'}},{name:'page',in:'query',schema:{type:'integer',minimum:1}},{name:'pageSize',in:'query',schema:{type:'integer',minimum:10,maximum:100}}],responses:{'200':{description:'Partite filtrate; con page/pageSize restituisce rows, total, page e pageSize'},'400':errorResponse}}},
    '/players':{get:{tags:['Archive'],operationId:'listPlayers',parameters:[{name:'season',in:'query',schema:{type:'string'}},{name:'position',in:'query',schema:{type:'string'}},{name:'nationality',in:'query',schema:{type:'string'}},{name:'sort',in:'query',schema:{enum:['appearances','goals','assists','minutes','name']}},{name:'direction',in:'query',schema:{enum:['asc','desc']}},{name:'page',in:'query',schema:{type:'integer',minimum:1}},{name:'pageSize',in:'query',schema:{type:'integer',minimum:10,maximum:100}}],responses:{'200':{description:'Giocatori filtrati e paginati'},'400':errorResponse}}},
    '/transfers':{get:{tags:['Archive'],operationId:'listTransfers',parameters:[{name:'season',in:'query',schema:{type:'string'}},{name:'session',in:'query',schema:{enum:['SUMMER','WINTER']}},{name:'movement',in:'query',schema:{enum:['TRANSFER','LOAN','RETURN','FREE','RELEASE']}},{name:'page',in:'query',schema:{type:'integer',minimum:1}},{name:'pageSize',in:'query',schema:{type:'integer',minimum:10,maximum:100}}],responses:{'200':{description:'Trasferimenti filtrati e paginati'},'400':errorResponse}}},
    '/data-quality':{get:{tags:['Quality'],operationId:'getDataQuality',security:[{adminSession:[]}],responses:{'200':{description:'Anomalie ordinate per severità con stato, responsabile e azione suggerita'},'401':errorResponse}}},
    '/data-quality/{issueKey}':{patch:{tags:['Quality'],operationId:'updateDataQualityIssue',security:[{adminSession:[],csrfToken:[]}],parameters:[{name:'issueKey',in:'path',required:true,schema:{type:'string'}}],requestBody:{required:true,content:{'application/json':{schema:{type:'object',required:['status'],properties:{status:{enum:['open','in_progress','resolved','ignored']},assignee:{type:['string','null']},note:{type:['string','null']}}},example:{status:'in_progress',assignee:'Archivista',note:'Verifica in corso'}}}},responses:{'200':{description:'Workflow aggiornato'},'400':errorResponse,'401':errorResponse}}},
    '/import/preview':{post:{tags:['Import'],operationId:'previewImport',requestBody:importBody,responses:{'200':{description:'Anteprima senza scritture'},'400':errorResponse}}},
    '/import/apply':{post:{tags:['Import'],operationId:'applyImport',requestBody:{required:true,content:{'application/json':{schema:{type:'object',required:['entity','filename','content','checksum'],properties:{entity:{type:'string'},filename:{type:'string'},content:{type:'string'},checksum:{type:'string'}}}}}},responses:{'200':{description:'Import applicato con backup'},'400':errorResponse,'409':{...errorResponse,description:'Checksum cambiato o contenuto già importato'}}}},
    '/sync/jobs':{get:{tags:['Sync'],operationId:'listSyncJobs',responses:{'200':{description:'Configurazione, lock, alert e ultime esecuzioni'}}}},
    '/sync/jobs/{name}/run':{post:{tags:['Sync'],operationId:'runSyncJob',parameters:[{name:'name',in:'path',required:true,schema:{enum:['current-matches','current-squad','news']}}],requestBody:{content:{'application/json':{schema:{type:'object',properties:{idempotencyKey:{type:'string'}}},example:{idempotencyKey:'manual-2026-08-11-news'}}}},responses:{'200':{description:'Esito job o deduplicazione'},'400':errorResponse}}},
  },
} as const;
