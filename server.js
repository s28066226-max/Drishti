import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

import { generateJSON, hasKey, pickModel, currentModel, warmUp } from './lib/gemini.js';
import { LANGUAGES, MODES, buildPrompt } from './lib/prompts.js';
import { enrichObjects, topAlert, currencyTotal, findGuidance } from './lib/spatial.js';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
if (existsSync(join(ROOT, '.env'))) process.loadEnvFile(join(ROOT, '.env'));

const PORT = Number(process.env.PORT) || 8080;
const PUBLIC = join(ROOT, 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
};

const MAX_BODY = 4 * 1024 * 1024;
const IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp'];

const fail = (status, message) => Object.assign(new Error(message), { status });

function send(res, status, data) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

async function readJSON(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw fail(413, 'Image too large.');
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch {
    throw fail(400, 'Invalid JSON body.');
  }
}

// Guide/Find modes poll every ~1.5 s, so allow a generous but bounded rate per client.
const hits = new Map();
function rateLimited(req, limit = 90) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
  const now = Date.now();
  const e = hits.get(ip) || { start: now, count: 0 };
  if (now - e.start > 60_000) Object.assign(e, { start: now, count: 0 });
  e.count += 1;
  hits.set(ip, e);
  return e.count > limit;
}

// --- vision ---------------------------------------------------------------

async function see(body) {
  if (!hasKey()) throw fail(503, 'Vision is not configured. Add GEMINI_API_KEY to .env and restart.');
  const mode = MODES.includes(body.mode) ? body.mode : 'describe';
  const lang = LANGUAGES[body.language] ? body.language : 'en';
  const query = String(body.query || '').slice(0, 300);
  if ((mode === 'find' || mode === 'ask') && !query.trim()) throw fail(400, mode === 'find' ? 'What should I look for?' : 'What is your question?');
  if (!body.image?.data || !IMAGE_MIME.includes(body.image.mimeType)) throw fail(400, 'No camera frame received.');

  const started = Date.now();
  const { system, schema } = buildPrompt(mode, { lang, query, previous: String(body.previous || '').slice(0, 300) });
  const raw = await generateJSON({
    system,
    schema,
    fast: true,
    temperature: 0.2,
    contents: [{
      role: 'user',
      parts: [{ inlineData: { mimeType: body.image.mimeType, data: String(body.image.data) } }, { text: query || `Mode: ${mode}` }],
    }],
  });

  const out = { mode, language: lang, speech: raw.speech || '', latencyMs: 0, model: currentModel() };
  if (raw.objects) {
    out.objects = enrichObjects(raw.objects);
    out.alert = topAlert(out.objects);
  }
  if (mode === 'read') Object.assign(out, { text: raw.text || '', textLanguage: raw.textLanguage || lang, documentType: raw.documentType || '' });
  if (mode === 'money') out.money = { ...currencyTotal(raw.items), unsure: Boolean(raw.unsure) };
  if (mode === 'find') {
    out.found = Boolean(raw.found);
    out.guidance = raw.found ? findGuidance(raw.box_2d) : { state: 'not_found' };
    if (out.guidance.state !== 'not_found') out.objects = enrichObjects([{ label: query, box_2d: raw.box_2d, severity: 'none' }]);
  }
  if (mode === 'guide') out.changed = raw.changed !== false || Boolean(out.alert);
  out.latencyMs = Date.now() - started;
  return out;
}

async function serveStatic(req, res) {
  const url = new URL(req.url, 'http://x');
  const rel = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '') || 'index.html';
  const file = join(PUBLIC, rel);
  if (!file.startsWith(PUBLIC)) return send(res, 403, { error: 'Forbidden' });
  try {
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    send(res, 404, { error: 'Not found' });
  }
}

const routes = {
  'GET /api/health': async () => ({ ai: hasKey(), model: hasKey() ? await pickModel().catch(() => null) : null }),
  'POST /api/see': (req) => readJSON(req).then(see),
};

createServer(async (req, res) => {
  const key = `${req.method} ${req.url.split('?')[0]}`;
  const handler = routes[key];
  if (!handler) return req.method === 'GET' ? serveStatic(req, res) : send(res, 404, { error: 'Not found' });
  if (req.method === 'POST' && rateLimited(req)) return send(res, 429, { error: 'Too many requests — slow down a little.' });
  try {
    send(res, 200, await handler(req));
  } catch (err) {
    console.error(`[${key}]`, err.message);
    send(res, err.status && err.status < 500 ? err.status : 500, { error: err.message || 'Something went wrong.' });
  }
}).listen(PORT, () => {
  console.log(`Drishti running at http://localhost:${PORT}`);
  if (!hasKey()) console.log('No GEMINI_API_KEY found — add it to .env to enable vision.');
  else warmUp().catch((err) => console.warn(`[gemini] warm-up failed: ${err.message}`));
});
