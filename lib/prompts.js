export const LANGUAGES = {
  en: 'English',
  hi: 'Hindi (हिन्दी)',
  mr: 'Marathi (मराठी)',
  ta: 'Tamil (தமிழ்)',
  te: 'Telugu (తెలుగు)',
  bn: 'Bengali (বাংলা)',
  kn: 'Kannada (ಕನ್ನಡ)',
  gu: 'Gujarati (ગુજરાતી)',
};

export const MODES = ['describe', 'read', 'money', 'find', 'guide', 'ask'];

export const languageName = (code) => LANGUAGES[code] || LANGUAGES.en;

const S = (description, extra = {}) => ({ type: 'STRING', description, ...extra });
const ARR = (items, description) => ({ type: 'ARRAY', items, description });
const BOX = ARR({ type: 'INTEGER' }, '[ymin, xmin, ymax, xmax] normalised 0-1000');
const SPEECH = S('What to say aloud, in the target language. Spoken style, short sentences, no markdown, no numbers from boxes.');
const OBJECT = {
  type: 'OBJECT',
  properties: {
    label: S('Short name in the target language'),
    box_2d: BOX,
    severity: S('Danger for a blind person walking', { enum: ['none', 'low', 'medium', 'high'] }),
  },
  required: ['label', 'box_2d', 'severity'],
};

export const SCHEMAS = {
  describe: {
    type: 'OBJECT',
    properties: { speech: SPEECH, objects: ARR(OBJECT, 'Up to 8 most important objects / hazards') },
    required: ['speech', 'objects'],
  },
  read: {
    type: 'OBJECT',
    properties: {
      speech: SPEECH,
      documentType: S('e.g. signboard, medicine label, bill, menu, letter, screen, book page, none'),
      text: S('ALL visible text verbatim, in reading order, original language'),
      textLanguage: S('BCP-47 code of the main text language, e.g. en, hi, mr'),
    },
    required: ['speech', 'documentType', 'text', 'textLanguage'],
  },
  money: {
    type: 'OBJECT',
    properties: {
      speech: SPEECH,
      items: ARR(
        {
          type: 'OBJECT',
          properties: {
            denomination: { type: 'INTEGER', description: 'Value in rupees' },
            kind: S('', { enum: ['note', 'coin'] }),
            box_2d: BOX,
          },
          required: ['denomination', 'kind', 'box_2d'],
        },
        'Every Indian currency note and coin visible, each counted once',
      ),
      unsure: { type: 'BOOLEAN', description: 'true if any item could not be identified with confidence' },
    },
    required: ['speech', 'items', 'unsure'],
  },
  find: {
    type: 'OBJECT',
    properties: {
      found: { type: 'BOOLEAN' },
      speech: SPEECH,
      box_2d: BOX,
    },
    required: ['found', 'speech'],
  },
  guide: {
    type: 'OBJECT',
    properties: {
      changed: { type: 'BOOLEAN', description: 'false if nothing important for walking changed since the previous report' },
      speech: S('Max 12 words, most urgent first, target language. Empty if nothing to report.'),
      objects: ARR(OBJECT, 'Obstacles and hazards relevant to walking'),
    },
    required: ['changed', 'speech', 'objects'],
  },
  ask: {
    type: 'OBJECT',
    properties: { speech: SPEECH, objects: ARR(OBJECT, 'Objects relevant to the answer (optional)') },
    required: ['speech'],
  },
};

function base(lang) {
  return `You are Drishti, the eyes of a blind or low-vision person in India. The image comes from their phone camera, held at chest height and pointing forward.

RULES
- Be concise, concrete and safety-first. Mention dangers before anything else.
- Never guess. If something is unclear, say so and suggest how to move the camera.
- Describe people only by position and action. Never identify anyone or guess identity, religion or caste.
- Give directions as clock positions (12 o'clock = straight ahead, 3 o'clock = right) and simple distances (within reach, two steps, far).
- Write "speech" in ${languageName(lang)} as natural spoken language, in that language's native script (e.g. Devanagari for Hindi and Marathi, not English letters). No markdown.
- Bounding boxes: box_2d = [ymin, xmin, ymax, xmax], integers normalised to 0-1000.
- Hazard severity for walking: high = vehicles, stairs/steps down, open drains, potholes, edges, fire, animals in path; medium = obstacles in path, steps up, wet floor, low-hanging objects; low = minor clutter.`;
}

const TASKS = {
  describe: () => `TASK: Describe the scene in 2-3 sentences: where the user is, the most important things around them, and hazards first. Return up to 8 important objects with boxes.`,
  read: () => `TASK: Read ALL visible text verbatim in reading order into "text". In "speech", say what kind of document it is, then the key information: for a bill, the total and due date; for a medicine label, the name, strength and expiry date exactly as printed (never give medical advice); for a sign, read it fully. If there is no readable text, say so and suggest holding the camera closer or flatter.`,
  money: () => `TASK: Identify every Indian currency note and coin. Count each physical note/coin once, even if it is partly hidden. In "speech", list what you see briefly (e.g. "two 500 rupee notes and one 100 rupee note"). Do NOT state a total; the app computes it. If notes overlap or you are unsure, set unsure=true and say so.`,
  find: (q) => `TASK: The user is looking for: "${q}". If it is visible, set found=true, give its box_2d, and in "speech" say where it is in a few words. If it is not visible, set found=false and in "speech" briefly suggest where such an item is usually found in this kind of place.`,
  guide: (q, previous) => `TASK: The user is WALKING. Report only what matters for walking safely: obstacles, steps, stairs, kerbs, vehicles, potholes, open drains, people in the path, doors, turns.
Previous report: "${previous || 'none'}".
If nothing important changed, set changed=false and speech="". Otherwise speech must be at most 12 words, most urgent first, with clock direction.`,
  ask: (q) => `TASK: Answer the user's question about this image: "${q}". Answer directly in 1-3 sentences. If the answer is not visible, say so and suggest how to point the camera.`,
};

export function buildPrompt(mode, { lang, query, previous }) {
  return { system: `${base(lang)}\n\n${TASKS[mode](query, previous)}`, schema: SCHEMAS[mode] };
}
