import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createApp, createRateLimiter, SECURITY_HEADERS } from '../lib/app.js';
import { _resetForTests } from '../lib/gemini.js';
import { mockGemini, reply } from './helpers.js';

const IMAGE = { mimeType: 'image/jpeg', data: 'aGVsbG8=' };
let server;
let base;

before(async () => {
  server = createServer(createApp({ rateLimit: 1000 }));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());
beforeEach(() => {
  process.env.GEMINI_API_KEY = 'test-key';
  _resetForTests();
});

const post = (path, body) => fetch(`${base}${path}`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: typeof body === 'string' ? body : JSON.stringify(body),
});

test('serves the app with security headers', async () => {
  const res = await fetch(`${base}/`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/html/);
  assert.match(await res.text(), /<title>Drishti/);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) assert.equal(res.headers.get(name), value, name);
});

test('blocks path traversal and survives malformed URLs', async () => {
  assert.notEqual((await fetch(`${base}/%2e%2e/server.js`)).status, 200);
  assert.notEqual((await fetch(`${base}/..%2f.env`)).status, 200);
  assert.equal((await fetch(`${base}/%E0%A4%A`)).status, 400);
  assert.equal((await fetch(`${base}/api/health`)).status, 200, 'server still alive');
});

test('health reports whether AI is configured', async () => {
  delete process.env.GEMINI_API_KEY;
  assert.deepEqual(await (await fetch(`${base}/api/health`)).json(), { ai: false, model: null });
});

test('/api/see returns 503 when no API key is configured', async () => {
  delete process.env.GEMINI_API_KEY;
  const res = await post('/api/see', { mode: 'describe', image: IMAGE });
  assert.equal(res.status, 503);
});

test('/api/see validates input before calling the AI', async () => {
  const cases = [
    ['{not json', 400],
    [{ mode: 'describe' }, 400],
    [{ mode: 'describe', image: { mimeType: 'image/gif', data: 'x' } }, 400],
    [{ mode: 'find', image: IMAGE }, 400],
    [{ mode: 'ask', query: '   ', image: IMAGE }, 400],
  ];
  for (const [body, status] of cases) assert.equal((await post('/api/see', body)).status, status, JSON.stringify(body));
});

test('/api/see rejects oversized bodies with 413', async () => {
  const res = await post('/api/see', { mode: 'describe', image: { mimeType: 'image/jpeg', data: 'a'.repeat(5 * 1024 * 1024) } });
  assert.equal(res.status, 413);
});

test('money mode: AI identifies notes, server computes the total', async () => {
  const mock = mockGemini(['gemini-9.0-flash'], () => reply({
    speech: 'Two 500 rupee notes and one fake 300 note.',
    unsure: false,
    items: [
      { denomination: 500, kind: 'note', box_2d: [100, 100, 400, 450] },
      { denomination: 500, kind: 'note', box_2d: [100, 500, 400, 900] },
      { denomination: 300, kind: 'note', box_2d: [500, 100, 800, 450] },
    ],
  }));
  try {
    const r = await (await post('/api/see', { mode: 'money', language: 'hi', image: IMAGE })).json();
    assert.equal(r.money.total, 1000);
    assert.equal(r.money.rejected.length, 1);
    assert.equal(r.language, 'hi');
    assert.equal(r.model, 'gemini-9.0-flash');
    assert.match(mock.calls[0].body.systemInstruction.parts[0].text, /Hindi/);
  } finally {
    mock.restore();
  }
});

test('describe mode: objects get clock directions, distance and a hazard alert', async () => {
  const mock = mockGemini(['gemini-9.0-flash'], () => reply({
    speech: 'Open drain ahead.',
    objects: [
      { label: 'chair', box_2d: [300, 0, 500, 120], severity: 'none' },
      { label: 'open drain', box_2d: [700, 300, 1000, 750], severity: 'high' },
    ],
  }));
  try {
    const r = await (await post('/api/see', { mode: 'describe', image: IMAGE })).json();
    assert.equal(r.objects[0].label, 'open drain');
    assert.equal(r.objects[0].clock, 12);
    assert.equal(r.alert.label, 'open drain');
    assert.equal(r.objects.find((o) => o.label === 'chair').clock, 11);
  } finally {
    mock.restore();
  }
});

test('find mode returns steering guidance from the target box', async () => {
  const mock = mockGemini(['gemini-9.0-flash'], () => reply({ found: true, speech: 'On your left.', box_2d: [300, 0, 500, 150] }));
  try {
    const r = await (await post('/api/see', { mode: 'find', query: 'keys', image: IMAGE })).json();
    assert.equal(r.found, true);
    assert.equal(r.guidance.state, 'left');
  } finally {
    mock.restore();
  }
});

test('rate limiter allows a burst up to the limit, then blocks until the window resets', () => {
  const limited = createRateLimiter(2, 1000);
  assert.equal(limited('a', 0), false);
  assert.equal(limited('a', 10), false);
  assert.equal(limited('a', 20), true);
  assert.equal(limited('b', 20), false, 'other clients unaffected');
  assert.equal(limited('a', 1500), false, 'new window');
});

test('unknown API routes return 404', async () => {
  assert.equal((await post('/api/nope', {})).status, 404);
});
