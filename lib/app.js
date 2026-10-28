// HTTP application: routing, validation, security headers, rate limiting and static files.
// Kept separate from server.js (which only listens) so it can be tested end-to-end.

import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

import { generateJSON, hasKey, pickModel, currentModel } from './gemini.js';
import { LANGUAGES, MODES, buildPrompt } from './prompts.js';
import { enrichObjects, topAlert, currencyTotal, findGuidance } from './spatial.js';

const PUBLIC = fileURLToPath(new URL('../public/', import.meta.url));
const MAX_BODY_BYTES = 4 * 1024 * 1024;
const MAX_QUERY_CHARS = 300;
const IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const RATE_WINDOW_MS = 60_000;
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
};

// Camera, mic and location are needed by this page only; everything else is locked down.
export const SECURITY_HEADERS = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
  'permissions-policy': 'camera=(self), microphone=(self), geolocation=(self)',
  'content-security-policy': [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' https://fonts.googleapis.com",
    'font-src https://fonts.gstatic.com',
    "img-src 'self' blob: data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; '),
};

/** Create an Error carrying an HTTP status. */
export const fail = (status, message) => Object.assign(new Error(message), { status });

function send(res, status, data, extraHeaders = {}) {
  res.writeHead(status, { ...SECURITY_HEADERS, 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extraHeaders });
  res.end(JSON.stringify(data));
}

async function readJSON(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    // Drain (and discard) moderately oversized bodies so the client can read the 413 cleanly;
    // beyond 4x the limit, stop reading and close the connection instead of buffering.
    if (size > MAX_BODY_BYTES * 4) throw Object.assign(fail(413, 'Image too large.'), { closeConnection: true });
    if (size <= MAX_BODY_BYTES) chunks.push(chunk);
  }
  if (size > MAX_BODY_BYTES) throw fail(413, 'Image too large.');
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch {
    throw fail(400, 'Invalid JSON body.');
  }
}

/** Fixed-window limiter per client IP. Stale entries are pruned so memory stays bounded. */
export function createRateLimiter(limit, windowMs = RATE_WINDOW_MS) {
  const hits = new Map();
  return function isLimited(ip, now = Date.now()) {
    if (hits.size > 10_000) {
      for (const [key, e] of hits) if (now - e.start > windowMs) hits.delete(key);
    }
    const e = hits.get(ip) || { start: now, count: 0 };
    if (now - e.start > windowMs) Object.assign(e, { start: now, count: 0 });
    e.count += 1;
    hits.set(ip, e);
    return e.count > limit;
  };
}

/** Validate a /api/see request body. Throws a 4xx/503 error, or returns normalised input. */
export function validateSee(body) {
  if (!hasKey()) throw fail(503, 'Vision is not configured. Add GEMINI_API_KEY to .env and restart.');
  const mode = MODES.includes(body.mode) ? body.mode : 'describe';
  const lang = LANGUAGES[body.language] ? body.language : 'en';
  const query = String(body.query || '').slice(0, MAX_QUERY_CHARS);
  if ((mode === 'find' || mode === 'ask') && !query.trim()) {
    throw fail(400, mode === 'find' ? 'What should I look for?' : 'What is your question?');
  }
  if (typeof body.image?.data !== 'string' || !body.image.data || !IMAGE_MIME.includes(body.image.mimeType)) {
    throw fail(400, 'No camera frame received.');
  }
  const previous = String(body.previous || '').slice(0, MAX_QUERY_CHARS);
  return { mode, lang, query, previous, image: { mimeType: body.image.mimeType, data: body.image.data } };
}

/** Turn the model's raw JSON into the API response, adding deterministic spatial reasoning. */
export function shapeResult(raw, { mode, lang, query }) {
  const out = { mode, language: lang, speech: raw.speech || '', model: currentModel() };
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
  return out;
}

async function see(body) {
  const input = validateSee(body);
  const started = Date.now();
  const { system, schema } = buildPrompt(input.mode, input);
  const raw = await generateJSON({
    system,
    schema,
    fast: true,
    temperature: 0.2,
    contents: [{ role: 'user', parts: [{ inlineData: input.image }, { text: input.query || `Mode: ${input.mode}` }] }],
  });
  return { ...shapeResult(raw, input), latencyMs: Date.now() - started };
}

async function serveStatic(req, res) {
  let rel;
  try {
    rel = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([/\\])+/, '') || 'index.html';
  } catch {
    return send(res, 400, { error: 'Bad request' }); // malformed percent-encoding
  }
  const file = join(PUBLIC, rel);
  if (!file.startsWith(PUBLIC)) return send(res, 403, { error: 'Forbidden' });
  try {
    const data = await readFile(file);
    res.writeHead(200, { ...SECURITY_HEADERS, 'content-type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    send(res, 404, { error: 'Not found' });
  }
}

/**
 * Build the request handler.
 * @param {{ rateLimit?: number }} [options] POST requests allowed per client per minute.
 *   Guide/Find poll every ~2-3 s, so the default is generous but bounded.
 */
export function createApp({ rateLimit = 90 } = {}) {
  const isLimited = createRateLimiter(rateLimit);
  const routes = {
    'GET /api/health': async () => ({ ai: hasKey(), model: hasKey() ? await pickModel().catch(() => null) : null }),
    'POST /api/see': (req) => readJSON(req).then(see),
  };

  return async function handle(req, res) {
    const key = `${req.method} ${req.url.split('?')[0]}`;
    const handler = routes[key];
    if (!handler) return req.method === 'GET' ? serveStatic(req, res) : send(res, 404, { error: 'Not found' });

    const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress;
    if (req.method === 'POST' && isLimited(ip)) return send(res, 429, { error: 'Too many requests — slow down a little.' });
    try {
      send(res, 200, await handler(req));
    } catch (err) {
      const status = Number.isInteger(err.status) && err.status >= 400 && err.status < 600 ? err.status : 500;
      if (status >= 500) console.error(`[${key}]`, err.message);
      send(res, status, { error: err.message || 'Something went wrong.' }, err.closeConnection ? { connection: 'close' } : {});
    }
  };
}
