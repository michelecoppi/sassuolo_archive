import { API_ROUTE_MANIFEST, type ApiMethod } from './openapiRouteManifest.js';
import { isAdminReadPath, isPublicMutation } from './services/accessPolicy.js';

const errorResponse={
  description:'Richiesta non valida',
  content:{'application/json':{schema:{type:'object',required:['error'],properties:{error:{type:'string'}}},example:{error:'Richiesta non valida'}}},
};

const importBody={
  required:true,
  content:{'application/json':{schema:{type:'object',required:['entity','filename','content'],properties:{entity:{enum:['seasons','matches','players','player-seasons']},filename:{type:'string'},content:{type:'string'}}},example:{entity:'players',filename:'players.csv',content:'name,source_url\nDomenico Berardi,https://example.test/source'}}},
};

const baseOpenApiDocument={
  openapi:'3.1.0',
  info:{title:'Sassuolo History API',version:'1.0.0',description:'Contratto dell’archivio e delle operazioni amministrative. X-API-Version espone la versione corrente; le rotte /api restano compatibili per tutta la major 1.'},
  servers:[{url:'/api'}],
  tags:[{name:'Archive'},{name:'Auth'},{name:'Import'},{name:'Quality'},{name:'Sync'},{name:'Operations'}],
  components:{securitySchemes:{adminSession:{type:'apiKey',in:'cookie',name:'sassuolo_admin_session'},csrfToken:{type:'apiKey',in:'header',name:'X-CSRF-Token'}},schemas:{
    Error:{type:'object',required:['error'],properties:{error:{type:'string'}}},
    ImportIssue:{type:'object',required:['row','code','message','critical'],properties:{row:{type:'integer'},field:{type:['string','null']},code:{type:'string'},message:{type:'string'},critical:{type:'boolean'}}},
    ImportPreview:{type:'object',required:['entity','filename','checksum','rows','validRows','discardedRows','created','updated','skipped','conflicts','errors','canApply','columnMappings','rowPreview','issues'],properties:{entity:{enum:['seasons','matches','players','player-seasons']},filename:{type:'string'},checksum:{type:'string',pattern:'^[a-f0-9]{64}$'},rows:{type:'integer'},validRows:{type:'integer'},discardedRows:{type:'integer'},created:{type:'integer'},updated:{type:'integer'},skipped:{type:'integer'},conflicts:{type:'integer'},errors:{type:'integer'},canApply:{type:'boolean'},columnMappings:{type:'array',items:{type:'object'}},rowPreview:{type:'array',items:{type:'object'}},issues:{type:'array',items:{$ref:'#/components/schemas/ImportIssue'}}}},
    ArchiveRatingInput:{type:'object',required:['player_id','minutes'],properties:{player_id:{type:'integer'},player_name:{type:'string'},position:{type:['string','null']},minutes:{type:'integer',minimum:1,maximum:130},substitute:{type:'integer',enum:[0,1]},captain:{type:'integer',enum:[0,1]},goals:{type:['integer','null'],minimum:0},assists:{type:['integer','null'],minimum:0},yellow_cards:{type:['integer','null'],minimum:0},red_cards:{type:['integer','null'],minimum:0},shots_total:{type:['integer','null'],minimum:0},shots_on:{type:['integer','null'],minimum:0},passes_total:{type:['integer','null'],minimum:0},passes_key:{type:['integer','null'],minimum:0},pass_accuracy:{type:['number','null'],minimum:0,maximum:100},tackles_total:{type:['integer','null'],minimum:0},blocks:{type:['integer','null'],minimum:0},interceptions:{type:['integer','null'],minimum:0},duels_total:{type:['integer','null'],minimum:0},duels_won:{type:['integer','null'],minimum:0},dribbles_attempts:{type:['integer','null'],minimum:0},dribbles_success:{type:['integer','null'],minimum:0},fouls_drawn:{type:['integer','null'],minimum:0},fouls_committed:{type:['integer','null'],minimum:0},saves:{type:['integer','null'],minimum:0},goals_conceded:{type:['integer','null'],minimum:0},penalty_won:{type:['integer','null'],minimum:0},penalty_committed:{type:['integer','null'],minimum:0},penalty_missed:{type:['integer','null'],minimum:0},penalty_saved:{type:['integer','null'],minimum:0}}},
  }},
  paths:{
    '/openapi.json':{get:{operationId:'getOpenApi',responses:{'200':{description:'Contratto OpenAPI'}}}},
    '/health':{get:{tags:['Operations'],operationId:'getPublicHealth',responses:{'200':{description:'Stato sintetico senza dettagli operativi'},'503':errorResponse}}},
    '/health/details':{get:{tags:['Operations'],operationId:'getHealthDetails',security:[{adminSession:[]}],responses:{'200':{description:'Diagnostica operativa completa'},'401':errorResponse,'503':errorResponse}}},
    '/dataset-release':{get:{tags:['Archive'],operationId:'getDatasetRelease',responses:{'200':{description:'Versione, schema, checksum, copertura e import della release dati'},'503':errorResponse}}},
    '/auth/login':{post:{tags:['Auth'],operationId:'adminLogin',requestBody:{required:true,content:{'application/json':{schema:{type:'object',required:['token','name'],properties:{token:{type:'string',format:'password'},name:{type:'string'}}}}}},responses:{'200':{description:'Sessione HttpOnly e token CSRF temporaneo'},'401':errorResponse,'429':errorResponse}}},
    '/auth/session':{get:{tags:['Auth'],operationId:'getAdminSession',responses:{'200':{description:'Stato, curatore, scadenza e token CSRF della sessione'}}}},
    '/auth/logout':{post:{tags:['Auth'],operationId:'adminLogout',security:[{adminSession:[],csrfToken:[]}],responses:{'200':{description:'Sessione revocata'},'401':errorResponse,'403':errorResponse}}},
    '/seasons':{get:{tags:['Archive'],operationId:'listSeasons',parameters:[{name:'competition',in:'query',schema:{type:'string'}}],responses:{'200':{description:'Elenco stagioni'},'400':errorResponse}}},
    '/matches':{get:{tags:['Archive'],operationId:'listMatches',parameters:[{name:'season',in:'query',schema:{type:'string',pattern:'^\\d{4}/\\d{2}$'}},{name:'competition',in:'query',schema:{type:'string'}},{name:'page',in:'query',schema:{type:'integer',minimum:1}},{name:'pageSize',in:'query',schema:{type:'integer',minimum:10,maximum:100}}],responses:{'200':{description:'Partite filtrate; con page/pageSize restituisce rows, total, page e pageSize'},'400':errorResponse}}},
    '/current-season/matches/{id}/player-stats':{
      get:{tags:['Archive'],operationId:'getCurrentMatchPlayerStats',parameters:[{name:'id',in:'path',required:true,schema:{type:'integer'}}],responses:{'200':{description:'Rosa precompilata, statistiche presenti e Sassuolo Archive Rating'},'404':errorResponse}},
      put:{tags:['Archive'],operationId:'saveCurrentMatchPlayerStats',security:[{adminSession:[],csrfToken:[]}],parameters:[{name:'id',in:'path',required:true,schema:{type:'integer'}}],requestBody:{required:true,content:{'application/json':{schema:{type:'object',required:['sourceUrl','rows'],properties:{sourceUrl:{type:'string',format:'uri'},rows:{type:'array',maxItems:30,description:'Sostituisce la distinta curata; un array vuoto rimuove solo le righe manuali.',items:{$ref:'#/components/schemas/ArchiveRatingInput'}}}}}}},responses:{'200':{description:'Statistiche salvate e voti locali ricalcolati'},'400':errorResponse,'401':errorResponse,'403':errorResponse}},
    },
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

type OpenApiOperation=Record<string,unknown>;
type OpenApiPathItem=Partial<Record<ApiMethod,OpenApiOperation>>;

const openApiPath=(path:string)=>path.replace(/:([A-Za-z_][\w]*)/g,'{$1}');
const operationId=(method:ApiMethod,path:string)=>`${method}${path.split('/').filter(Boolean).map(part=>part.startsWith(':')?`By${part.slice(1)[0].toUpperCase()}${part.slice(2)}`:part.split(/[^A-Za-z0-9]+/).filter(Boolean).map(word=>word[0].toUpperCase()+word.slice(1)).join('')).join('')||'Root'}`;
const tagFor=(path:string)=>path.startsWith('/auth/')?'Auth':path.startsWith('/health')||path==='/openapi.json'||path==='/dataset-release'?'Operations':path.startsWith('/import')?'Import':path.startsWith('/sync')||path.startsWith('/update')||path.startsWith('/kickoff')||path.startsWith('/api-football')?'Sync':path.startsWith('/data')||path.startsWith('/manual')||path.startsWith('/corrections')||path.startsWith('/player-identity')?'Quality':'Archive';
const protectedRoute=(method:ApiMethod,path:string)=>method==='get'?isAdminReadPath(path):path!=='/auth/login'&&!isPublicMutation(method.toUpperCase(),path);

const generatedPaths:Record<string,OpenApiPathItem>={};
for(const [method,expressPath] of API_ROUTE_MANIFEST){
  const path=openApiPath(expressPath),secured=protectedRoute(method,expressPath);
  const pathParameters=[...expressPath.matchAll(/:([A-Za-z_][\w]*)/g)].map(match=>({name:match[1],in:'path',required:true,schema:{type:match[1]==='id'||match[1].toLowerCase().endsWith('index')?'integer':'string'}}));
  generatedPaths[path]??={};
  generatedPaths[path][method]={
    tags:[tagFor(expressPath)],operationId:operationId(method,expressPath),
    ...(pathParameters.length?{parameters:pathParameters}:{}),
    ...(secured?{security:method==='get'?[{adminSession:[]}]:[{adminSession:[],csrfToken:[]}]}:{}),
    responses:{'200':{description:'Operazione completata'},'400':errorResponse,...(secured?{'401':errorResponse,'403':errorResponse}:{})},
  };
}

for(const [path,item] of Object.entries(baseOpenApiDocument.paths)){
  generatedPaths[path]??={};
  for(const [method,operation] of Object.entries(item)){
    const apiMethod=method as ApiMethod;
    const generated=generatedPaths[path][apiMethod]??{};
    generatedPaths[path][apiMethod]={...generated,...operation,responses:{...((generated as any).responses??{}),...((operation as any).responses??{})}};
  }
}

export const openApiDocument={...baseOpenApiDocument,paths:generatedPaths};
