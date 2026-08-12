import { defineConfig,devices } from '@playwright/test';
import path from 'node:path';

const databasePath=process.env.SASSUOLO_E2E_DB??path.resolve(`.tmp/e2e-sassuolo-${process.pid}.db`);
process.env.SASSUOLO_E2E_DB=databasePath;
const portOffset=process.pid%1000;
const apiPort=Number(process.env.SASSUOLO_E2E_API_PORT??18000+portOffset),webPort=Number(process.env.SASSUOLO_E2E_WEB_PORT??15000+portOffset);
process.env.SASSUOLO_E2E_API_PORT=String(apiPort);process.env.SASSUOLO_E2E_WEB_PORT=String(webPort);
export default defineConfig({
  testDir:'./e2e',fullyParallel:false,timeout:30_000,
  expect:{timeout:7_500,toHaveScreenshot:{animations:'disabled',maxDiffPixelRatio:0.01}},
  retries:process.env.CI?2:0,
  reporter:process.env.CI?[['line'],['html',{outputFolder:'playwright-report',open:'never'}]]:'list',
  outputDir:'test-results',
  snapshotPathTemplate:'{testDir}/{testFilePath}-snapshots/{arg}-{projectName}-win32{ext}',
  use:{baseURL:`http://127.0.0.1:${webPort}`,trace:'retain-on-failure',screenshot:'only-on-failure',video:'retain-on-failure'},
  globalSetup:'./e2e/global-setup.ts',
  projects:[
    {name:'chromium-desktop',use:{...devices['Desktop Chrome']}},
    {name:'firefox-desktop',testIgnore:process.platform==='win32'?'**/*':[],use:{...devices['Desktop Firefox']}},
    {name:'webkit-desktop',use:{...devices['Desktop Safari']}},
    {name:'chromium-mobile',use:{...devices['Pixel 5']}},
  ]
});
