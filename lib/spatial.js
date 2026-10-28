// Deterministic spatial reasoning on top of Gemini's bounding boxes.
// The model says WHAT and roughly WHERE (box_2d); code decides direction,
// distance, urgency and money totals so they are consistent and testable.
//
// box_2d follows Gemini's convention: [ymin, xmin, ymax, xmax], normalised 0-1000.

export function normBox(b) {
  if (!Array.isArray(b) || b.length !== 4) return null;
  const n = b.map((v) => Math.max(0, Math.min(1000, Number(v))));
  if (n.some((v) => Number.isNaN(v))) return null;
  const [ymin, xmin, ymax, xmax] = n;
  if (ymax <= ymin || xmax <= xmin) return null;
  return n;
}

// A phone camera sees roughly ±35° horizontally ≈ ±1 clock hour (30° per hour).
export function clock(box) {
  const cx = (box[1] + box[3]) / 2000;
  const hours = Math.round((cx - 0.5) * 2.4);
  return hours === 0 ? 12 : (12 + hours) % 12 || 12;
}

export function side(box) {
  const cx = (box[1] + box[3]) / 2000;
  if (cx < 0.3) return 'left';
  if (cx < 0.45) return 'slightly_left';
  if (cx <= 0.55) return 'ahead';
  if (cx <= 0.7) return 'slightly_right';
  return 'right';
}

// Apparent size + how low in the frame it reaches are good monocular cues for distance.
export function proximity(box) {
  const area = ((box[2] - box[0]) * (box[3] - box[1])) / 1e6;
  const bottom = box[2] / 1000;
  if (area > 0.25 || (bottom > 0.92 && area > 0.08)) return 'near';
  if (area > 0.05 || bottom > 0.8) return 'mid';
  return 'far';
}

const SEVERITY = { none: 0, low: 0.35, medium: 0.65, high: 1 };
const NEARNESS = { near: 1, mid: 0.6, far: 0.25 };

// 0..1 — how urgently a walking user must hear about this object.
export function urgency(obj) {
  const centrality = 1 - Math.min(1, Math.abs((obj.box[1] + obj.box[3]) / 2000 - 0.5) * 2);
  const s = SEVERITY[obj.severity] ?? 0;
  return Math.round(s * NEARNESS[obj.proximity] * (0.5 + 0.5 * centrality) * 100) / 100;
}

export function enrichObjects(objects = []) {
  return objects
    .map((o) => {
      const box = normBox(o.box_2d);
      if (!box) return { label: o.label, severity: o.severity || 'none', box: null };
      const base = { label: o.label, severity: o.severity || 'none', box, clock: clock(box), side: side(box), proximity: proximity(box) };
      return { ...base, urgency: urgency(base) };
    })
    .sort((a, b) => (b.urgency ?? 0) - (a.urgency ?? 0));
}

// Most urgent hazard worth interrupting the user for (vibration + assertive speech).
export function topAlert(objects, threshold = 0.45) {
  const hit = objects.find((o) => o.box && o.severity !== 'none' && o.urgency >= threshold);
  return hit ? { label: hit.label, clock: hit.clock, proximity: hit.proximity, level: hit.urgency >= 0.75 ? 'high' : 'medium' } : null;
}

// Legal-tender Indian denominations. ₹2000 notes were withdrawn from circulation in 2023
// but remain legal tender, so we count them and add a note.
const NOTES = new Set([10, 20, 50, 100, 200, 500, 2000]);
const COINS = new Set([1, 2, 5, 10, 20]);

export function currencyTotal(items = []) {
  const valid = [];
  const rejected = [];
  for (const it of items) {
    const d = Math.round(Number(it.denomination));
    const ok = it.kind === 'coin' ? COINS.has(d) : NOTES.has(d);
    (ok ? valid : rejected).push({ denomination: d, kind: it.kind === 'coin' ? 'coin' : 'note', box: normBox(it.box_2d) });
  }
  const breakdown = {};
  for (const v of valid) {
    const k = `${v.denomination}-${v.kind}`;
    breakdown[k] = breakdown[k] || { denomination: v.denomination, kind: v.kind, count: 0 };
    breakdown[k].count += 1;
  }
  return {
    total: valid.reduce((s, v) => s + v.denomination, 0),
    count: valid.length,
    breakdown: Object.values(breakdown).sort((a, b) => b.denomination - a.denomination),
    items: valid,
    rejected,
    has2000: valid.some((v) => v.denomination === 2000 && v.kind === 'note'),
  };
}

// Find mode: turn a target box into steering guidance for the audio "sonar".
export function findGuidance(box) {
  const b = normBox(box);
  if (!b) return { state: 'not_found' };
  const cx = (b[1] + b[3]) / 2000;
  const area = ((b[2] - b[0]) * (b[3] - b[1])) / 1e6;
  const offset = Math.round((cx - 0.5) * 200) / 100; // -1 (far left) .. 1 (far right)
  const closeness = Math.min(1, Math.round(Math.sqrt(area / 0.3) * 100) / 100);
  let state = 'ahead';
  if (offset < -0.25) state = 'left';
  else if (offset > 0.25) state = 'right';
  else if (closeness >= 0.85) state = 'reach';
  return { state, offset, closeness, clock: clock(b) };
}
