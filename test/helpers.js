// Shared test helpers: a fake Gemini API so tests never use network or quota.

export const GEMINI_HOST = 'https://generativelanguage.googleapis.com';

export const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

export const modelList = (...names) => json(200, {
  models: names.map((n) => ({ name: `models/${n}`, supportedGenerationMethods: ['generateContent'] })),
});

export const reply = (obj) => json(200, { candidates: [{ content: { parts: [{ text: typeof obj === 'string' ? obj : JSON.stringify(obj) }] } }] });

export const dailyQuota = () => json(429, {
  error: {
    code: 429,
    message: 'You exceeded your current quota.',
    details: [
      { '@type': 'type.googleapis.com/google.rpc.QuotaFailure', violations: [{ quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier' }] },
      { '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '80000s' },
    ],
  },
});

/**
 * Replace global fetch for Gemini URLs only. `handler(model, body)` returns a Response;
 * the model list endpoint is answered from `models`. Returns { calls, restore }.
 */
export function mockGemini(models, handler) {
  const realFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    if (!u.startsWith(GEMINI_HOST)) return realFetch(url, init);
    if (u.includes('/models?')) return modelList(...models);
    const model = u.match(/models\/([^:]+):generateContent/)?.[1];
    const body = init.body ? JSON.parse(init.body) : {};
    calls.push({ model, body });
    return handler(model, body, calls.length);
  };
  return { calls, restore: () => { globalThis.fetch = realFetch; } };
}
