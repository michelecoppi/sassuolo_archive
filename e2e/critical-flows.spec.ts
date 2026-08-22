import { expect,test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async({page})=>{await page.addInitScript(()=>localStorage.setItem('sassuolo-history-onboarded','1'));});

test('ricerca, route diretta e filtri paginati restano nell’URL',async({page})=>{
  await page.goto('/players?season=2025%2F26&page=2');
  await expect(page.getByRole('heading',{name:'Giocatori'})).toBeVisible();
  await expect(page.getByText(/pagina 2 di 3/)).toBeVisible();
  await page.reload();await expect(page).toHaveURL(/season=2025%2F26&page=2/);
  await page.keyboard.press(process.platform==='darwin'?'Meta+K':'Control+K');
  const search=page.getByRole('textbox',{name:'Ricerca globale'});await expect(search).toBeFocused();await search.fill('Beradi');
  await expect(page.getByText('Domenico Berardi')).toBeVisible();
});

test('confronto e editor amministrativo sono navigabili a breakpoint mobile',async({page,isMobile})=>{
  await page.goto('/compare?mode=players');await expect(page.getByRole('heading',{name:/Confront/i})).toBeVisible();
  await page.goto('/data-manager/manual?entity=players&page=2');await expect(page.getByRole('heading',{name:'Modifica dati manualmente'})).toBeVisible();
  await expect(page.getByText(/pagina 2 di 3/)).toBeVisible();
  if(isMobile)expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
});

test('import preview e conflitti usano il database E2E isolato',async({page})=>{
  await page.goto('/data-manager');await page.getByRole('button',{name:'Candidati',exact:true}).click();
  await page.locator('input[type=file]').setInputFiles({name:'players.csv',mimeType:'text/csv',buffer:Buffer.from('name,position,source_url\nE2E Preview,Attacker,https://example.test/e2e')});
  await expect(page.getByText(/Dry-run completato|Import bloccato/)).toBeVisible();
  await expect(page.getByText('Righe:').locator('..')).toContainText('1');
  await page.getByRole('button',{name:'Qualità dati',exact:true}).click();await expect(page.getByText('Conflitto aperto: match.home_score')).toBeVisible();
});

test('una risposta API fallita non lascia bianca la pagina',async({page})=>{
  await page.route('**/api/dashboard*',route=>route.fulfill({status:500,contentType:'application/json',body:'{"error":"widget non disponibile"}'}));
  await page.goto('/dashboard');await expect(page.locator('body')).not.toBeEmpty();
  await expect(page.getByText(/Qualcosa non ha funzionato|Caricamento dati/)).toBeVisible();
});

test('stato pubblico, filtri e feed restano utilizzabili anche su mobile',async({page,isMobile})=>{
  await page.goto('/status');
  await expect(page.getByRole('heading',{name:'Stato e novità'})).toBeVisible();
  await expect(page.getByRole('status')).toContainText('Archivio operativo');
  await expect(page.getByRole('link',{name:'Feed RSS'})).toHaveAttribute('href','/api/status/feed.xml');
  await page.getByRole('button',{name:/Incidenti/}).click();
  await expect(page).toHaveURL(/type=incident/);
  await expect(page.getByText('Nessuna voce per questo filtro')).toBeVisible();
  if(isMobile)expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
});

test('la Sassuolo Time Machine attraversa dati completi e stagioni ancora vuote',async({page,isMobile})=>{
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'Sassuolo Time Machine'})).toBeVisible();
  const slider=page.getByRole('slider',{name:'Seleziona stagione'});
  await expect(slider).toHaveAttribute('aria-valuetext','2025/26');
  await page.getByRole('button',{name:'Stagione precedente'}).click();
  await expect(page).toHaveURL(/era=2024%2F25/);
  await expect(slider).toHaveAttribute('aria-valuetext','2024/25');
  await slider.focus();await slider.press('End');
  await expect(slider).toHaveAttribute('aria-valuetext','2026/27');
  await expect(page.getByText('Nessuna vittoria verificata disponibile per questa stagione.')).toBeVisible();
  await expect(page.getByRole('link',{name:/Apri la stagione/})).toBeVisible();
  if(isMobile)expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
});

test('Match Cinema rivive una cronaca reale, resta condivisibile e non sborda su mobile',async({page,isMobile},testInfo)=>{
  await page.route('**/api/matches/1',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
    match:{id:1,date:'2024-04-14T18:45:00Z',season:'2023/24',competition:'Serie A',round:'32',home_team:'Sassuolo',away_team:'Milan',home_score:3,away_score:1,completeness_level:'DETAILED',possession_home:43,possession_away:57,shots_home:15,shots_away:12,shots_on_target_home:7,shots_on_target_away:4,source_provider:'Fixture E2E'},
    details:{status_long:'Match Finished',venue_name:'Mapei Stadium',venue_city:'Reggio Emilia',league_round:'Regular Season - 32',home_team_logo:null,away_team_logo:null,events_synced:1,lineups_synced:1,team_stats_synced:1,player_stats_synced:0,injuries_synced:0},
    outcome:{halftime:'1-0',fulltime:'3-1',extraTime:null,penalties:null},
    modules:{score:true,events:true,lineups:true,substitutions:true,teamStats:true,playerStats:false,injuries:false,specialEvents:false},
    events:[
      {id:101,minute:12,extra_minute:null,team_name:'Sassuolo',player_id:null,player_name:'Domenico Berardi',assist_player_id:null,assist_name:'Grégoire Defrel',type:'Goal',detail:'Normal Goal',comments:null,scoring_play:1,home_score:1,away_score:0,is_own_goal:0},
      {id:102,minute:38,extra_minute:null,team_name:'Milan',player_id:null,player_name:'Rafael Leão',assist_player_id:null,assist_name:null,type:'Card',detail:'Yellow Card',comments:'Fallo tattico',scoring_play:0,home_score:null,away_score:null,is_own_goal:0},
      {id:103,minute:51,extra_minute:null,team_name:'Milan',player_id:null,player_name:'Olivier Giroud',assist_player_id:null,assist_name:'Theo Hernández',type:'Goal',detail:'Normal Goal',comments:null,scoring_play:1,home_score:1,away_score:1,is_own_goal:0},
      {id:104,minute:90,extra_minute:2,team_name:'Sassuolo',player_id:null,player_name:'Nedim Bajrami',assist_player_id:null,assist_name:null,type:'Goal',detail:'Normal Goal',comments:null,scoring_play:1,home_score:3,away_score:1,is_own_goal:0}
    ],specialEvents:[],
    lineups:[{id:1,team_name:'Sassuolo',team_logo:null,formation:'4-2-3-1',coach_name:'Davide Ballardini',startXI:[{player:{name:'Andrea Consigli',number:47,pos:'G'}},{player:{name:'Domenico Berardi',number:10,pos:'F'}}],substitutes:[]},{id:2,team_name:'Milan',team_logo:null,formation:'4-3-3',coach_name:'Stefano Pioli',startXI:[{player:{name:'Mike Maignan',number:16,pos:'G'}},{player:{name:'Rafael Leão',number:10,pos:'F'}}],substitutes:[]}],
    teamStats:[{id:1,team_name:'Sassuolo',statistics:[{type:'Ball Possession',value:'43%'},{type:'Total Shots',value:15}]},{id:2,team_name:'Milan',statistics:[{type:'Ball Possession',value:'57%'},{type:'Total Shots',value:12}]}],
    playerStats:[],injuries:[],sources:[]
  })}));
  await page.goto('/matches/1?cinema=event-102');
  const cinema=page.getByRole('dialog',{name:'Match Cinema'});await expect(cinema).toBeVisible();
  await expect(cinema.getByRole('heading',{name:'Cartellino giallo'})).toBeVisible();
  await expect(cinema.getByText('1–0',{exact:true})).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await expect(page).toHaveURL(/cinema=event-103/);await expect(cinema.getByRole('heading',{name:'Gol · Milan'})).toBeVisible();
  await expect(cinema.getByText('1–1',{exact:true})).toBeVisible();
  if(testInfo.project.name==='chromium-desktop'){
    const results=await new AxeBuilder({page}).include('.match-cinema').withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).analyze();
    expect(results.violations,results.violations.map(item=>item.id).join(', ')).toEqual([]);
  }
  if(isMobile)expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
  await page.keyboard.press('Escape');await expect(cinema).toBeHidden();await expect(page).not.toHaveURL(/cinema=/);
  await page.getByRole('button',{name:'Rivivi il match'}).click();await expect(page).toHaveURL(/cinema=start/);
  await expect(page.getByRole('dialog',{name:'Match Cinema'})).toBeVisible();
});

test('Match Cinema BASIC mostra soltanto apertura e risultato verificato',async({page})=>{
  await page.goto('/matches/1');await page.getByRole('button',{name:'Rivivi il match'}).click();
  const cinema=page.getByRole('dialog',{name:'Match Cinema'});await expect(cinema).toBeVisible();
  await expect(cinema.getByText('Edizione essenziale.')).toBeVisible();
  await cinema.getByRole('button',{name:'Capitolo successivo'}).click();
  await expect(cinema.getByRole('heading',{name:'Triplice fischio'})).toBeVisible();
  await expect(cinema.getByText(/cronaca evento per evento non è disponibile/i)).toBeVisible();
});

test('il Museo Neroverde conserva un ricordo privato e costruisce il tour anche su mobile',async({page,isMobile},testInfo)=>{
  await page.goto('/matches/1');
  await page.getByRole('button',{name:'Aggiungi al museo'}).click();
  const editor=page.getByRole('dialog',{name:'Avversario 0 – Sassuolo'});await expect(editor).toBeVisible();
  await editor.getByLabel('Come l’hai vissuta').selectOption('stadium');
  await editor.getByRole('button',{name:'Gioia',exact:true}).click();
  await editor.getByRole('slider',{name:'Intensità del ricordo'}).fill('5');
  await editor.getByLabel('Momento preferito').fill('Il gol sotto la curva al novantesimo');
  await editor.getByLabel('La tua nota').fill('Ero con mio padre: per qualche secondo non si sentiva più nulla.');
  await editor.getByRole('button',{name:'Porta nel museo'}).click();
  await expect(editor).toBeHidden();await expect(page.getByRole('button',{name:'Nel mio museo'})).toBeVisible();
  const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('sassuolo-history-personal-museum:v1')??'null'));
  expect(stored.memories).toHaveLength(1);expect(stored.memories[0]).toMatchObject({key:'match:1',experience:'stadium',emotion:'joy',intensity:5});

  await page.goto('/museum');await expect(page.getByRole('heading',{name:'Il mio Museo Neroverde',level:1})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Avversario 0 – Sassuolo'})).toBeVisible();
  await page.getByLabel('Neroverde dal').fill('2008');await page.getByLabel('Dedica').fill('A chi non ha mai smesso di crederci.');await page.getByRole('button',{name:'Salva dedica'}).click();
  await page.getByRole('button',{name:'Entra nel mio museo'}).click();
  const tour=page.getByRole('dialog',{name:'Il mio Museo Neroverde'});await expect(tour).toBeVisible();
  await expect(tour.getByText('Solo su questo dispositivo')).toBeVisible();
  await page.keyboard.press('ArrowRight');const timelineTour=page.getByRole('dialog',{name:'La mia linea del tempo'});await expect(timelineTour.getByRole('heading',{name:'La mia linea del tempo'})).toBeVisible();
  await expect(timelineTour.getByText('Il gol sotto la curva al novantesimo')).toBeVisible();
  if(testInfo.project.name==='chromium-desktop'){
    const results=await new AxeBuilder({page}).include('.museum-tour').withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).analyze();
    expect(results.violations,results.violations.map(item=>item.id).join(', ')).toEqual([]);
  }
  if(isMobile)expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
  await page.keyboard.press('Escape');await expect(timelineTour).toBeHidden();
  await page.reload();await expect(page.getByRole('heading',{name:'Avversario 0 – Sassuolo'})).toBeVisible();await expect(page.getByLabel('Dedica')).toHaveValue('A chi non ha mai smesso di crederci.');
});

test('stati lenti e offline restano espliciti e navigabili',async({page,context})=>{
  await page.route('**/api/matches*',async route=>{await new Promise(resolve=>setTimeout(resolve,500));await route.continue()});
  await page.goto('/matches');await expect(page.getByLabel('Caricamento')).toBeVisible();await expect(page.getByRole('heading',{name:'Partite'})).toBeVisible();
  await context.setOffline(true);await page.evaluate(()=>window.dispatchEvent(new Event('offline')));
  await expect(page.getByText(/Modalità offline/)).toBeVisible();await expect(page.locator('body')).not.toBeEmpty();
  await context.setOffline(false);await page.evaluate(()=>window.dispatchEvent(new Event('online')));
});

test('snapshot API e preferiti restano disponibili quando la rete dati cade',async({page})=>{
  await page.goto('/matches?season=2025%2F26');
  await expect(page.getByRole('heading',{name:'Partite'})).toBeVisible();
  await page.getByRole('button',{name:'Salva pagina nei preferiti'}).click();
  await page.goto('/favorites');await expect(page.getByRole('link',{name:'/matches?season=2025%2F26'})).toBeVisible();
  await page.route('**/api/matches*',route=>route.abort('internetdisconnected'));
  await page.goto('/matches?season=2025%2F26');
  await expect(page.getByRole('heading',{name:'Partite'})).toBeVisible();
  await expect(page.getByText(/120 risultati/)).toBeVisible();
});

test('un aggiornamento pronto richiede consenso e conserva i dati locali',async({page})=>{
  await page.addInitScript(()=>{
    localStorage.setItem('sassuolo-history-favorites','[{"url":"/players"}]');
    localStorage.setItem('sassuolo-history-telemetry-opt-out','1');
  });
  await page.goto('/');await expect(page.locator('h1')).toBeVisible();
  await page.evaluate(()=>{
    const registration={waiting:{postMessage:(message:unknown)=>{(window as any).__updateMessage=message;}}};
    window.dispatchEvent(new CustomEvent('sassuolo-history:update-ready',{detail:registration}));
  });
  await expect(page.getByText('Nuova versione disponibile')).toBeVisible();
  await page.getByRole('button',{name:'Aggiorna ora'}).click();
  expect(await page.evaluate(()=>(window as any).__updateMessage)).toEqual({type:'SKIP_WAITING'});
  expect(await page.evaluate(()=>localStorage.getItem('sassuolo-history-favorites'))).toContain('/players');
  expect(await page.evaluate(()=>localStorage.getItem('sassuolo-history-telemetry-opt-out'))).toBe('1');
});

test('le rotte principali non hanno violazioni WCAG 2.2 AA automatiche',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='chromium-desktop','Audit automatico unico; le altre matrici verificano navigazione e layout');
  for(const route of ['/','/matches?season=2025%2F26','/players','/seasons','/museum','/favorites','/status']){
    await page.goto(route);await expect(page.locator('h1')).toBeVisible();
    const results=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).analyze();
    expect(results.violations,`${route}: ${results.violations.map(item=>`${item.id} (${item.nodes.length})`).join(', ')}`).toEqual([]);
  }
});

test('skip link e comandi principali sono raggiungibili da tastiera',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='chromium-desktop','Flusso tastiera verificato una volta sul motore di riferimento');
  await page.goto('/players');await page.keyboard.press('Tab');
  await expect(page.getByRole('link',{name:'Vai al contenuto principale'})).toBeFocused();
  await page.keyboard.press('Enter');await expect(page.locator('#main-content')).toBeFocused();
  await page.keyboard.press('Tab');
});

test('baseline visuale desktop delle liste principali',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='chromium-desktop','Baseline unica e deterministica su Chromium desktop');
  await page.goto('/matches?season=2025%2F26');await expect(page.getByRole('heading',{name:'Partite'})).toBeVisible();
  await expect(page).toHaveScreenshot('matches-filtered.png',{fullPage:true});
});
