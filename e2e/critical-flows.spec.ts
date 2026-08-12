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

test('le rotte principali non hanno violazioni WCAG 2.2 AA automatiche',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='chromium-desktop','Audit automatico unico; le altre matrici verificano navigazione e layout');
  for(const route of ['/','/matches?season=2025%2F26','/players','/seasons','/favorites']){
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
