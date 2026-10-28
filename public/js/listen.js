// Voice input via the Web Speech API (Chrome/Edge/Android; Safari partial).
import { LANGS } from './i18n.js';

const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;

export const canListen = Boolean(Recognition);

/** Listen for one utterance. Resolves with the transcript ('' if nothing heard). */
export function listenOnce(lang) {
  return new Promise((resolve, reject) => {
    if (!Recognition) return reject(new Error('Voice input is not supported in this browser. Type instead.'));
    const rec = new Recognition();
    rec.lang = LANGS[lang]?.speech || 'en-IN';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    let heard = '';
    rec.onresult = (e) => { heard = e.results[0][0].transcript; };
    rec.onerror = (e) => (e.error === 'no-speech' ? resolve('') : reject(new Error(`Microphone error: ${e.error}`)));
    rec.onend = () => resolve(heard);
    rec.start();
  });
}
