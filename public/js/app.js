import { LANGS, t, clockLabel, PROXIMITY } from './i18n.js';
import { speak, repeatLast, stopSpeaking, warmUpVoices } from './speech.js';
import { startCamera, grabFrame, sourceSize } from './camera.js';
import { checkCanvas } from './quality.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

const MODE_LABEL = { describe: 'Describe', read: 'Read', money: 'Money', find: 'Find', guide: 'Guide' };
const state = { mode: 'describe', lang: 'en', camera: false, busy: false, last: null };
const lang = () => state.lang;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// ---------- output ----------

function say(text, opts) {
  $('#caption').textContent = text;
  speak(text, lang(), opts);
}

function showAlert(alert) {
  const box = $('#alertBox');
  if (!alert) { box.hidden = true; return; }
  box.className = `alert ${alert.level}`;
  box.textContent = `⚠ ${alert.label} · ${clockLabel(alert.clock)} · ${PROXIMITY[alert.proximity]}`;
  box.hidden = false;
  clearTimeout(showAlert.timer);
  showAlert.timer = setTimeout(() => { box.hidden = true; }, 5000);
}

// ---------- overlay: map normalised boxes onto the displayed video/photo ----------

function activeSource() {
  return $('#still').hidden ? $('#video') : $('#still');
}

function drawOverlay(objects = []) {
  const canvas = $('#overlay');
  const src = activeSource();
  const dpr = window.devicePixelRatio || 1;
  const cw = canvas.clientWidth;
  const ch = canvas.clientHeight;
  canvas.width = cw * dpr;
  canvas.height = ch * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, cw, ch);

  const { w, h } = sourceSize(src);
  if (!w || !h) return;
  const cover = src.tagName === 'VIDEO';
  const scale = cover ? Math.max(cw / w, ch / h) : Math.min(cw / w, ch / h);
  const dw = w * scale;
  const dh = h * scale;
  const ox = (cw - dw) / 2;
  const oy = (ch - dh) / 2;
  const color = { high: '#ff453a', medium: '#ff9f0a', low: '#ffd60a', none: '#ffffff' };

  ctx.font = '700 14px Atkinson Hyperlegible, system-ui, sans-serif';
  for (const o of objects) {
    if (!o.box) continue;
    const [y1, x1, y2, x2] = o.box;
    const x = ox + (x1 / 1000) * dw;
    const y = oy + (y1 / 1000) * dh;
    const bw = ((x2 - x1) / 1000) * dw;
    const bh = ((y2 - y1) / 1000) * dh;
    ctx.strokeStyle = color[o.severity] || '#fff';
    ctx.lineWidth = o.severity === 'high' ? 4 : 2.5;
    ctx.strokeRect(x, y, bw, bh);
    const label = o.clock ? `${o.label} · ${o.clock}:00` : o.label;
    const tw = ctx.measureText(label).width + 10;
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fillRect(x, Math.max(0, y - 22), tw, 22);
    ctx.fillStyle = '#000';
    ctx.fillText(label, x + 5, Math.max(15, y - 6));
  }
}

// ---------- details panel ----------

function objectList(objects = []) {
  return objects.filter((o) => o.box).map((o) => `
    <div class="obj ${esc(o.severity)}">
      <b>${esc(o.label)}</b>
      <span>${clockLabel(o.clock)} · ${PROXIMITY[o.proximity]}</span>
      ${o.severity !== 'none' ? `<em>${esc(o.severity)} risk</em>` : ''}
    </div>`).join('');
}

function renderDetails(r) {
  let html = '';
  if (r.mode === 'money' && r.money) {
    const m = r.money;
    html += `<div><div class="total">₹${m.total.toLocaleString('en-IN')}</div><span class="muted">${m.count} item(s), totalled by code, not AI</span></div>`;
    html += m.breakdown.map((b) => `<div class="obj"><b>₹${b.denomination} ${b.kind}</b><span>× ${b.count}</span></div>`).join('');
    if (m.has2000) html += '<p class="note">₹2000 notes were withdrawn from circulation in 2023 but are still legal tender. Banks/RBI can exchange them.</p>';
    if (m.rejected.length) html += `<p class="note">Ignored ${m.rejected.length} item(s) with an invalid denomination.</p>`;
    if (m.unsure) html += '<p class="note">Some notes were unclear. Spread them out and try again.</p>';
  }
  if (r.mode === 'read') {
    html += `<p class="note">${esc(r.documentType || 'Text')}</p>`;
    html += r.text ? `<div class="read-text" lang="${esc(r.textLanguage)}">${esc(r.text)}</div><button id="readAll" class="btn">🔊 Read full text</button>` : '';
  }
  html += objectList(r.objects);
  $('#details').innerHTML = html || '<p class="muted">Nothing specific to list.</p>';
  $('#meta').textContent = `${r.latencyMs} ms${r.model ? ` · ${r.model}` : ''}`;
  $('#readAll')?.addEventListener('click', () => speak(r.text, r.textLanguage));
}

// ---------- core loop ----------

async function see(mode, { query = '', previous = '' } = {}) {
  if (state.busy) return null;
  const frame = grabFrame(activeSource());
  if (!frame) { say('Camera is not ready yet.'); return null; }

  // Don't send frames the model can't use; tell the user how to fix the shot instead.
  const quality = checkCanvas(frame.canvas, { needSharp: mode === 'read' });
  if (quality.result !== 'ok') {
    const now = Date.now();
    if (quality.result !== state.lastQuality?.result || now - state.lastQuality.at > 4000) say(t(lang(), quality.result));
    state.lastQuality = { result: quality.result, at: now };
    $('#meta').textContent = `skipped: ${quality.result} (light ${quality.brightness}, detail ${quality.sharpness})`;
    return null;
  }

  state.busy = true;
  $('#busy').hidden = false;
  try {
    const res = await fetch('/api/see', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode, query, previous, language: lang(), image: { mimeType: frame.mimeType, data: frame.data } }),
    });
    const r = await res.json();
    if (!res.ok) throw new Error(r.error || `Error ${res.status}`);
    state.last = r;
    drawOverlay(r.objects);
    renderDetails(r);
    showAlert(r.alert);
    return r;
  } catch (err) {
    say(err.message);
    return null;
  } finally {
    state.busy = false;
    $('#busy').hidden = true;
  }
}

function spokenResult(r) {
  if (r.mode !== 'money' || !r.money) return r.speech;
  const total = `${t(lang(), 'total')}: ${r.money.total} ${t(lang(), 'rupees')}.`;
  return r.money.count ? `${r.speech} ${total}` : r.speech;
}

async function lookOnce(mode = state.mode, opts) {
  const r = await see(mode, opts);
  if (r) say(spokenResult(r));
  return r;
}

async function look() {
  if (!state.camera && $('#still').hidden) return;
  if (state.mode === 'find') {
    const q = $('#findInput').value.trim();
    if (!q) { $('#findInput').focus(); return say('What are you looking for?'); }
    return lookOnce('find', { query: q });
  }
  return lookOnce();
}

// ---------- modes & input ----------

function setMode(mode) {
  state.mode = mode;
  $$('.mode').forEach((b) => {
    const on = b.dataset.mode === mode;
    b.classList.toggle('active', on);
    b.setAttribute('aria-pressed', on);
  });
  $('#findBar').hidden = mode !== 'find';
  if (mode === 'find') $('#findInput').focus();
  speak(MODE_LABEL[mode], 'en', { remember: false });
}

async function start() {
  warmUpVoices();
  try {
    await startCamera($('#video'));
    state.camera = true;
    $('#still').hidden = true;
  } catch {
    say('Camera not available. Use “Photo” to upload a picture instead.');
  }
  $('#startBtn').hidden = true;
  $('#lookBtn').disabled = false;
  if (state.camera) say(t(lang(), 'ready'));
}

function useStill(file) {
  if (!file?.type.startsWith('image/')) return;
  const img = $('#still');
  img.onload = () => {
    img.hidden = false;
    $('#startBtn').hidden = true;
    $('#lookBtn').disabled = false;
    look();
  };
  img.src = URL.createObjectURL(file);
}

function bind() {
  $('#startBtn').addEventListener('click', start);
  $('#lookBtn').addEventListener('click', look);
  $('#repeatBtn').addEventListener('click', repeatLast);
  $('#upload').addEventListener('change', (e) => useStill(e.target.files[0]));
  $$('.mode').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
  $('#findBar').addEventListener('submit', (e) => { e.preventDefault(); look(); });
  $('#lang').addEventListener('change', (e) => {
    state.lang = e.target.value;
    try { localStorage.setItem('drishti-lang', state.lang); } catch { /* storage blocked */ }
  });
  window.addEventListener('resize', () => drawOverlay(state.last?.objects));

  document.addEventListener('keydown', (e) => {
    if (e.target.matches('input, select, textarea') || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.code === 'Space') { e.preventDefault(); if (!$('#startBtn').hidden) start(); else look(); }
    else if (/^Digit[1-5]$/.test(e.code)) setMode(['describe', 'read', 'money', 'find', 'guide'][Number(e.code.slice(-1)) - 1]);
    else if (e.key === 'r' || e.key === 'R') repeatLast();
    else if (e.key === 'u' || e.key === 'U') $('#upload').click();
    else if (e.key === 'Escape') stopSpeaking();
  });
}

async function boot() {
  $('#lang').innerHTML = Object.entries(LANGS).map(([k, v]) => `<option value="${k}">${v.name}</option>`).join('');
  try { state.lang = localStorage.getItem('drishti-lang') || 'en'; } catch { /* storage blocked */ }
  $('#lang').value = state.lang;
  bind();

  const health = await fetch('/api/health').then((r) => r.json()).catch(() => null);
  const badge = $('#aiBadge');
  badge.className = `badge ${health?.ai ? 'on' : 'off'}`;
  badge.textContent = health?.ai ? `Gemini · ${health.model || 'ready'}` : 'AI key missing';
}

boot();
