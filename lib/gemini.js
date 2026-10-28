// Thin Gemini REST client (no SDK) with model discovery, automatic failover and a low-latency mode.
//
// Newer models are sometimes overloaded (503 / timeouts) and free-tier quotas run out (429).
// A blind user can't wait, so we keep a tiered list (Flash -> Flash-Lite -> Gemma, each with
// its own quota), skip models that are cooling down for as long as Google's retryDelay says,
// and stick with whichever model last answered.

const BASE = 'https://generativelanguage.googleapis.com/v1beta';
const COOLDOWN_MS = 60_000;
const FAST_DEADLINE_MS = 20_000; // total budget across failovers in live modes
const FAST_ATTEMPT_MS = 6_500;
const MAX_ATTEMPTS = 3;

let candidates = null; // model ids, newest first
let sticky = null; // last model that answered
const cooldownUntil = new Map(); // model -> timestamp
const latency = new Map(); // model -> moving average of successful response time (ms)
const noThinkingConfig = new Set(); // models that reject our thinking config

export function hasKey() {
  return Boolean(process.env.GEMINI_API_KEY);
}

export function currentModel() {
  return process.env.GEMINI_MODEL || sticky || candidates?.[0] || null;
}

async function api(path, init = {}, timeoutMs = 30_000) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      'x-goog-api-key': process.env.GEMINI_API_KEY,
      ...(init.headers || {}),
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body?.error?.message || `Gemini API error ${res.status}`);
    err.status = res.status;
    // 429s carry how long to wait and whether the daily (not per-minute) quota is gone.
    for (const d of body?.error?.details || []) {
      if (d.retryDelay) err.retryDelayMs = parseFloat(d.retryDelay) * 1000;
      if (d.violations?.some((v) => /PerDay/i.test(v.quotaId || ''))) err.daily = true;
    }
    throw err;
  }
  return body;
}

function version(name) {
  const m = name.match(/gemini-(\d+)(?:\.(\d+))?/);
  return m ? Number(m[1]) * 100 + Number(m[2] || 0) : 0;
}

async function rankedModels() {
  if (process.env.GEMINI_MODEL) return [process.env.GEMINI_MODEL];
  if (candidates) return candidates;

  const { models = [] } = await api('/models?pageSize=1000');
  const usable = models
    .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
    .map((m) => m.name.replace(/^models\//, ''));
  const newestFirst = (a, b) => version(b) - version(a);
  const flash = usable.filter((n) => /^gemini-[\d.]+-flash$/.test(n)).sort(newestFirst);
  const lite = [...usable.filter((n) => /^gemini-[\d.]+-flash-lite$/.test(n)).sort(newestFirst), ...usable.filter((n) => n === 'gemini-flash-lite-latest')];
  // Gemma: open models with separate, generous free quotas. Mixture-of-experts (a4b) variants are fastest.
  const gemma = usable.filter((n) => /^gemma-\d+-.*-it$/.test(n)).sort((a, b) => /a\d+b/.test(b) - /a\d+b/.test(a));
  candidates = [...flash, ...lite, ...gemma];
  if (!candidates.length) throw new Error('No Gemini or Gemma model is available for this API key.');
  console.log(`[gemini] candidate models: ${candidates.join(', ')}`);
  return candidates;
}

export async function pickModel() {
  const list = await rankedModels();
  return sticky || list[0];
}

const cooling = (m) => (cooldownUntil.get(m) || 0) > Date.now();
const dailyExhausted = new Set(); // models whose free daily quota is used up

function coolDown(model, err) {
  // 404 = model retired for this key; park it for a day.
  const ms = err.status === 404 ? 86_400_000 : Math.max(COOLDOWN_MS, err.retryDelayMs || 0);
  cooldownUntil.set(model, Date.now() + ms);
  if (err.daily) dailyExhausted.add(model);
}

// At startup, probe models in tier order until one answers, so the first real request
// goes straight to a working model. Quota errors return instantly and cost nothing.
let warming = null;
export function warmUp() {
  if (warming) return warming;
  warming = (async () => {
    const ping = { system: 'Reply with OK.', contents: [{ role: 'user', parts: [{ text: 'OK?' }] }], temperature: 0, fast: true };
    for (const m of await rankedModels()) {
      if (cooling(m)) continue;
      const t0 = Date.now();
      try {
        await callModel(m, ping);
        recordSuccess(m, Date.now() - t0);
        sticky = m;
        console.log(`[gemini] using ${m}`);
        break;
      } catch (err) {
        coolDown(m, err);
        console.warn(`[gemini] ${m} unavailable (${err.status || err.name}${err.daily ? ', daily quota' : ''})`);
      }
    }
    if (!sticky) console.warn('[gemini] no model is available right now');
    return sticky;
  })().finally(() => { warming = null; });
  return warming;
}

// Order: last model that worked, then tier order (Flash -> Flash-Lite -> Gemma).
// Models on cooldown are skipped entirely, so a quota outage costs zero API calls.
async function attemptOrder() {
  const list = await rankedModels();
  return [...new Set([sticky, ...list].filter(Boolean))].filter((m) => !cooling(m));
}

function unavailableError() {
  const allDaily = candidates?.length && candidates.every((m) => dailyExhausted.has(m) || (cooldownUntil.get(m) || 0) - Date.now() > 3_600_000);
  const wait = Math.min(...(candidates || []).map((m) => cooldownUntil.get(m) || 0)) - Date.now();
  const message = allDaily
    ? "Today's free Gemini quota is used up. Link billing (hackathon cloud credits) to the API key's project, or use a key from a new project."
    : `The AI service is busy right now. Please try again in ${Math.max(5, Math.ceil(wait / 1000))} seconds.`;
  return Object.assign(new Error(message), { status: allDaily ? 429 : 503, retryAfterMs: Math.max(0, wait) });
}

function recordSuccess(model, ms) {
  const prev = latency.get(model);
  latency.set(model, prev ? prev * 0.7 + ms * 0.3 : ms);
}

// Real-time vision needs answers in a few seconds, so keep model "thinking" minimal.
function thinkingConfig(model) {
  if (noThinkingConfig.has(model)) return undefined;
  if (/gemini-2\.5-flash/.test(model)) return { thinkingBudget: 0 };
  if (version(model) >= 300) return { thinkingLevel: 'low' };
  return undefined;
}

const transient = (err) => err.name === 'TimeoutError' || err.name === 'AbortError' || err.status === 429 || err.status >= 500;

async function callModel(model, { system, contents, schema, temperature, fast, timeoutMs }) {
  const generationConfig = { temperature };
  if (schema) {
    generationConfig.responseMimeType = 'application/json';
    generationConfig.responseSchema = schema;
  }
  const thinking = fast ? thinkingConfig(model) : undefined;
  if (thinking) generationConfig.thinkingConfig = thinking;

  try {
    return await api(
      `/models/${model}:generateContent`,
      { method: 'POST', body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents, generationConfig }) },
      timeoutMs || (fast ? FAST_ATTEMPT_MS : 45_000),
    );
  } catch (err) {
    if (err.status === 400 && thinking && /think/i.test(err.message)) {
      noThinkingConfig.add(model);
      return callModel(model, { system, contents, schema, temperature, fast: false, timeoutMs });
    }
    throw err;
  }
}

/**
 * Call generateContent with failover and return the text of the first candidate.
 * schema: optional responseSchema (forces JSON). fast: minimise latency.
 */
export async function generate(opts) {
  const order = await attemptOrder();
  if (!order.length) throw unavailableError();
  const deadline = Date.now() + (opts.fast ? FAST_DEADLINE_MS : 90_000);
  let lastErr;
  let slowFailures = 0; // timeouts / 5xx; quota (429) and retired (404) errors are instant and don't count
  for (const model of order) {
    const remaining = deadline - Date.now();
    if (remaining < 1500 || slowFailures >= MAX_ATTEMPTS) break;
    const started = Date.now();
    try {
      const body = await callModel(model, {
        temperature: 0.2,
        ...opts,
        timeoutMs: Math.min(remaining, opts.fast ? FAST_ATTEMPT_MS : 45_000),
      });
      const candidate = body.candidates?.[0];
      if (!candidate) {
        const reason = body.promptFeedback?.blockReason;
        throw new Error(reason ? `Request blocked by safety filter (${reason}).` : 'Empty response from Gemini.');
      }
      if (sticky !== model) console.log(`[gemini] now using ${model}`);
      sticky = model;
      recordSuccess(model, Date.now() - started);
      return (candidate.content?.parts || []).filter((p) => p.text && !p.thought).map((p) => p.text).join('');
    } catch (err) {
      lastErr = err;
      if (!transient(err) && err.status !== 404) throw err;
      if (err.status !== 429 && err.status !== 404) slowFailures += 1;
      coolDown(model, err);
      if (sticky === model) sticky = null;
      console.warn(`[gemini] ${model} unavailable (${err.status || err.name}${err.daily ? ', daily quota' : ''}); trying next model`);
    }
  }
  throw Object.assign(unavailableError(), { cause: lastErr });
}

export async function generateJSON(opts) {
  for (let attempt = 0; ; attempt++) {
    const text = await generate(opts);
    try {
      return JSON.parse(text);
    } catch {
      if (attempt >= 1) throw new Error('Could not parse the AI response. Please try again.');
    }
  }
}

/** Test helper: forget discovered models, cooldowns and latency stats. */
export function _resetForTests() {
  candidates = null;
  sticky = null;
  warming = null;
  cooldownUntil.clear();
  latency.clear();
  noThinkingConfig.clear();
  dailyExhausted.clear();
}
