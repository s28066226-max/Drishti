import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { generate, generateJSON, currentModel, _resetForTests } from '../lib/gemini.js';
import { mockGemini, reply, dailyQuota, json } from './helpers.js';

const MODELS = ['gemini-9.0-flash', 'gemini-8.0-flash', 'gemini-9.0-flash-lite', 'gemma-9-27b-it'];
const request = { system: 'sys', contents: [{ role: 'user', parts: [{ text: 'hi' }] }], fast: true };
let mock;

beforeEach(() => {
  process.env.GEMINI_API_KEY = 'test-key';
  delete process.env.GEMINI_MODEL;
  _resetForTests();
});
afterEach(() => mock?.restore());

test('tries Flash models newest first, then Flash-Lite, then Gemma', async () => {
  mock = mockGemini(MODELS, (model) => (model === 'gemma-9-27b-it' ? reply('ok') : dailyQuota()));
  assert.equal(await generate(request), 'ok');
  assert.deepEqual(mock.calls.map((c) => c.model), MODELS);
  assert.equal(currentModel(), 'gemma-9-27b-it');
});

test('sticks with the model that answered and skips exhausted ones', async () => {
  mock = mockGemini(MODELS, (model) => (model === 'gemini-9.0-flash-lite' ? reply('ok') : dailyQuota()));
  await generate(request);
  const before = mock.calls.length;
  await generate(request);
  assert.deepEqual(mock.calls.slice(before).map((c) => c.model), ['gemini-9.0-flash-lite']);
});

test('fails fast with a clear 429 when every model is out of daily quota', async () => {
  mock = mockGemini(MODELS, () => dailyQuota());
  await assert.rejects(generate(request), (err) => err.status === 429 && /quota/i.test(err.message));
  const before = mock.calls.length;
  await assert.rejects(generate(request), (err) => err.status === 429);
  assert.equal(mock.calls.length, before, 'no API calls once all models are cooling down');
});

test('falls over on overload (503) without giving up', async () => {
  mock = mockGemini(MODELS, (model) => (model === 'gemini-9.0-flash' ? json(503, { error: { message: 'high demand' } }) : reply('ok')));
  assert.equal(await generate(request), 'ok');
  assert.equal(currentModel(), 'gemini-8.0-flash');
});

test('uses low-latency thinking config and drops it if a model rejects it', async () => {
  mock = mockGemini(['gemini-9.0-flash'], (model, body) => (body.generationConfig.thinkingConfig
    ? json(400, { error: { message: 'Unknown name "thinkingLevel"' } })
    : reply('ok')));
  assert.equal(await generate(request), 'ok');
  assert.deepEqual(mock.calls[0].body.generationConfig.thinkingConfig, { thinkingLevel: 'low' });
  assert.equal(mock.calls[1].body.generationConfig.thinkingConfig, undefined);
});

test('non-transient errors (e.g. invalid key) are reported, not retried on other models', async () => {
  mock = mockGemini(MODELS, () => json(400, { error: { message: 'API key not valid' } }));
  await assert.rejects(generate(request), /API key not valid/);
  assert.equal(mock.calls.length, 1);
});

test('generateJSON retries once when the model returns malformed JSON', async () => {
  mock = mockGemini(['gemini-9.0-flash'], (model, body, n) => reply(n === 1 ? '{"speech": ' : { speech: 'hello' }));
  assert.deepEqual(await generateJSON(request), { speech: 'hello' });
  assert.equal(mock.calls.length, 2);
});

test('ignores model "thought" parts in the answer', async () => {
  mock = mockGemini(['gemini-9.0-flash'], () => json(200, { candidates: [{ content: { parts: [{ text: 'thinking…', thought: true }, { text: 'answer' }] } }] }));
  assert.equal(await generate(request), 'answer');
});
