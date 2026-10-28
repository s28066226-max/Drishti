// Turn a spoken sentence into an action. Anything that is not a command becomes
// a free-form question about the current camera view ("ask" mode).

// `\b` only understands ASCII, so build Unicode-aware word boundaries (works for Devanagari etc.).
const B = '(?<![\\p{L}\\p{M}\\p{N}])';
const E = '(?![\\p{L}\\p{M}\\p{N}])';
const re = (src) => new RegExp(src, 'iu');

const RULES = [
  [re(`^(stop|cancel|quiet|बंद करो|रुको|रुक जाओ|थांबा)${E}`), () => ({ action: 'stop' })],
  [re('^(?:find|search for|look for|where (?:is|are)|locate|ढूँढो|ढूंढो|खोजो|शोधा)\\s+(?:my\\s+|the\\s+|a\\s+|मेरा\\s+|मेरी\\s+|मेरे\\s+)?(.+)'),
    (m) => ({ action: 'mode', mode: 'find', query: m[1].replace(/[?.!।]+$/u, '').trim() })],
  [re(`^(read|पढ़ो|पढ़िए|पढ़|वाचा)${E}|what does (it|this) say`), () => ({ action: 'mode', mode: 'read' })],
  [re(`${B}(how much money|count (the )?(money|cash|notes)|which note|कितने पैसे|कितने रुपये|किती पैसे)${E}`), () => ({ action: 'mode', mode: 'money' })],
  [re("^(describe|what(?:'s| is) around|what do you see|आसपास क्या है|क्या दिख रहा है|काय दिसत)"), () => ({ action: 'mode', mode: 'describe' })],
  [re('^(guide me|start guide|walk with me|navigate|गाइड|मुझे रास्ता दिखाओ)'), () => ({ action: 'mode', mode: 'guide' })],
];

export function parseCommand(text) {
  const q = String(text || '').trim();
  if (!q) return null;
  for (const [pattern, make] of RULES) {
    const m = q.match(pattern);
    if (m) return make(m);
  }
  return { action: 'mode', mode: 'ask', query: q };
}
