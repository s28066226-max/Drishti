// Audio "parking sensor" for Find mode. With headphones, beeps come from the side
// the object is on (stereo pan); they speed up and rise in pitch as it gets closer.

let ctx = null;
let timer = null;
let target = null; // { offset: -1..1, closeness: 0..1 } or null when not visible

export function initAudio() {
  ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
}

function beep({ freq, pan = 0, duration = 0.08, gain = 0.25, type = 'sine' }) {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
  osc.type = type;
  osc.frequency.value = freq;
  const t0 = ctx.currentTime;
  amp.gain.setValueAtTime(0, t0);
  amp.gain.linearRampToValueAtTime(gain, t0 + 0.01);
  amp.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
  osc.connect(amp);
  if (panner) {
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    amp.connect(panner).connect(ctx.destination);
  } else {
    amp.connect(ctx.destination);
  }
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

function tick() {
  if (!target) {
    beep({ freq: 220, duration: 0.12, gain: 0.12, type: 'triangle' }); // "searching" heartbeat
    timer = setTimeout(tick, 1400);
    return;
  }
  const { offset, closeness } = target;
  beep({ freq: 440 + closeness * 760, pan: offset });
  timer = setTimeout(tick, 900 - closeness * 760);
}

export function startSonar() {
  initAudio();
  stopSonar();
  target = null;
  tick();
}

export function updateSonar(guidance) {
  target = guidance && guidance.state !== 'not_found' ? { offset: guidance.offset, closeness: guidance.closeness } : null;
}

export function stopSonar() {
  clearTimeout(timer);
  timer = null;
}

export function successChime() {
  initAudio();
  [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep({ freq: f, duration: 0.18, gain: 0.3 }), i * 110));
}

export function alertTone(level = 'high') {
  initAudio();
  const f = level === 'high' ? 880 : 660;
  [0, 160].forEach((d) => setTimeout(() => beep({ freq: f, duration: 0.12, gain: 0.35, type: 'square' }), d));
}
