import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

import { hasKey, pickModel } from './lib/gemini.js';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
if (existsSync(join(ROOT, '.env'))) process.loadEnvFile(join(ROOT, '.env'));

const PORT = Number(process.env.PORT) || 8080;
const PUBLIC = join(ROOT, 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
};

function send(res, status, data) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
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
};

createServer(async (req, res) => {
  const key = `${req.method} ${req.url.split('?')[0]}`;
  const handler = routes[key];
  if (!handler) return req.method === 'GET' ? serveStatic(req, res) : send(res, 404, { error: 'Not found' });
  try {
    send(res, 200, await handler(req));
  } catch (err) {
    console.error(`[${key}]`, err.message);
    send(res, err.status && err.status < 500 ? err.status : 500, { error: err.message || 'Something went wrong.' });
  }
}).listen(PORT, () => {
  console.log(`Drishti running at http://localhost:${PORT}`);
  if (!hasKey()) console.log('No GEMINI_API_KEY found — add it to .env to enable vision.');
});
