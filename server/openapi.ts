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
  tags:[{name:'Archive'},{name:'Import'},{name:'Quality'},{name:'Sync'}],
  components:{schemas:{
    Error:{type:'object',required:['error'],properties:{error:{type:'string'}}},
    ImportIssue:{type:'object',required:['row','code','message','critical'],properties:{row:{type:'integer'},field:{type:['string','null']},code:{type:'string'},message:{type:'string'},critical:{type:'boolean'}}},
    ImportPreview:{type:'object',required:['entity','filename','checksum','rows','validRows','discardedRows','created','updated','skipped','conflicts','errors','canApply','columnMappings','rowPreview','issues'],properties:{entity:{enum:['seasons','matches','players','player-seasons']},filename:{type:'string'},checksum:{type:'string',pattern:'^[a-f0-9]{64}$'},rows:{type:'integer'},validRows:{type:'integer'},discardedRows:{type:'integer'},created:{type:'integer'},updated:{type:'integer'},skipped:{type:'integer'},conflicts:{type:'integer'},errors:{type:'integer'},canApply:{type:'boolean'},columnMappings:{type:'array',items:{type:'object'}},rowPreview:{type:'array',items:{type:'object'}},issues:{type:'array',items:{$ref:'#/components/schemas/ImportIssue'}}}},
  }},
  paths:{
    '/openapi.json':{get:{operationId:'getOpenApi',responses:{'200':{description:'Contratto OpenAPI'}}}},
    '/seasons':{get:{tags:['Archive'],operationId:'listSeasons',parameters:[{name:'competition',in:'query',schema:{type:'string'}}],responses:{'200':{description:'Elenco stagioni'},'400':errorResponse}}},
    '/matches':{get:{tags:['Archive'],operationId:'listMatches',parameters:[{name:'season',in:'query',schema:{type:'string',pattern:'^\\d{4}/\\d{2}$'}},{name:'competition',in:'query',schema:{type:'string'}},{name:'limit',in:'query',description:'Massimo record; la paginazione page/cursor è riservata alla major 2.',schema:{type:'integer',minimum:1,maximum:1000}}],responses:{'200':{description:'Partite filtrate'},'400':errorResponse}}},
    '/players':{get:{tags:['Archive'],operationId:'listPlayers',parameters:[{name:'q',in:'query',schema:{type:'string'}},{name:'sort',in:'query',schema:{type:'string'}},{name:'direction',in:'query',schema:{enum:['asc','desc']}}],responses:{'200':{description:'Giocatori filtrati'},'400':errorResponse}}},
    '/data-quality':{get:{tags:['Quality'],operationId:'getDataQuality',responses:{'200':{description:'Anomalie ordinate per severità con stato, responsabile e azione suggerita'}}}},
    '/data-quality/{issueKey}':{patch:{tags:['Quality'],operationId:'updateDataQualityIssue',parameters:[{name:'issueKey',in:'path',required:true,schema:{type:'string'}}],requestBody:{required:true,content:{'application/json':{schema:{type:'object',required:['status'],properties:{status:{enum:['open','in_progress','resolved','ignored']},assignee:{type:['string','null']},note:{type:['string','null']}}},example:{status:'in_progress',assignee:'Archivista',note:'Verifica in corso'}}}},responses:{'200':{description:'Workflow aggiornato'},'400':errorResponse,'401':errorResponse}}},
    '/import/preview':{post:{tags:['Import'],operationId:'previewImport',requestBody:importBody,responses:{'200':{description:'Anteprima senza scritture'},'400':errorResponse}}},
    '/import/apply':{post:{tags:['Import'],operationId:'applyImport',requestBody:{required:true,content:{'application/json':{schema:{type:'object',required:['entity','filename','content','checksum'],properties:{entity:{type:'string'},filename:{type:'string'},content:{type:'string'},checksum:{type:'string'}}}}}},responses:{'200':{description:'Import applicato con backup'},'400':errorResponse,'409':{...errorResponse,description:'Checksum cambiato o contenuto già importato'}}}},
    '/sync/jobs':{get:{tags:['Sync'],operationId:'listSyncJobs',responses:{'200':{description:'Configurazione, lock, alert e ultime esecuzioni'}}}},
    '/sync/jobs/{name}/run':{post:{tags:['Sync'],operationId:'runSyncJob',parameters:[{name:'name',in:'path',required:true,schema:{enum:['current-matches','current-squad','news']}}],requestBody:{content:{'application/json':{schema:{type:'object',properties:{idempotencyKey:{type:'string'}}},example:{idempotencyKey:'manual-2026-08-11-news'}}}},responses:{'200':{description:'Esito job o deduplicazione'},'400':errorResponse}}},
  },
} as const;
