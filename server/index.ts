import 'dotenv/config';
import dns from 'node:dns';
import { createApp } from './app.js';
import { startAdminScheduler } from './services/adminScheduler.js';

// Some Windows networks advertise an IPv6 route that cannot actually reach
// Cloudflare-hosted providers. Prefer IPv4 so provider fetches do not fail
// before an HTTP response is received.
dns.setDefaultResultOrder('ipv4first');

const app=createApp();
const port=Number(process.env.PORT||8787);
app.listen(port,()=>console.log(`Sassuolo History API: http://localhost:${port}`));
if(process.env.NODE_ENV!=='test')startAdminScheduler();
