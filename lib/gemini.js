// Thin Gemini REST client (no SDK) with automatic model discovery and a low-latency mode.

const BASE = 'https://generativelanguage.googleapis.com/v1beta';

let cachedModel = null;
let thinkingUnsupported = false;

export function hasKey() {
  return Boolean(process.env.GEMINI_API_KEY);
}

export function currentModel() {
  return process.env.GEMINI_MODEL || cachedModel;
}

async function api(path, init = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      'x-goog-api-key': process.env.GEMINI_API_KEY,
      ...(init.headers || {}),
    },
    signal: AbortSignal.timeout(60_000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body?.error?.message || `Gemini API error ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return body;
}

// Model IDs change often, so pick the newest stable "gemini-X.Y-flash" the key can use.
function version(name) {
  const m = name.match(/gemini-(\d+)(?:\.(\d+))?/);
  return m ? Number(m[1]) * 100 + Number(m[2] || 0) : 0;
}

export async function pickModel() {
  if (process.env.GEMINI_MODEL) return process.env.GEMINI_MODEL;
  if (cachedModel) return cachedModel;

  const { models = [] } = await api('/models?pageSize=1000');
  const usable = models
    .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
    .map((m) => m.name.replace(/^models\//, ''))
    .filter((n) => n.startsWith('gemini-'));

  const stableFlash = usable.filter((n) => /^gemini-[\d.]+-flash$/.test(n));
  const anyFlash = usable.filter((n) => /flash/.test(n) && !/lite|image|tts|audio|live|embedding/.test(n));
  const pool = stableFlash.length ? stableFlash : anyFlash.length ? anyFlash : usable;
  if (!pool.length) throw new Error('No Gemini model available for this API key.');

  cachedModel = pool.sort((a, b) => version(b) - version(a))[0];
  console.log(`[gemini] using model ${cachedModel}`);
  return cachedModel;
}

// Real-time vision needs answers in ~1-2 s, so keep model "thinking" minimal.
function thinkingConfig(model) {
  if (thinkingUnsupported) return undefined;
  if (/gemini-2\.5-flash/.test(model)) return { thinkingBudget: 0 };
  if (version(model) >= 300) return { thinkingLevel: 'low' };
  return undefined;
}

/**
 * Call generateContent and return the text of the first candidate.
 * schema: optional responseSchema (forces JSON). fast: minimise latency.
 */
export async function generate({ system, contents, schema, temperature = 0.2, fast = false }) {
  const model = await pickModel();
  const generationConfig = { temperature };
  if (schema) {
    generationConfig.responseMimeType = 'application/json';
    generationConfig.responseSchema = schema;
  }
  const thinking = fast ? thinkingConfig(model) : undefined;
  if (thinking) generationConfig.thinkingConfig = thinking;

  let body;
  try {
    body = await api(`/models/${model}:generateContent`, {
      method: 'POST',
      body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents, generationConfig }),
    });
  } catch (err) {
    if (err.status === 404) cachedModel = null; // model retired — rediscover next time
    if (err.status === 400 && thinking && /think/i.test(err.message)) {
      thinkingUnsupported = true; // this model rejects our thinking config — retry without it
      return generate({ system, contents, schema, temperature, fast: false });
    }
    throw err;
  }

  const candidate = body.candidates?.[0];
  if (!candidate) {
    const reason = body.promptFeedback?.blockReason;
    throw new Error(reason ? `Request blocked by safety filter (${reason}).` : 'Empty response from Gemini.');
  }
  return (candidate.content?.parts || [])
    .filter((p) => p.text && !p.thought)
    .map((p) => p.text)
    .join('');
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
