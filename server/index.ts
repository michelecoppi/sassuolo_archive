import 'dotenv/config';
import dns from 'node:dns';
import express from 'express';
import cors from 'cors';
import { initDb } from './db/database.js';
import { api } from './routes/api.js';

// Some Windows networks advertise an IPv6 route that cannot actually reach
// Cloudflare-hosted providers. Prefer IPv4 so provider fetches do not fail
// before an HTTP response is received.
dns.setDefaultResultOrder('ipv4first');

initDb();
const app=express();
app.use(cors());
app.use(express.json({limit:'2mb'}));
app.use('/api',api);
const port=Number(process.env.PORT||8787);
app.listen(port,()=>console.log(`Sassuolo History API: http://localhost:${port}`));
