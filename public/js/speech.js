// Spoken output. Uses the browser's built-in voices (works offline on most phones).
import { LANGS } from './i18n.js';

const settings = { rate: 1, screenReader: false };
let lastSpoken = { text: '', lang: 'en' };

export function configureSpeech(opts) {
  Object.assign(settings, opts);
}

function voiceFor(code) {
  const voices = window.speechSynthesis?.getVoices() || [];
  const exact = voices.find((v) => v.lang.replace('_', '-').toLowerCase() === code.toLowerCase());
  return exact || voices.find((v) => v.lang.toLowerCase().startsWith(code.slice(0, 2)));
}

/**
 * Speak text in a language (app code like "hi" or BCP-47 like "hi-IN").
 * interrupt=true cancels anything currently being said (used for hazards).
 */
export function speak(text, lang = 'en', { interrupt = true, remember = true } = {}) {
  if (!text) return;
  if (remember) lastSpoken = { text, lang };
  // In screen-reader mode, the aria-live caption is read by TalkBack/VoiceOver instead.
  if (settings.screenReader || !('speechSynthesis' in window)) return;
  if (interrupt) speechSynthesis.cancel();
  const code = LANGS[lang]?.speech || (lang.includes('-') ? lang : `${lang}-IN`);
  const u = new SpeechSynthesisUtterance(text);
  u.lang = code;
  u.rate = settings.rate;
  const v = voiceFor(code);
  if (v) u.voice = v;
  speechSynthesis.speak(u);
}

export const isSpeaking = () => Boolean(window.speechSynthesis?.speaking);
export const stopSpeaking = () => window.speechSynthesis?.cancel();
export const repeatLast = () => speak(lastSpoken.text, lastSpoken.lang, { remember: false });
export const warmUpVoices = () => window.speechSynthesis?.getVoices();
